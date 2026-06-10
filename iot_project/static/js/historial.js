const API_BASE_URL = 'https://api-iot-lxy7.onrender.com/api';
const token = window.API_TOKEN;

let chartInstance = null;
let currentRawData = [];

if (!token) {
    window.location.href = "/";
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargamos la lista de estanques primero
    await cargarEstanquesEnSelect();

    // 2. LA MAGIA DE LA TELETRANSPORTACIÓN
    // Leemos si la URL trae un parámetro "?estanque=..."
    const params = new URLSearchParams(window.location.search);
    const estanqueIdUrl = params.get('estanque');
    
    // Si traemos un estanque desde la pantalla de Informes, lo seleccionamos automáticamente
    if (estanqueIdUrl) {
        const select = document.getElementById('tankSelect');
        if (select) {
            select.value = estanqueIdUrl;
            consultarHistorial(); // Simulamos el clic en el botón de consultar
        }
    }

    // 3. Configuración de eventos de los botones
    const btnAplicar = document.getElementById('applyDateRange');
    if (btnAplicar) btnAplicar.addEventListener('click', consultarHistorial);

    const btnExcel = document.getElementById('downloadExcel');
    if (btnExcel) btnExcel.addEventListener('click', descargarExcel);

    // Activamos el nuevo botón de PDF
    const btnPDF = document.getElementById('downloadPDF');
    if (btnPDF) btnPDF.addEventListener('click', descargarPDF);
});

async function cargarEstanquesEnSelect() {
    const select = document.getElementById('tankSelect');
    if (!select) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tanks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Error al obtener estanques");
        
        const estanques = await response.json();
        select.innerHTML = '<option value="">-- Seleccione un estanque --</option>';
        
        estanques.forEach(estanque => {
            if (estanque._id) {
                const option = document.createElement('option');
                option.value = estanque._id;
                option.textContent = estanque.nombre || `Estanque ${estanque._id.substring(0,6)}`;
                select.appendChild(option);
            }
        });
    } catch (error) {
        console.error(error);
        select.innerHTML = '<option value="">Error de conexión</option>';
    }
}

async function consultarHistorial() {
    const tankId = document.getElementById('tankSelect').value;
    const limit = document.getElementById('dataLimit').value;
    const statusEl = document.getElementById('status');
    
    // Obtener fechas
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!tankId) {
        if (statusEl) {
            statusEl.textContent = 'Por favor, seleccione un estanque primero.';
            statusEl.style.color = '#e74c3c';
        }
        return;
    }

    if (statusEl) {
        statusEl.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Consultando base de datos...';
        statusEl.style.color = 'var(--text-muted)';
    }

    try {
        // Construimos la URL. Agregamos el límite y si hay fechas, las mandamos.
        let url = `${API_BASE_URL}/sensor-readings/${tankId}?limit=${limit}`;
        if (startDate && endDate) {
            url += `&startDate=${startDate}&endDate=${endDate}`;
        }

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Error al consultar las lecturas.");

        let data = await response.json();
        
        // Invertimos para que los datos más antiguos salgan primero en la gráfica (de izquierda a derecha)
        data = data.reverse(); 
        currentRawData = data;

        actualizarTabla(data);
        actualizarGrafica(data);

        if (statusEl) {
            statusEl.textContent = `Consulta exitosa. Se recuperaron ${data.length} registros.`;
            statusEl.style.color = '#27ae60';
        }

        // Mostrar botones de Excel y PDF si hay datos
        const btnExcel = document.getElementById('downloadExcel');
        if (btnExcel) btnExcel.style.display = data.length > 0 ? 'block' : 'none';
        
        const btnPDF = document.getElementById('downloadPDF');
        if (btnPDF) btnPDF.style.display = data.length > 0 ? 'block' : 'none';

    } catch (error) {
        console.error(error);
        if (statusEl) {
            statusEl.textContent = 'Error al recuperar los datos del servidor.';
            statusEl.style.color = '#e74c3c';
        }
    }
}

function actualizarTabla(data) {
    const tbody = document.getElementById('dataTableBody');
    const dataCount = document.getElementById('dataCount');
    if (!tbody) return;

    if (dataCount) dataCount.textContent = `${data.length} registros`;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No se encontraron datos en este rango.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    
    // Mostramos los datos en orden inverso en la tabla (los más recientes arriba)
    const dataReversa = [...data].reverse();

    dataReversa.forEach(row => {
        const tr = document.createElement('tr');
        const fecha = new Date(row.timestamp).toLocaleString('es-ES');
        const v = row.valores_sensores || {};

        tr.innerHTML = `
            <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${fecha}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${v.temperatura !== undefined ? v.temperatura : '--'}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${v.ph !== undefined ? v.ph : '--'}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${v.solidos_disueltos !== undefined ? v.solidos_disueltos : '--'}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${v.oxigeno !== undefined ? v.oxigeno : '--'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function actualizarGrafica(data) {
    const ctx = document.getElementById('grafica');
    if (!ctx) return;

    const labels = data.map(d => new Date(d.timestamp));
    const temps = data.map(d => d.valores_sensores ? d.valores_sensores.temperatura : null);
    const phs = data.map(d => d.valores_sensores ? d.valores_sensores.ph : null);

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temperatura (°C)',
                    data: temps,
                    borderColor: '#e74c3c',
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'pH',
                    data: phs,
                    borderColor: '#3498db',
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        displayFormats: { hour: 'dd MMM HH:mm' }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function descargarExcel() {
    if (currentRawData.length === 0) return;

    const datosExcel = currentRawData.map(row => {
        const v = row.valores_sensores || {};
        return {
            "Fecha y Hora": new Date(row.timestamp).toLocaleString('es-ES'),
            "Temperatura (°C)": v.temperatura || '',
            "pH": v.ph || '',
            "TDS (ppm)": v.solidos_disueltos || '',
            "Oxígeno (mg/L)": v.oxigeno || ''
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial_Crudo");

    XLSX.writeFile(workbook, "Bitacora_AcuaTech.xlsx");
}

function descargarPDF() {
    if (currentRawData.length === 0) return;
    
    // Iniciamos jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Obtenemos el nombre del estanque para el título
    const tankSelect = document.getElementById('tankSelect');
    const tankName = tankSelect.options[tankSelect.selectedIndex].text;

    // Ponemos el título en el PDF
    doc.text(`Bitácora de Datos Crudos - ${tankName}`, 14, 15);
    
    // Armamos la tabla
    const tableColumn = ["Fecha y Hora", "Temp (°C)", "pH", "TDS (ppm)", "Oxígeno (mg/L)"];
    const tableRows = [];

    // Usamos los datos invertidos para que los más recientes salgan arriba
    const dataReversa = [...currentRawData].reverse();

    dataReversa.forEach(row => {
        const v = row.valores_sensores || {};
        const rowData = [
            new Date(row.timestamp).toLocaleString('es-ES'),
            v.temperatura !== undefined ? v.temperatura : '--',
            v.ph !== undefined ? v.ph : '--',
            v.solidos_disueltos !== undefined ? v.solidos_disueltos : '--',
            v.oxigeno !== undefined ? v.oxigeno : '--'
        ];
        tableRows.push(rowData);
    });

    // Dibujamos la tabla en el PDF
    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
    });

    // Guardamos y descargamos
    doc.save(`Bitacora_${tankName.replace(/\s+/g, '_')}.pdf`);
}