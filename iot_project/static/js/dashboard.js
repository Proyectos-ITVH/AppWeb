document.addEventListener('DOMContentLoaded', function() {
    
    // ------------------------------------------------
    // 1. CONFIGURACIÓN Y REFERENCIAS
    // ------------------------------------------------
    const container = document.getElementById('dashboard-container');
    const alertOverlay = document.getElementById('alertOverlay');
    const alertDismissBtn = document.getElementById('alertDismissBtn');

    // Obtenemos la URL desde el HTML (Si no existe, devuelve null)
    const API_URL = container ? container.getAttribute('data-api-url') : null;

    // ------------------------------------------------
    // 2. FUNCIÓN PARA ACTUALIZAR SENSORES
    // ------------------------------------------------
    function actualizarDatos() {
        if (!API_URL) return; // Si no pusiste la URL en el HTML, no hace nada.

        fetch(API_URL)
            .then(response => {
                if (!response.ok) throw new Error('Error de red al obtener datos');
                return response.json();
            })
            .then(data => {
                // Actualizamos los valores y las clases de color (rojo/verde)
                updateValue('temp-actual', data.temperatura + ' °C', data.temp_status);
                updateValue('ph-actual', data.ph, data.ph_status);
                updateValue('tds-actual', data.solidos_disueltos + ' TDS', data.tds_status);
                updateValue('oxigeno-actual', data.oxigeno + ' mg/L', data.oxigeno_status);

                // Actualizamos la hora
                const timeElement = document.getElementById('last-update');
                if (timeElement) {
                    const ahora = new Date();
                    timeElement.textContent = ahora.toLocaleTimeString();
                }
            })
            .catch(error => console.error('Error actualizando dashboard:', error));
    }

    // Función auxiliar para escribir texto y cambiar color
    function updateValue(id, texto, claseEstado) {
        const el = document.getElementById(id);
        if (el) {
            if (texto !== undefined) el.innerText = texto;
            // Si la API manda clase de estado (ej: 'text-danger'), la aplicamos
            if (claseEstado) el.className = `dashboard-value ${claseEstado}`;
        }
    }

    // ------------------------------------------------
    // 3. EVENTOS
    // ------------------------------------------------

    // Botón para cerrar la alerta
    if (alertOverlay && alertDismissBtn) {
        alertDismissBtn.addEventListener('click', () => {
            alertOverlay.classList.remove('active');
        });
    }

    // Iniciar actualización automática (cada 5 segundos)
    if (API_URL) {
        actualizarDatos(); // Primera carga inmediata
        setInterval(actualizarDatos, 5000); 
    }
});