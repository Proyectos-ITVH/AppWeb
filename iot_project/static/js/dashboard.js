document.addEventListener('DOMContentLoaded', function() {
    
    // ------------------------------------------------
    // 1. REFERENCIAS DEL CONTENEDOR DE ALERTAS
    // ------------------------------------------------
    const container = document.getElementById('dashboard-container');
    const alertOverlay = document.getElementById('alertOverlay');
    const alertDismissBtn = document.getElementById('alertDismissBtn');
    const alertParametersContainer = document.getElementById('alert-parameters-container');
    let alertaSilenciada = false;
    let timerSilencio = null;

    const API_URL = container ? container.getAttribute('data-api-url') : null;

    // ------------------------------------------------
    // 2. FUNCIÓN DE REFRESCO MULTI-ESTANQUE EN VIVO
    // ------------------------------------------------
    function actualizarDatos() {
        if (!API_URL) return;

        fetch(API_URL)
            .then(response => {
                if (!response.ok) throw new Error('Error de red al obtener datos');
                return response.json();
            })
            .then(data => {
                // 1. Actualizar los números de todos los estanques
                if (data.estanques && data.estanques.length > 0) {
                    data.estanques.forEach(estanque => {
                        updateValue(`temp-${estanque.id}`, estanque.temperatura + ' °C', estanque.temp_status);
                        updateValue(`ph-${estanque.id}`, estanque.ph, estanque.ph_status);
                        updateValue(`tds-${estanque.id}`, estanque.solidos_disueltos + ' TDS', estanque.tds_status);
                        updateValue(`oxigeno-${estanque.id}`, estanque.oxigeno + ' mg/L', estanque.oxigeno_status);
                    });
                }

                // 2. CONTROL DE ALERTAS
                if (data.problems && data.problems.length > 0 && alertOverlay && alertParametersContainer) {
                    if (!alertaSilenciada) {
                        // Hay problemas y no está silenciada → mostrar
                        alertParametersContainer.innerHTML = '';
                        data.problems.forEach(prob => {
                            const div = document.createElement('div');
                            div.className = 'parameter-item';
                            div.innerHTML = `<span>[${prob.tank_name}] ${prob.name}:</span> <strong>${prob.value}</strong>`;
                            alertParametersContainer.appendChild(div);
                        });
                        alertOverlay.classList.add('active');
                    }
                    // Si está silenciada, esperamos a que expire el timer
                } else if (alertOverlay) {
                    // No hay problemas → cerrar modal y cancelar silencio
                    alertOverlay.classList.remove('active');
                    alertaSilenciada = false;
                    if (timerSilencio) clearTimeout(timerSilencio);
                }

                // 3. Actualizar reloj
                const timeElement = document.getElementById('last-update');
                if (timeElement) {
                    const ahora = new Date();
                    timeElement.textContent = ahora.toLocaleTimeString('es-ES');
                }
            })
            .catch(error => console.error('Error actualizando dashboard:', error));
    }

    // ------------------------------------------------
    // 3. AUXILIAR DE RENDERIZADO
    // ------------------------------------------------
    function updateValue(id, texto, claseEstado) {
        const el = document.getElementById(id);
        if (el) {
            const textoStr = texto !== undefined && texto !== null ? String(texto) : '--';
            
            if (!textoStr.includes('undefined') && !textoStr.includes('null')) {
                if (el.innerText !== textoStr) el.innerText = textoStr;
            } else {
                el.innerText = "--";
            }
            el.className = claseEstado ? `dashboard-value ${claseEstado}` : `dashboard-value`;
        }
    }

    // ------------------------------------------------
    // 4. BOTÓN ENTENDIDO — silencia 1 minuto (prueba)
    // ------------------------------------------------
    if (alertOverlay && alertDismissBtn) {
        alertDismissBtn.addEventListener('click', () => {
            alertOverlay.classList.remove('active');
            alertaSilenciada = true;

            if (timerSilencio) clearTimeout(timerSilencio);

            timerSilencio = setTimeout(() => {
                alertaSilenciada = false;
            }, 1 * 60 * 1000); // ← Cambia a 5 * 60 * 1000 cuando confirmes que funciona
        });
    }

    // ------------------------------------------------
    // 5. ARRANQUE
    // ------------------------------------------------
    if (API_URL) {
        actualizarDatos();
        setInterval(actualizarDatos, 5000);
    }
});