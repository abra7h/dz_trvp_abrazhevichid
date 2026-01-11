const API_BASE_URL = '/api';

let flights = [];
let aircraft = [];
let currentFlightId = null;
let currentBookingId = null;

// DOM Elements
const flightsList = document.getElementById('flightsList');
const addFlightBtn = document.getElementById('addFlightBtn');
const flightModal = document.getElementById('flightModal');
const bookingModal = document.getElementById('bookingModal');
const transferModal = document.getElementById('transferModal');
const flightForm = document.getElementById('flightForm');
const bookingForm = document.getElementById('bookingForm');
const transferForm = document.getElementById('transferForm');
const notification = document.getElementById('notification');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadAircraft();
    loadFlights();
    setupEventListeners();
});

// Event Listeners Setup
function setupEventListeners() {
    // Flight modal
    addFlightBtn.addEventListener('click', () => openFlightModal());
    document.querySelector('#flightModal .close').addEventListener('click', () => closeFlightModal());
    document.getElementById('cancelFlightBtn').addEventListener('click', () => closeFlightModal());
    flightForm.addEventListener('submit', handleFlightSubmit);

    // Booking modal
    document.getElementById('closeBookingModal').addEventListener('click', () => closeBookingModal());
    document.getElementById('cancelBookingBtn').addEventListener('click', () => closeBookingModal());
    bookingForm.addEventListener('submit', handleBookingSubmit);

    // Transfer modal
    document.getElementById('closeTransferModal').addEventListener('click', () => closeTransferModal());
    document.getElementById('cancelTransferBtn').addEventListener('click', () => closeTransferModal());
    transferForm.addEventListener('submit', handleTransferSubmit);

    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target === flightModal) closeFlightModal();
        if (e.target === bookingModal) closeBookingModal();
        if (e.target === transferModal) closeTransferModal();
    });
}

// API Functions
async function loadAircraft() {
    try {
        const response = await fetch(`${API_BASE_URL}/aircraft`);
        if (!response.ok) throw new Error('Failed to load aircraft');
        aircraft = await response.json();
        populateAircraftSelect();
    } catch (error) {
        showNotification('Ошибка загрузки списка самолетов', 'error');
        console.error(error);
    }
}

async function loadFlights() {
    try {
        const response = await fetch(`${API_BASE_URL}/flights`);
        if (!response.ok) throw new Error('Failed to load flights');
        flights = await response.json();
        renderFlights();
    } catch (error) {
        showNotification('Ошибка загрузки рейсов', 'error');
        console.error(error);
    }
}

async function loadBookingsForFlight(flightId) {
    try {
        const response = await fetch(`${API_BASE_URL}/flights/${flightId}/bookings`);
        if (!response.ok) throw new Error('Failed to load bookings');
        return await response.json();
    } catch (error) {
        showNotification('Ошибка загрузки броней', 'error');
        console.error(error);
        return [];
    }
}

// Render Functions
function renderFlights() {
    if (flights.length === 0) {
        flightsList.innerHTML = '<div class="empty-state"><h3>Нет рейсов</h3><p>Добавьте первый рейс, чтобы начать работу</p></div>';
        return;
    }

    flightsList.innerHTML = flights.map(flight => `
        <div class="flight-card" data-flight-id="${flight.id}">
            <div class="flight-header">
                <div class="flight-info">
                    <div class="flight-id">ID: ${flight.id}</div>
                    <div class="flight-destination">${escapeHtml(flight.destination)}</div>
                    <div class="flight-details">
                        <span>✈️ ${escapeHtml(flight.aircraft_name)}</span>
                        <span>📅 ${formatDateTime(flight.departure_date)}</span>
                        <span>💺 Вместимость: ${flight.aircraft_capacity}</span>
                    </div>
                </div>
                <div class="flight-actions">
                    <button class="btn btn-sm btn-success" onclick="openBookingModal('${flight.id}')">Добавить бронь</button>
                    <button class="btn btn-sm btn-primary" onclick="openFlightModal('${flight.id}')">Редактировать</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteFlight('${flight.id}')">Удалить</button>
                </div>
            </div>
            <div class="bookings-section" id="bookings-${flight.id}">
                <div class="bookings-header">
                    <h3>Брони</h3>
                </div>
                <div class="bookings-list" id="bookings-list-${flight.id}">
                    <div class="empty-state" style="padding: 20px;">
                        <p>Загрузка...</p>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Load bookings for each flight
    flights.forEach(flight => {
        loadBookingsForFlight(flight.id).then(bookings => {
            renderBookings(flight.id, bookings, flight.aircraft_capacity);
        });
    });
}

function renderBookings(flightId, bookings, capacity) {
    const bookingsList = document.getElementById(`bookings-list-${flightId}`);
    if (!bookingsList) return;

    const bookedSeats = bookings.length;
    const availableSeats = capacity - bookedSeats;

    if (bookings.length === 0) {
        bookingsList.innerHTML = '<div class="empty-state" style="padding: 20px;"><p>Нет броней</p></div>';
        return;
    }

    bookingsList.innerHTML = bookings.map(booking => `
        <div class="booking-item">
            <div class="booking-info">
                <div class="booking-name">${escapeHtml(booking.booker_name)}</div>
                <div class="booking-id">ID: ${booking.id}</div>
            </div>
            <div class="booking-actions">
                <button class="btn btn-sm btn-primary" onclick="openBookingModal('${flightId}', '${booking.id}')">Редактировать</button>
                <button class="btn btn-sm btn-success" onclick="openTransferModal('${booking.id}', '${flightId}')">Перенести</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBooking('${booking.id}', '${flightId}')">Удалить</button>
            </div>
        </div>
    `).join('');

    // Add seats info
    const bookingsHeader = bookingsList.parentElement.querySelector('.bookings-header');
    if (bookingsHeader) {
        const existingInfo = bookingsHeader.querySelector('.seats-info');
        if (existingInfo) existingInfo.remove();
        const seatsInfo = document.createElement('div');
        seatsInfo.className = `seats-info ${availableSeats === 0 ? 'full' : ''}`;
        seatsInfo.textContent = `Забронировано: ${bookedSeats} / ${capacity} мест`;
        bookingsHeader.appendChild(seatsInfo);
    }
}

// Flight Modal Functions
function openFlightModal(flightId = null) {
    const modal = document.getElementById('flightModal');
    const form = document.getElementById('flightForm');
    const title = document.getElementById('modalTitle');

    currentFlightId = flightId;

    if (flightId) {
        title.textContent = 'Редактировать рейс';
        const flight = flights.find(f => f.id === flightId);
        if (flight) {
            document.getElementById('flightId').value = flight.id;
            document.getElementById('departureDate').value = formatDateTimeLocal(flight.departure_date);
            document.getElementById('destination').value = flight.destination;
            document.getElementById('aircraft').value = flight.aircraft_id;
        }
    } else {
        title.textContent = 'Добавить рейс';
        form.reset();
        document.getElementById('flightId').value = '';
    }

    populateAircraftSelect();
    modal.style.display = 'block';
}

function closeFlightModal() {
    flightModal.style.display = 'none';
    flightForm.reset();
    currentFlightId = null;
}

async function handleFlightSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const flightData = {
        departure_date: formData.get('departureDate'),
        destination: formData.get('destination'),
        aircraft_id: formData.get('aircraft')
    };

    const flightId = formData.get('id');
    const url = flightId ? `${API_BASE_URL}/flights/${flightId}` : `${API_BASE_URL}/flights`;
    const method = flightId ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(flightData)
        });

        const data = await response.json();

        if (!response.ok) {
            showNotification(data.error || 'Ошибка сохранения рейса', 'error');
            return;
        }

        showNotification(flightId ? 'Рейс обновлен' : 'Рейс добавлен', 'success');
        closeFlightModal();
        loadFlights();
    } catch (error) {
        showNotification('Ошибка при сохранении рейса', 'error');
        console.error(error);
    }
}

// Booking Modal Functions
async function openBookingModal(flightId, bookingId = null) {
    const modal = document.getElementById('bookingModal');
    const form = document.getElementById('bookingForm');
    const title = document.getElementById('bookingModalTitle');

    currentBookingId = bookingId;
    document.getElementById('bookingFlightId').value = flightId;

    if (bookingId) {
        title.textContent = 'Редактировать бронь';
        try {
            const response = await fetch(`${API_BASE_URL}/bookings`);
            if (response.ok) {
                const bookings = await response.json();
                const booking = bookings.find(b => b.id === bookingId);
                if (booking) {
                    document.getElementById('bookingId').value = booking.id;
                    document.getElementById('bookerName').value = booking.booker_name;
                }
            }
        } catch (error) {
            console.error(error);
        }
    } else {
        title.textContent = 'Добавить бронь';
        form.reset();
        document.getElementById('bookingId').value = '';
        document.getElementById('bookingFlightId').value = flightId;
    }

    modal.style.display = 'block';
}

function closeBookingModal() {
    bookingModal.style.display = 'none';
    bookingForm.reset();
    currentBookingId = null;
}

async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const bookingId = formData.get('id');
    const flightId = formData.get('flightId');
    const bookingData = {
        flight_id: flightId,
        booker_name: formData.get('bookerName')
    };

    const url = bookingId ? `${API_BASE_URL}/bookings/${bookingId}` : `${API_BASE_URL}/bookings`;
    const method = bookingId ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });

        const data = await response.json();

        if (!response.ok) {
            showNotification(data.error || 'Ошибка сохранения брони', 'error');
            return;
        }

        showNotification(bookingId ? 'Бронь обновлена' : 'Бронь добавлена', 'success');
        closeBookingModal();
        
        // Reload bookings for the flight
        const flight = flights.find(f => f.id === flightId);
        if (flight) {
            const bookings = await loadBookingsForFlight(flightId);
            renderBookings(flightId, bookings, flight.aircraft_capacity);
        }
    } catch (error) {
        showNotification('Ошибка при сохранении брони', 'error');
        console.error(error);
    }
}

// Transfer Modal Functions
async function openTransferModal(bookingId, currentFlightId) {
    const modal = document.getElementById('transferModal');
    const select = document.getElementById('transferFlight');
    
    currentBookingId = bookingId;
    document.getElementById('transferBookingId').value = bookingId;

    // Get current flight to filter by destination
    const currentFlight = flights.find(f => f.id === currentFlightId);
    if (!currentFlight) {
        showNotification('Ошибка: рейс не найден', 'error');
        return;
    }

    // Populate select with flights that have the same destination
    const sameDestinationFlights = flights.filter(f => 
        f.destination === currentFlight.destination && f.id !== currentFlightId
    );

    select.innerHTML = '<option value="">Выберите рейс</option>' + 
        sameDestinationFlights.map(flight => `
            <option value="${flight.id}">
                ${escapeHtml(flight.destination)} - ${formatDateTime(flight.departure_date)} (${escapeHtml(flight.aircraft_name)})
            </option>
        `).join('');

    modal.style.display = 'block';
}

function closeTransferModal() {
    transferModal.style.display = 'none';
    transferForm.reset();
    currentBookingId = null;
}

async function handleTransferSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const bookingId = formData.get('bookingId');
    const targetFlightId = formData.get('targetFlightId');

    if (!targetFlightId) {
        showNotification('Выберите рейс для переноса', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_flight_id: targetFlightId })
        });

        const data = await response.json();

        if (!response.ok) {
            showNotification(data.error || 'Ошибка переноса брони', 'error');
            return;
        }

        showNotification('Бронь успешно перенесена', 'success');
        closeTransferModal();
        loadFlights();
    } catch (error) {
        showNotification('Ошибка при переносе брони', 'error');
        console.error(error);
    }
}

// Delete Functions
async function deleteFlight(flightId) {
    if (!confirm('Вы уверены, что хотите удалить этот рейс? Все брони будут удалены.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/flights/${flightId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const data = await response.json();
            showNotification(data.error || 'Ошибка удаления рейса', 'error');
            return;
        }

        showNotification('Рейс удален', 'success');
        loadFlights();
    } catch (error) {
        showNotification('Ошибка при удалении рейса', 'error');
        console.error(error);
    }
}

async function deleteBooking(bookingId, flightId) {
    if (!confirm('Вы уверены, что хотите удалить эту бронь?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const data = await response.json();
            showNotification(data.error || 'Ошибка удаления брони', 'error');
            return;
        }

        showNotification('Бронь удалена', 'success');
        
        // Reload bookings for the flight
        const flight = flights.find(f => f.id === flightId);
        if (flight) {
            const bookings = await loadBookingsForFlight(flightId);
            renderBookings(flightId, bookings, flight.aircraft_capacity);
        }
    } catch (error) {
        showNotification('Ошибка при удалении брони', 'error');
        console.error(error);
    }
}

// Helper Functions
function populateAircraftSelect() {
    const select = document.getElementById('aircraft');
    select.innerHTML = '<option value="">Выберите самолет</option>' +
        aircraft.map(ac => `<option value="${ac.id}">${ac.name} (${ac.capacity} мест)</option>`).join('');
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateTimeLocal(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}
