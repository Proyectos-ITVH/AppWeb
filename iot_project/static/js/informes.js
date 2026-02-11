// URL base de tu API (se queda igual)
const API_BASE_URL = 'https://api-iot-lxy7.onrender.com/api';

// --- CAMBIOS CRÍTICOS ---
// 1. Leemos el token y el rol de las variables globales que Django inyectó
const token = window.API_TOKEN;
const currentUserRole = window.USER_ROLE;

// 2. Se elimina la lógica de 'localStorage' y 'includeHTML'
// -------------------------


// **LÓGICA PARA OBTENER Y PROCESAR DATOS DE LA API**

// Función para obtener la última lectura de un estanque específico
async function getLatestReadingForTank(estanqueId) {
    if (!estanqueId) {
        console.error("Error: estanqueId es undefined.");
        return null;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/sensor-readings/${estanqueId}?limit=1`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`No se encontraron lecturas para el estanque ${estanqueId}.`);
                return null;
            }
            // Si el token expira, redirigir
            if (response.status === 401 || response.status === 403) {
                window.location.href = "/"; // Redirige al login de Django
            }
            const errorData = await response.json();
            throw new Error(errorData.message || `Error al obtener lecturas.`);
        }
        const readings = await response.json();
        return readings[0] || null;
    } catch (error) {
        console.error(`Error al obtener lecturas del estanque ${estanqueId}:`, error);
        return null;
    }
}

// Función principal para obtener y renderizar todos los estanques
async function obtenerDatosEstanques() {
    const btnActualizar = document.getElementById('btn-actualizar');
    btnActualizar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Actualizando...';
    btnActualizar.disabled = true;

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
                window.location.href = "/"; // Redirige al login de Django
            }
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al obtener los estanques.');
        }

        const estanques = await response.json();

        const estanquesConLecturas = await Promise.all(estanques.map(async (estanque) => {
            if (!estanque._id) {
                console.warn("Estanque sin _id detectado:", estanque);
                return null;
            }
            const ultimaLectura = await getLatestReadingForTank(estanque._id);
            const activo = ultimaLectura && (new Date() - new Date(ultimaLectura.timestamp)) / (1000 * 60 * 60) <= 24;
            return {
                ...estanque,
                id: estanque._id,
                ultimaLectura: ultimaLectura ? ultimaLectura.valores_sensores : null,
                ultimaActualizacion: ultimaLectura ? new Date(ultimaLectura.timestamp) : null,
                activo
            };
        }));

        const estanquesValidos = estanquesConLecturas.filter(estanque => estanque !== null);
        renderEstanques(estanquesValidos);

        document.getElementById('last-check').textContent = `Última actualización: ${new Date().toLocaleTimeString('es-ES')}`;
        document.getElementById('global-status').className = 'status-indicator status-live';
        document.getElementById('status-text').textContent = 'Datos en vivo';

    } catch (error) {
        console.error("Error obteniendo datos de estanques:", error);
        document.getElementById('estanques-container').innerHTML = `
              <div class="estanque-card" style="grid-column: 1 / -1; text-align: center;">
                <h4><i class="fas fa-exclamation-triangle"></i> Error al cargar datos</h4>
                <p>${error.message}</p>
              </div>
            `;
        document.getElementById('global-status').className = 'status-indicator error';
        document.getElementById('status-text').textContent = 'Error de conexión';
    } finally {
        btnActualizar.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar datos';
        btnActualizar.disabled = false;
    }
}

// **LÓGICA PARA AGREGAR Y ACTUALIZAR ESTANQUES**
// (Solo se llamarán si el usuario es admin)

async function agregarEstanque(nombre) {
    try {
        const response = await fetch(`${API_BASE_URL}/tanks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nombre })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al agregar el estanque.');
        }
        const data = await response.json();
        mostrarNotificacion(`Estanque "${data.nombre}" agregado`, 'success');
        cerrarModal();
        await obtenerDatosEstanques(); // Recargar datos
    } catch (error) {
        console.error("Error agregando estanque:", error);
        mostrarNotificacion(error.message, 'error');
    }
}

async function actualizarNombreEstanque(estanqueId, nuevoNombre) {
    try {
        const response = await fetch(`${API_BASE_URL}/tanks/${estanqueId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nombre: nuevoNombre })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al actualizar.');
        }
        mostrarNotificacion(`Nombre actualizado a "${nuevoNombre}"`, 'success');
        await obtenerDatosEstanques(); // Recargar datos
    } catch (error) {
        console.error("Error actualizando nombre:", error);
        mostrarNotificacion(error.message, 'error');
    }
}

// **LÓGICA DE LA INTERFAZ Y FUNCIONES DE AYUDA**

let modalAbierto = false;

// (getValueStatus se queda igual)
function getValueStatus(value, type) {
    if (value === undefined || value === null) return '';
    value = parseFloat(value);
    switch (type) {
        case 'temperatura':
            if (value >= 20 && value <= 25) return 'value-good';
            if ((value >= 18 && value < 20) || (value > 25 && value <= 28)) return 'value-warning';
            return 'value-danger';
        case 'ph':
            if (value >= 6.5 && value <= 7.5) return 'value-good';
            if ((value >= 6.0 && value < 6.5) || (value > 7.5 && value <= 8.0)) return 'value-warning';
            return 'value-danger';
        case 'oxigeno':
            if (value >= 5 && value <= 7) return 'value-good';
            if ((value >= 4 && value < 5) || (value > 7 && value <= 8)) return 'value-warning';
            return 'value-danger';
        case 'tds':
            if (value >= 20 && value <= 50) return 'value-good'; // Ajustado a 20-50
            if (value >= 60 && value <= 75) return 'value-warning'; // Ajustado
            if (value > 100) return 'value-danger';
            return 'value-danger';
        default:
            return '';
    }
}


// Función para renderizar los estanques
function renderEstanques(estanquesData) {
    const container = document.getElementById('estanques-container');
    if (estanquesData.length === 0) {
        container.innerHTML = `... (código de 'No hay estanques') ...`;
        return;
    }
    container.innerHTML = '';

    const estanquesOrdenados = [...estanquesData].sort((a, b) => {
        if (a.activo && !b.activo) return -1;
        if (!a.activo && b.activo) return 1;
        return 0;
    });

    estanquesOrdenados.forEach(estanque => {
        const { id, nombre, activo, ultimaLectura, ultimaActualizacion } = estanque;
        const tieneNombre = !!nombre;
        const valores = ultimaLectura;

        const tempClass = valores ? getValueStatus(valores.temperatura, 'temperatura') : '';
        const phClass = valores ? getValueStatus(valores.ph, 'ph') : '';
        const tdsClass = valores ? getValueStatus(valores.solidos_disueltos, 'tds') : '';
        const oxigenoClass = valores ? getValueStatus(valores.oxigeno, 'oxigeno') : '';

        const card = document.createElement('div');
        card.className = `estanque-card ${activo ? '' : 'inactive'}`;

        // --- CAMBIO DE SEGURIDAD EN JS ---
        // 1. Determinar si se muestran las acciones de admin
        let actionsHtml = '';
        if (currentUserRole === 'admin') {
            actionsHtml = `
                <div class="estanque-actions">
                    <button class="btn-editar" data-id="${id}">
                        <i class="fas fa-edit"></i> ${tieneNombre ? 'Editar nombre' : 'Asignar nombre'}
                    </button>
                </div>
            `;
        }

        // 2. Insertar el HTML
        card.innerHTML = `
                <div class="estanque-header">
                    <h4 class="estanque-title">
                        <i class="fas ${activo ? 'fa-water' : 'fa-ban'}"></i> 
                        ${nombre || `Estanque ${id.substring(0,6)}...`}
                        ${!tieneNombre ? '<span style="font-size: 0.7em; color: #f39c12;"> (Sin nombre)</span>' : ''}
                    </h4>
                    <span class="estanque-status ${activo ? 'status-active' : 'status-inactive'}">
                        ${activo ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
                <div class="estanque-data">
                    <div class="estanque-data-item">
                        <span class="estanque-data-label"><i class="fas fa-temperature-high"></i> Temp.</span>
                        <span class="estanque-data-value ${tempClass}">${valores ? valores.temperatura + ' °C' : '--'}</span>
                    </div>
                    <div class="estanque-data-item">
                        <span class="estanque-data-label"><i class="fas fa-vial"></i> pH</span>
                        <span class="estanque-data-value ${phClass}">${valores ? valores.ph : '--'}</span>
                    </div>
                    <div class="estanque-data-item">
                        <span class="estanque-data-label"><i class="fas fa-tint"></i> TDS</span>
                        <span class="estanque-data-value ${tdsClass}">${valores ? valores.solidos_disueltos + ' ppm' : '--'}</span>
                    </div>
                    <div class="estanque-data-item">
                        <span class="estanque-data-label"><i class="fas fa-wind"></i> Oxígeno</span>
                        <span class="estanque-data-value ${oxigenoClass}">${valores ? valores.oxigeno + ' mg/L' : '--'}</span>
                    </div>
                </div>
                <div class="last-update">
                    <i class="fas fa-clock"></i> 
                    ${ultimaActualizacion ? ultimaActualizacion.toLocaleString('es-ES') : 'Sin datos'}
                </div>
                ${actionsHtml} `;

        container.appendChild(card);

        // 4. Añadir el listener SOLO si el botón existe
        if (currentUserRole === 'admin') {
            const editButton = card.querySelector('.btn-editar');
            if (editButton) {
                editButton.addEventListener('click', () => {
                    const nuevoNombre = prompt("Ingrese un nombre para este estanque:", nombre);
                    if (nuevoNombre && nuevoNombre.trim() !== '') {
                        actualizarNombreEstanque(id, nuevoNombre.trim());
                    }
                });
            }
        }
    });
}

// (Funciones de modal y notificaciones se quedan igual)
function abrirModal() { /* ... */ }
function cerrarModal() { /* ... */ }
function mostrarNotificacion(mensaje, tipo) { /* ... */ }

// **INICIAR LA APLICACIÓN**
document.addEventListener('DOMContentLoaded', function () {
    // Se elimina 'includeHTML' y 'setActiveNavLink'
    obtenerDatosEstanques();

    document.getElementById('btn-actualizar').addEventListener('click', obtenerDatosEstanques);

    // --- CAMBIO DE SEGURIDAD ---
    // Añadir listeners para el modal SOLO si el usuario es admin
    if (currentUserRole === 'admin') {
        const btnNuevo = document.getElementById('btn-nuevo-estanque');
        if (btnNuevo) { // El botón solo existe si es admin
            btnNuevo.addEventListener('click', abrirModal);
        }

        document.querySelector('.close').addEventListener('click', cerrarModal);
        document.getElementById('cancelar-estanque').addEventListener('click', cerrarModal);
        document.getElementById('guardar-estanque').addEventListener('click', function () {
            const nombre = document.getElementById('nombre-estanque').value;
            if (!nombre || nombre.trim() === '') {
                mostrarNotificacion("Por favor ingrese un nombre", 'warning');
                return;
            }
            agregarEstanque(nombre.trim());
        });

        window.addEventListener('click', function (event) {
            if (modalAbierto && event.target === document.getElementById('modal-estanque')) {
                cerrarModal();
            }
        });
    }
});