const API_BASE_URL = 'https://api-iot-lxy7.onrender.com/api';

// **VERIFICACIÓN DE SESIÓN Y OBTENCIÓN DE TOKEN**
// CAMBIO: Leemos el token de la variable global que Django inyectó
const token = window.API_TOKEN;
if (!token) {
    console.error("Error: Token de autenticación no encontrado.");
    window.location.href = "/"; // Redirigir a la página de login de Django
}

// URL PARAMETER - Get the tank ID from the URL
let urlParams = new URLSearchParams(window.location.search);
let estanqueId = urlParams.get('id'); // Usamos 'let' para poder modificarlo

// Inicializar jsPDF (necesario para el módulo)
window.jsPDF = window.jspdf.jsPDF;

// Variables globales para el historial
let historialChart = null;
let currentData = [];
let historialDataLimit = 50;

// (Todas las funciones de ayuda se quedan igual)
// formatDisplayDate, formatDateForInput, setDefaultDates,
// updateDataTable, updateHistorialChart

function formatDisplayDate(date) { /* ... (código sin cambios) ... */ }
function formatDateForInput(date) { /* ... (código sin cambios) ... */ }
function setDefaultDates() { /* ... (código sin cambios) ... */ }
function updateDataTable(data) { /* ... (código sin cambios) ... */ }
function updateHistorialChart(data) { /* ... (código sin cambios) ... */ }
function formatDisplayDate(date) {
    const d = new Date(date);
    return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateForInput(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-CA');
}

// Configurar fechas por defecto (últimos 7 días)
function setDefaultDates() {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    document.getElementById("startDate").value = formatDateForInput(sevenDaysAgo);
    document.getElementById("endDate").value = formatDateForInput(today);
}

// Función para actualizar la tabla de datos
function updateDataTable(data) {
    const tableBody = document.querySelector("#dataTable tbody");
    const dataCount = document.getElementById("dataCount");
    dataCount.textContent = `${data.length} registros`;
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="no-data">No hay datos para el rango seleccionado</td></tr>';
        return;
    }

    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDisplayDate(item.timestamp)}</td>
            <td>${item.valores_sensores?.temperatura || 'N/A'}</td>
            <td>${item.valores_sensores?.solidos_disueltos || 'N/A'}</td>
            <td>${item.valores_sensores?.oxigeno || 'N/A'}</td>
            <td>${item.valores_sensores?.ph || 'N/A'}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Función para actualizar la gráfica de historial
function updateHistorialChart(data) {
    if (data.length === 0) {
        if (historialChart) {
            historialChart.data.labels = [];
            historialChart.data.datasets.forEach(dataset => dataset.data = []);
            historialChart.update();
        }
        return;
    }

    const etiquetas = data.map(d => formatDisplayDate(d.timestamp));
    const temperatura = data.map(d => d.valores_sensores?.temperatura || 0);
    const tds = data.map(d => d.valores_sensores?.solidos_disueltos || 0);
    const oxigeno = data.map(d => d.valores_sensores?.oxigeno || 0);
    const ph = data.map(d => d.valores_sensores?.ph || 0);

    const ctx = document.getElementById('grafica').getContext('2d');

    if (historialChart) {
        historialChart.data.labels = etiquetas;
        historialChart.data.datasets[0].data = temperatura;
        historialChart.data.datasets[1].data = tds;
        historialChart.data.datasets[2].data = oxigeno;
        historialChart.data.datasets[3].data = ph;
        historialChart.options.plugins.title.text = 'Datos Históricos de Calidad del Agua';
        historialChart.update();
    } else {
        historialChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: etiquetas,
                datasets: [
                    { label: 'Temperatura (°C)', data: temperatura, borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.2)', borderWidth: 2, tension: 0.3, fill: false },
                    { label: 'Sólidos Disueltos (TDS)', data: tds, borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.2)', borderWidth: 2, tension: 0.3, fill: false },
                    { label: 'Oxígeno (mg/L)', data: oxigeno, borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)', borderWidth: 2, tension: 0.3, fill: false },
                    { label: 'pH', data: ph, borderColor: 'rgba(153, 102, 255, 1)', backgroundColor: 'rgba(153, 102, 255, 0.2)', borderWidth: 2, tension: 0.3, fill: false }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Datos Históricos de Calidad del Agua', font: { size: 16 } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: { display: true, title: { display: true, text: 'Fecha y Hora' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Valores' } }
                },
                interaction: { intersect: false, mode: 'nearest' },
                animation: { duration: 1000 }
            }
        });
    }
}


// Función para obtener datos históricos de la API
async function getHistoricalData(startDate, endDate) {
    document.getElementById("status").innerHTML = '<div class="status-dot"></div><span>Cargando datos históricos...</span>';
    console.log('getHistoricalData called with:', { startDate, endDate });

    const params = new URLSearchParams();
    params.append('limit', historialDataLimit);

    if (startDate) {
        params.append('startDate', startDate.toISOString());
    }
    if (endDate) {
        params.append('endDate', endDate.toISOString());
    }

    try {
        // Se usa el ID del estanque en la URL
        const response = await fetch(`${API_BASE_URL}/sensor-readings/${estanqueId}?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // 'token' ahora viene de window.API_TOKEN
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                // CAMBIO: Redirigir al login de Django
                window.location.href = "/";
                throw new Error('Sesión expirada o no autorizada.');
            }
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al obtener los datos históricos.');
        }

        const data = await response.json();
        currentData = data.reverse(); // Invertir para orden cronológico
        updateHistorialChart(currentData);
        updateDataTable(currentData);
        document.getElementById("status").innerHTML = `<div class="status-dot historical"></div><span>Mostrando ${currentData.length} registros históricos</span>`;
        console.log('Data fetched:', currentData);

    } catch (error) {
        console.error("Error obteniendo datos históricos:", error);
        document.getElementById("status").innerHTML = `<div class="status-dot error"></div><span>Error: ${error.message}</span>`;
    }
}

// (Funciones de descarga se quedan igual)
function downloadExcel(data) { /* ... (código sin cambios) ... */ }
function downloadPDF(data) { /* ... (código sin cambios) ... */ }
function downloadExcel(data) {
    console.log('downloadExcel called with data:', data);
    if (data.length === 0) {
        alert('No hay datos para descargar en Excel.');
        return;
    }
    // ... (resto de la función sin cambios)
    const headers = ["Fecha y Hora", "Temperatura (°C)", "TDS (mg/L)", "Oxígeno (mg/L)", "pH"];
    const rows = data.map(item => [
        formatDisplayDate(item.timestamp),
        item.valores_sensores?.temperatura || '',
        item.valores_sensores?.solidos_disueltos || '',
        item.valores_sensores?.oxigeno || '',
        item.valores_sensores?.ph || ''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial de Datos");
    XLSX.writeFile(wb, "historial_datos.xlsx");
}

function downloadPDF(data) {
    console.log('downloadPDF called with data:', data);
    if (data.length === 0) {
        alert('No hay datos para descargar en PDF.');
        return;
    }
    // ... (resto de la función sin cambios)
    const doc = new jsPDF();
    const selectedParams = [];
    if (document.getElementById('paramTemperatura').checked) selectedParams.push({ key: 'temperatura', header: 'Temperatura (°C)' });
    if (document.getElementById('paramTDS').checked) selectedParams.push({ key: 'solidos_disueltos', header: 'TDS (mg/L)' });
    if (document.getElementById('paramOxigeno').checked) selectedParams.push({ key: 'oxigeno', header: 'Oxígeno (mg/L)' });
    if (document.getElementById('paramPH').checked) selectedParams.push({ key: 'ph', header: 'pH' });
    if (selectedParams.length === 0) {
        alert('Por favor, seleccione al menos un parámetro para descargar.');
        return;
    }
    const headers = [['Fecha y Hora', ...selectedParams.map(p => p.header)]];
    const rows = data.map(item => [
        formatDisplayDate(item.timestamp),
        ...selectedParams.map(p => item.valores_sensores?.[p.key] || 'N/A')
    ]);
    doc.autoTable({
        head: headers,
        body: rows,
        startY: 20,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save("historial_datos.pdf");
}


// (Funciones helper se quedan igual)
function populateTankDropdown(tanks, selectElement) { /* ... (código sin cambios) ... */ }
function hideChartAndTable() { /* ... (código sin cambios) ... */ }
function showChartAndTable() { /* ... (código sin cambios) ... */ }
function populateTankDropdown(tanks, selectElement) {
    selectElement.innerHTML = ''; // Limpiar opciones existentes
    if (tanks.length === 0) {
        selectElement.innerHTML = '<option value="">No hay estanques</option>';
        selectElement.disabled = true;
        return;
    }
    selectElement.innerHTML += '<option value="">-- Seleccione un estanque --</option>';
    tanks.forEach(tank => {
        if (tank._id) {
            const option = document.createElement('option');
            option.value = tank._id;
            option.textContent = tank.nombre || `Estanque ${tank._id}`;
            selectElement.appendChild(option);
        }
    });
}
function hideChartAndTable() {
    if (historialChart) {
        historialChart.data.labels = [];
        historialChart.data.datasets.forEach(dataset => dataset.data = []);
        historialChart.update();
    }
    document.getElementById('grafica').style.display = 'none';
    document.getElementById('dataTable').parentElement.style.display = 'none';
    document.getElementById('downloadOptionsBtn').style.display = 'none';
    document.getElementById("dataCount").textContent = "0 registros";
    document.querySelector("#dataTable tbody").innerHTML = '<tr><td colspan="5" class="no-data">No hay datos para mostrar</td></tr>';
}
function showChartAndTable() {
    document.getElementById('grafica').style.display = 'block';
    document.getElementById('dataTable').parentElement.style.display = 'block';
    document.getElementById('downloadOptionsBtn').style.display = 'block';
}


// CAMBIO: Se elimina el 'includeHTML' y se llama a la lógica directamente
document.addEventListener('DOMContentLoaded', async function () {
    setDefaultDates();
    // 'setActiveNavLink' ya no se llama aquí, está en menu.js

    const tankSelect = document.getElementById('tankSelect');

    try {
        const response = await fetch(`${API_BASE_URL}/tanks`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = "/"; // CAMBIO: Redirigir a Django login
                throw new Error('Sesión expirada o no autorizada.');
            }
            throw new Error('Error al obtener la lista de estanques.');
        }
        const allEstanques = await response.json();

        populateTankDropdown(allEstanques, tankSelect);

        // La lógica para seleccionar el estanque (desde URL o por defecto) se queda igual
        if (!estanqueId && allEstanques.length > 0) {
            const estanqueMasAntiguo = [...allEstanques].sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateA.getTime() - dateB.getTime();
            })[0];
            if (estanqueMasAntiguo && estanqueMasAntiguo._id) {
                estanqueId = estanqueMasAntiguo._id; // Usar el ID del estanque más antiguo
                tankSelect.value = estanqueMasAntiguo._id; // Seleccionar en el dropdown
            }
        }
        
        // Si el estanqueId vino de la URL, seleccionarlo en el dropdown
        if (estanqueId) {
            tankSelect.value = estanqueId;
        }

        if (!estanqueId) {
            document.getElementById("status").innerHTML = '<div class="status-dot error"></div><span>No hay estanques disponibles para mostrar el historial.</span>';
            hideChartAndTable();
            return; // Salir si no hay estanqueId
        }

        // Cargar datos históricos inicialmente
        const startDate = new Date(document.getElementById("startDate").value);
        const endDate = new Date(document.getElementById("endDate").value);
        endDate.setHours(23, 59, 59, 999);
        getHistoricalData(startDate, endDate);
        showChartAndTable(); // Asegurarse de que se muestren

    } catch (error) {
        console.error("Error al inicializar historial:", error);
        document.getElementById("status").innerHTML = `<div class="status-dot error"></div><span>Error al cargar historial: ${error.message}</span>`;
        hideChartAndTable();
        return; // Salir en caso de error
    }

    // (Todos los demás Event Listeners se quedan igual)
    tankSelect.addEventListener('change', function () {
        estanqueId = this.value; // Actualizar el ID del estanque seleccionado
        if (estanqueId) {
            const startDate = new Date(document.getElementById("startDate").value);
            const endDate = new Date(document.getElementById("endDate").value);
            endDate.setHours(23, 59, 59, 999);
            getHistoricalData(startDate, endDate);
            showChartAndTable();
        } else {
            document.getElementById("status").innerHTML = '<div class="status-dot error"></div><span>Seleccione un estanque.</span>';
            hideChartAndTable();
        }
    });

    document.getElementById("dataLimit").addEventListener('change', function () {
        historialDataLimit = parseInt(this.value);
        const startDate = new Date(document.getElementById("startDate").value);
        const endDate = new Date(document.getElementById("endDate").value);
        endDate.setHours(23, 59, 59, 999);
        getHistoricalData(startDate, endDate);
    });

    document.getElementById("applyDateRange").addEventListener('click', function () {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        if (!startDate || !endDate) {
            alert("Por favor, seleccione un rango de fechas.");
            return;
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        getHistoricalData(start, end);
    });

    document.getElementById("downloadOptionsBtn").addEventListener('click', function () {
        const optionsContainer = document.getElementById("downloadOptionsContainer");
        optionsContainer.style.display = optionsContainer.style.display === 'flex' ? 'none' : 'flex';
    });

    document.getElementById("downloadExcel").addEventListener('click', () => downloadExcel(currentData));
    document.getElementById("downloadPDF").addEventListener('click', () => downloadPDF(currentData));

});