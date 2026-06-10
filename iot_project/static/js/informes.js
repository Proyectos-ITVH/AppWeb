const API_BASE_URL = 'https://api-iot-lxy7.onrender.com/api';
const token = window.API_TOKEN;

if (!token) {
    window.location.href = "/";
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar estanques al entrar a la página
    cargarEstanquesParaInformes();

    // 2. Configurar el botón de Filtrar
    const btnFiltrar = document.getElementById('btnFiltrar');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', () => {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;

            if (!fechaInicio || !fechaFin) {
                mostrarNotificacion("Por favor, selecciona ambas fechas para filtrar.", "warning");
                return;
            }
            if (new Date(fechaInicio) > new Date(fechaFin)) {
                mostrarNotificacion("La fecha de inicio no puede ser mayor a la de fin.", "error");
                return;
            }

            // Si las fechas están bien, cargamos los reportes de esos días
            cargarEstanquesParaInformes(fechaInicio, fechaFin);
        });
    }

    // 3. Configurar el botón de Limpiar
    const btnLimpiar = document.getElementById('btnLimpiar');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            document.getElementById('fechaInicio').value = '';
            document.getElementById('fechaFin').value = '';

            // Ocultamos los botones de descarga si se limpia el filtro
            const downloadOptions = document.getElementById('downloadOptionsContainer');
            if (downloadOptions) downloadOptions.style.display = 'none';

            cargarEstanquesParaInformes();
        });
    }
});

async function cargarEstanquesParaInformes(fechaInicio = null, fechaFin = null) {
    // ¡AQUÍ ESTÁ LA MAGIA! Buscamos el ID correcto de esta pantalla
    const contenedor = document.getElementById('lista-estanques');
    const downloadOptions = document.getElementById('downloadOptionsContainer');

    if (!contenedor) return;

    contenedor.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 2rem;"><i class="fas fa-circle-notch fa-spin"></i> Obteniendo reportes...</p>';

    try {
        // Obtenemos los estanques
        const resTanks = await fetch(`${API_BASE_URL}/tanks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!resTanks.ok) throw new Error("No se pudieron obtener los estanques.");
        const estanques = await resTanks.json();

        if (estanques.length === 0) {
            contenedor.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 2rem;">No hay estanques registrados para generar reportes.</p>';
            return;
        }

        contenedor.innerHTML = '';

        // Dibujamos las tarjetas de reporte para cada estanque
        for (const estanque of estanques) {

            // Obtenemos su lectura más reciente para el reporte rápido
            const resReadings = await fetch(`${API_BASE_URL}/sensor-readings/${estanque._id}?limit=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let lecturas = [];
            if (resReadings.ok) {
                lecturas = await resReadings.json();
            }

            const ultimaLectura = lecturas.length > 0 ? lecturas[0].valores_sensores : null;
            const timestamp = lecturas.length > 0 ? new Date(lecturas[0].timestamp).toLocaleString('es-ES') : 'Sin registros';

            const card = document.createElement('div');
            card.className = 'card estanque-card'; // Aprovechamos las clases CSS que ya tienes
            card.style.padding = '15px';
            card.style.border = '1px solid var(--border-color)';
            card.style.borderRadius = '8px';

            card.innerHTML = `
                <div style="border-bottom: 1px solid var(--border-color); margin-bottom: 15px; padding-bottom: 10px;">
                    <h4 style="margin: 0; color: var(--primary-color);">
                        <i class="fas fa-chart-line"></i> Reporte: ${estanque.nombre || 'Estanque ' + estanque._id.substring(0, 6)}
                    </h4>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                    <div><strong><i class="fas fa-temperature-high"></i> Temp:</strong> ${ultimaLectura ? ultimaLectura.temperatura + ' °C' : '--'}</div>
                    <div><strong><i class="fas fa-vial"></i> pH:</strong> ${ultimaLectura ? ultimaLectura.ph : '--'}</div>
                    <div><strong><i class="fas fa-wind"></i> Oxígeno:</strong> ${ultimaLectura ? ultimaLectura.oxigeno + ' mg/L' : '--'}</div>
                    <div><strong><i class="fas fa-tint"></i> TDS:</strong> ${ultimaLectura ? ultimaLectura.solidos_disueltos + ' ppm' : '--'}</div>
                </div>
                <div style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 15px;">
                    <i class="fas fa-clock"></i> Último dato registrado: ${timestamp}
                </div>
                // Reemplaza el botón viejo por este:
                <button class="btn-primary" style="width: 100%;" onclick="window.location.href='/historial/?estanque=${estanque._id}'">
                <i class="fas fa-list"></i> Ver Historial Completo
                </button>
            `;
            contenedor.appendChild(card);
        }

        // Si el usuario aplicó un filtro, mostramos los botones de descarga de PDF/Excel
        if (fechaInicio && fechaFin && downloadOptions) {
            downloadOptions.style.display = 'flex';
            mostrarNotificacion(`Reportes filtrados del ${fechaInicio} al ${fechaFin}`, "success");
        }

    } catch (error) {
        console.error(error);
        contenedor.innerHTML = `<div class="message error" style="display:block; grid-column: 1/-1;">Error al cargar los informes: ${error.message}</div>`;
    }
}

// Función genérica para mostrar notificaciones flotantes
function mostrarNotificacion(mensaje, tipo) {
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.innerHTML = `
        <i class="fas ${tipo === 'success' ? 'fa-check-circle' : (tipo === 'warning' ? 'fa-exclamation-triangle' : 'fa-exclamation-circle')}"></i>
        <span>${mensaje}</span>
    `;
    document.body.appendChild(notificacion);

    setTimeout(() => { notificacion.classList.add('show'); }, 10);
    setTimeout(() => {
        notificacion.classList.remove('show');
        setTimeout(() => { notificacion.remove(); }, 300);
    }, 3000);
}