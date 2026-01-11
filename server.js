const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dbConfig = require('./db-config');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create MySQL connection pool
const pool = mysql.createPool({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: dbConfig.waitForConnections,
    connectionLimit: dbConfig.connectionLimit,
    queueLimit: dbConfig.queueLimit
});

// Test database connection
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Connected to MySQL database');
        connection.release();
    } catch (error) {
        console.error('Error connecting to MySQL database:', error.message);
        console.error('Please ensure MySQL is running and database is created using database.sql');
        process.exit(1);
    }
})();

// Helper function to generate ID
function generateId(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get aircraft list
app.get('/api/aircraft', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM aircraft ORDER BY id');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching aircraft:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all flights
app.get('/api/flights', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT f.*, a.name as aircraft_name, a.capacity as aircraft_capacity
            FROM flights f
            JOIN aircraft a ON f.aircraft_id = a.id
            ORDER BY f.departure_date
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching flights:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single flight
app.get('/api/flights/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT f.*, a.name as aircraft_name, a.capacity as aircraft_capacity
            FROM flights f
            JOIN aircraft a ON f.aircraft_id = a.id
            WHERE f.id = ?
        `, [id]);

        if (rows.length === 0) {
            res.status(404).json({ error: 'Flight not found' });
            return;
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching flight:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create flight
app.post('/api/flights', async (req, res) => {
    try {
        const { departure_date, destination, aircraft_id } = req.body;

        if (!departure_date || !destination || !aircraft_id) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Check for duplicate flight (same destination and departure_date)
        const [existingFlights] = await pool.query(
            'SELECT id FROM flights WHERE destination = ? AND departure_date = ?',
            [destination, departure_date]
        );

        if (existingFlights.length > 0) {
            res.status(400).json({ error: 'Flight with the same destination and departure date already exists' });
            return;
        }

        const id = generateId('FL');
        await pool.query(
            'INSERT INTO flights (id, departure_date, destination, aircraft_id) VALUES (?, ?, ?, ?)',
            [id, departure_date, destination, aircraft_id]
        );

        const [rows] = await pool.query(`
            SELECT f.*, a.name as aircraft_name, a.capacity as aircraft_capacity
            FROM flights f
            JOIN aircraft a ON f.aircraft_id = a.id
            WHERE f.id = ?
        `, [id]);

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating flight:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Flight with the same destination and departure date already exists' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Update flight
app.put('/api/flights/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { departure_date, destination, aircraft_id } = req.body;

        if (!departure_date || !destination || !aircraft_id) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Check if flight exists
        const [existingFlights] = await pool.query(
            'SELECT id FROM flights WHERE id = ?',
            [id]
        );

        if (existingFlights.length === 0) {
            res.status(404).json({ error: 'Flight not found' });
            return;
        }

        // Check for duplicate flight (excluding current flight)
        const [duplicateFlights] = await pool.query(
            'SELECT id FROM flights WHERE destination = ? AND departure_date = ? AND id != ?',
            [destination, departure_date, id]
        );

        if (duplicateFlights.length > 0) {
            res.status(400).json({ error: 'Flight with the same destination and departure date already exists' });
            return;
        }

        await pool.query(
            'UPDATE flights SET departure_date = ?, destination = ?, aircraft_id = ? WHERE id = ?',
            [departure_date, destination, aircraft_id, id]
        );

        const [rows] = await pool.query(`
            SELECT f.*, a.name as aircraft_name, a.capacity as aircraft_capacity
            FROM flights f
            JOIN aircraft a ON f.aircraft_id = a.id
            WHERE f.id = ?
        `, [id]);

        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating flight:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Flight with the same destination and departure date already exists' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Delete flight
app.delete('/api/flights/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM flights WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Flight not found' });
            return;
        }

        res.json({ message: 'Flight deleted successfully' });
    } catch (error) {
        console.error('Error deleting flight:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get bookings for a flight
app.get('/api/flights/:flightId/bookings', async (req, res) => {
    try {
        const { flightId } = req.params;
        const [rows] = await pool.query(
            'SELECT * FROM bookings WHERE flight_id = ? ORDER BY booker_name',
            [flightId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT b.*, f.destination, f.departure_date
            FROM bookings b
            JOIN flights f ON b.flight_id = f.id
            ORDER BY f.departure_date, b.booker_name
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create booking
app.post('/api/bookings', async (req, res) => {
    try {
        const { flight_id, booker_name } = req.body;

        if (!flight_id || !booker_name) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Check if flight exists and get aircraft capacity
        const [flights] = await pool.query(`
            SELECT f.*, a.capacity as aircraft_capacity
            FROM flights f
            JOIN aircraft a ON f.aircraft_id = a.id
            WHERE f.id = ?
        `, [flight_id]);

        if (flights.length === 0) {
            res.status(404).json({ error: 'Flight not found' });
            return;
        }

        const flight = flights[0];

        // Check if person already has a booking on this flight
        const [existingBookings] = await pool.query(
            'SELECT id FROM bookings WHERE flight_id = ? AND booker_name = ?',
            [flight_id, booker_name]
        );

        if (existingBookings.length > 0) {
            res.status(400).json({ error: 'This person already has a booking on this flight' });
            return;
        }

        // Count existing bookings for this flight
        const [countResult] = await pool.query(
            'SELECT COUNT(*) as count FROM bookings WHERE flight_id = ?',
            [flight_id]
        );

        const bookingCount = countResult[0].count;
        if (bookingCount >= flight.aircraft_capacity) {
            res.status(400).json({ error: 'No available seats on this flight' });
            return;
        }

        const id = generateId('BK');
        await pool.query(
            'INSERT INTO bookings (id, flight_id, booker_name) VALUES (?, ?, ?)',
            [id, flight_id, booker_name]
        );

        const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating booking:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'This person already has a booking on this flight' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Update booking (only booker_name)
app.put('/api/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { booker_name, flight_id } = req.body;

        if (!booker_name) {
            res.status(400).json({ error: 'Missing required field: booker_name' });
            return;
        }

        // Get current booking to find flight_id
        const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);

        if (bookings.length === 0) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }

        const booking = bookings[0];
        const currentFlightId = flight_id || booking.flight_id;

        // Check if another person with this name already has a booking on this flight
        const [existingBookings] = await pool.query(
            'SELECT id FROM bookings WHERE flight_id = ? AND booker_name = ? AND id != ?',
            [currentFlightId, booker_name, id]
        );

        if (existingBookings.length > 0) {
            res.status(400).json({ error: 'This person already has a booking on this flight' });
            return;
        }

        await pool.query(
            'UPDATE bookings SET booker_name = ? WHERE id = ?',
            [booker_name, id]
        );

        const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating booking:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'This person already has a booking on this flight' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Delete booking
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM bookings WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }

        res.json({ message: 'Booking deleted successfully' });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: error.message });
    }
});

// Transfer booking to another flight
app.post('/api/bookings/:id/transfer', async (req, res) => {
    try {
        const { id } = req.params;
        const { target_flight_id } = req.body;

        if (!target_flight_id) {
            res.status(400).json({ error: 'Missing required field: target_flight_id' });
            return;
        }

        // Get current booking
        const [bookings] = await pool.query(`
            SELECT b.*, f.destination as current_destination
            FROM bookings b
            JOIN flights f ON b.flight_id = f.id
            WHERE b.id = ?
        `, [id]);

        if (bookings.length === 0) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }

        const booking = bookings[0];

        // Get target flight
        const [targetFlights] = await pool.query(`
            SELECT f.*, a.capacity as aircraft_capacity
            FROM flights f
            JOIN aircraft a ON f.aircraft_id = a.id
            WHERE f.id = ?
        `, [target_flight_id]);

        if (targetFlights.length === 0) {
            res.status(404).json({ error: 'Target flight not found' });
            return;
        }

        const targetFlight = targetFlights[0];

        // Check if destinations match
        if (booking.current_destination !== targetFlight.destination) {
            res.status(400).json({ error: 'Destination of target flight must be the same as the original flight' });
            return;
        }

        // Check if person already has a booking on target flight
        const [existingBookings] = await pool.query(
            'SELECT id FROM bookings WHERE flight_id = ? AND booker_name = ?',
            [target_flight_id, booking.booker_name]
        );

        if (existingBookings.length > 0) {
            res.status(400).json({ error: 'This person already has a booking on the target flight' });
            return;
        }

        // Count bookings on target flight
        const [countResult] = await pool.query(
            'SELECT COUNT(*) as count FROM bookings WHERE flight_id = ?',
            [target_flight_id]
        );

        const bookingCount = countResult[0].count;
        if (bookingCount >= targetFlight.aircraft_capacity) {
            res.status(400).json({ error: 'No available seats on the target flight' });
            return;
        }

        // Transfer booking
        await pool.query(
            'UPDATE bookings SET flight_id = ? WHERE id = ?',
            [target_flight_id, id]
        );

        const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Error transferring booking:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'This person already has a booking on the target flight' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
