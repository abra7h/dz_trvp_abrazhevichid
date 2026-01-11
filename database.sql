DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS aircraft;


CREATE TABLE aircraft (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    INDEX idx_id (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE flights (
    id VARCHAR(50) PRIMARY KEY,
    departure_date DATETIME NOT NULL,
    destination VARCHAR(100) NOT NULL,
    aircraft_id VARCHAR(50) NOT NULL,
    INDEX idx_departure_date (departure_date),
    INDEX idx_destination (destination),
    INDEX idx_aircraft (aircraft_id),
    UNIQUE KEY unique_flight (destination, departure_date),
    FOREIGN KEY (aircraft_id) REFERENCES aircraft(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE bookings (
    id VARCHAR(50) PRIMARY KEY,
    flight_id VARCHAR(50) NOT NULL,
    booker_name VARCHAR(200) NOT NULL,
    INDEX idx_flight_id (flight_id),
    INDEX idx_booker_name (booker_name),
    UNIQUE KEY unique_booking_per_person (flight_id, booker_name),
    FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DELETE FROM bookings;
DELETE FROM flights;
DELETE FROM aircraft;


INSERT INTO aircraft (id, name, capacity) VALUES
('AC001', 'Boeing 737', 150),
('AC002', 'Airbus A320', 180),
('AC003', 'Boeing 787', 250),
('AC004', 'Airbus A350', 300);


INSERT INTO flights (id, departure_date, destination, aircraft_id) VALUES
('FL_test_001', '2026-01-20 08:30:00', 'Москва', 'AC001'),
('FL_test_002', '2026-01-20 14:20:00', 'Санкт-Петербург', 'AC002'),
('FL_test_003', '2026-01-22 10:00:00', 'Москва', 'AC003'),
('FL_test_004', '2026-01-23 16:45:00', 'Сочи', 'AC001'),
('FL_test_005', '2026-01-25 09:15:00', 'Санкт-Петербург', 'AC004');


INSERT INTO bookings (id, flight_id, booker_name) VALUES
('BK_test_001', 'FL_test_001', 'Иванов Иван Иванович'),
('BK_test_002', 'FL_test_001', 'Петрова Мария Сергеевна'),
('BK_test_003', 'FL_test_001', 'Сидоров Алексей Петрович'),
('BK_test_004', 'FL_test_002', 'Козлова Анна Владимировна'),
('BK_test_005', 'FL_test_002', 'Морозов Дмитрий Александрович'),
('BK_test_006', 'FL_test_003', 'Новикова Елена Игоревна'),
('BK_test_007', 'FL_test_003', 'Волков Сергей Николаевич'),
('BK_test_008', 'FL_test_004', 'Лебедева Ольга Михайловна'),
('BK_test_009', 'FL_test_005', 'Соколов Павел Андреевич'),
('BK_test_010', 'FL_test_005', 'Попова Татьяна Валерьевна');
