const API_BASE_URL = 'https://api-iot-lxy7.onrender.com/api';
const token = window.API_TOKEN;

if (!token) {
    window.location.href = "/";
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar preferencias visuales locales
    cargarAjustesLocales();

    // 2. Cargar lista real de estanques en el selector
    await cargarEstanquesEnSelect();

    // Escuchar el cambio de estanque para traer sus sensores
    const selectEstanque = document.getElementById('selectEstanque');
    if (selectEstanque) {
        selectEstanque.addEventListener('change', (e) => cargarSensores(e.target.value));
    }

    // Formularios y Botones
    const btnMostrarFormNuevo = document.getElementById('btnMostrarFormNuevo');
    if (btnMostrarFormNuevo) {
        btnMostrarFormNuevo.addEventListener('click', () => {
            document.getElementById('seccionEditarSensor').style.display = 'none';
            document.getElementById('seccionNuevoSensor').style.display = 'block';
            window.location.hash = "seccionNuevoSensor";
        });
    }

    const formNuevoSensor = document.getElementById('formNuevoSensor');
    if (formNuevoSensor) formNuevoSensor.addEventListener('submit', agregarNuevoSensor);

    const formEdicionSensor = document.getElementById('formEdicionSensor');
    if (formEdicionSensor) formEdicionSensor.addEventListener('submit', actualizarSensorEnAPI);

    const formPreferencias = document.getElementById('formPreferencias');
    if (formPreferencias) formPreferencias.addEventListener('submit', guardarPreferencias);

    const formAlertas = document.getElementById('formAlertas');
    if (formAlertas) formAlertas.addEventListener('submit', guardarAlertas);
});

// ==========================================
// 1. OBTENER ESTANQUES Y SENSORES (REAL API)
// ==========================================
async function cargarEstanquesEnSelect() {
    const select = document.getElementById('selectEstanque');
    if (!select) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tanks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Error obteniendo estanques");
        
        const estanques = await response.json();
        select.innerHTML = '';
        
        if (estanques.length === 0) {
            select.innerHTML = '<option value="">No hay estanques registrados</option>';
            return;
        }

        estanques.forEach(estanque => {
            if (estanque._id) {
                const option = document.createElement('option');
                option.value = estanque._id;
                option.textContent = estanque.nombre || `Estanque ${estanque._id.substring(0,6)}`;
                select.appendChild(option);
            }
        });

        // Cargar los sensores del primer estanque disponible
        cargarSensores(select.value);

    } catch (error) {
        console.error("Error al cargar estanques:", error);
    }
}

async function cargarSensores(estanqueId) {
    const tbody = document.getElementById('tablaSensoresBody');
    if (!tbody || !estanqueId) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Cargando sensores...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/sensors/tank/${estanqueId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Aún no hay sensores para este estanque o la ruta no existe en la API.");
        
        const sensores = await response.json();
        
        if (sensores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay sensores registrados en este estanque.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        sensores.forEach(sensor => {
            const tr = document.createElement('tr');
            let badgeColor = "#e8f5e9"; let textColor = "#1b5e20"; // Verde (Default/OX)
            if(sensor.tipo === "PH") { badgeColor = "#e3f2fd"; textColor = "#0d47a1"; } // Azul
            if(sensor.tipo === "TEMP") { badgeColor = "#ffebee"; textColor = "#b71c1c"; } // Rojo
            if(sensor.tipo === "TDS") { badgeColor = "#fff3e0"; textColor = "#e65100"; } // Naranja

            tr.innerHTML = `
                <td><strong>${sensor.nombre}</strong></td>
                <td><span class="badge" style="background-color: ${badgeColor}; color: ${textColor}; padding: 2px 6px; border-radius: 4px;">${sensor.tipo}</span></td>
                <td>${sensor.rango_minimo}</td>
                <td>${sensor.rango_maximo}</td>
                <td>
                    <button class="btn-primary" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px;" onclick="prepararEdicion('${sensor._id}', '${sensor.nombre}', '${sensor.tipo}', ${sensor.rango_minimo}, ${sensor.rango_maximo})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">${error.message}</td></tr>`;
    }
}

// ==========================================
// 2. AGREGAR NUEVO SENSOR (POST - REAL API)
// ==========================================
async function agregarNuevoSensor(e) {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-guardar');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    btn.disabled = true;

    const estanqueId = document.getElementById('selectEstanque').value;
    const nuevoSensor = {
        estanque_id: estanqueId,
        nombre: document.getElementById('nuevoNombreSensor').value,
        tipo: document.getElementById('nuevoTipoSensor').value,
        rango_minimo: parseFloat(document.getElementById('nuevoRangoMin').value),
        rango_maximo: parseFloat(document.getElementById('nuevoRangoMax').value)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/sensors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(nuevoSensor)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Error al registrar en la base de datos.");
        }

        mostrarNotificacion("Sensor registrado exitosamente en la API.", "success");
        document.getElementById('formNuevoSensor').reset();
        document.getElementById('seccionNuevoSensor').style.display = 'none';
        
        cargarSensores(estanqueId);

    } catch (error) {
        mostrarNotificacion(error.message, "error");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}

// ==========================================
// 3. EDITAR SENSOR (PUT - REAL API)
// ==========================================
function prepararEdicion(id, nombre, tipo, min, max) {
    document.getElementById('seccionNuevoSensor').style.display = 'none';
    document.getElementById('seccionEditarSensor').style.display = 'block';
    window.location.hash = "seccionEditarSensor";

    document.getElementById('editSensorId').value = id;
    document.getElementById('editNombreSensor').value = nombre;
    document.getElementById('editTipoSensor').value = tipo;
    document.getElementById('editRangoMin').value = min;
    document.getElementById('editRangoMax').value = max;
}

async function actualizarSensorEnAPI(e) {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-guardar');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    btn.disabled = true;

    const sensorId = document.getElementById('editSensorId').value;
    const estanqueId = document.getElementById('selectEstanque').value;
    
    const datosActualizados = {
        nombre: document.getElementById('editNombreSensor').value,
        tipo: document.getElementById('editTipoSensor').value,
        rango_minimo: parseFloat(document.getElementById('editRangoMin').value),
        rango_maximo: parseFloat(document.getElementById('editRangoMax').value)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/sensors/${sensorId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(datosActualizados)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Error al actualizar en la base de datos.");
        }

        mostrarNotificacion("Parámetros actualizados exitosamente en la API.", "success");
        document.getElementById('seccionEditarSensor').style.display = 'none';
        
        cargarSensores(estanqueId);

    } catch (error) {
        mostrarNotificacion(error.message, "error");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}

// ==========================================
// 4. PREFERENCIAS LOCALES (TEMA / NOTIFICACIONES)
// ==========================================
function cargarAjustesLocales() {
    const prefGuardadas = JSON.parse(localStorage.getItem('preferenciasIoT'));
    if (prefGuardadas) {
        if (document.getElementById('intervaloActualizacion')) document.getElementById('intervaloActualizacion').value = prefGuardadas.intervalo;
        if (document.getElementById('tema')) document.getElementById('tema').value = prefGuardadas.tema;
        if (document.getElementById('notificaciones')) document.getElementById('notificaciones').value = prefGuardadas.notificaciones;
        aplicarTemaGlobal(prefGuardadas.tema);
    }

    const umbralesGuardados = JSON.parse(localStorage.getItem('umbralesGlobales'));
    if (umbralesGuardados) {
        if (document.getElementById('umbralTemperatura')) document.getElementById('umbralTemperatura').value = umbralesGuardados.tempMax;
        if (document.getElementById('umbralPH')) document.getElementById('umbralPH').value = umbralesGuardados.phMin;
        if (document.getElementById('umbralTurbidez')) document.getElementById('umbralTurbidez').value = umbralesGuardados.turbidezMax;
        if (document.getElementById('umbralOxigeno')) document.getElementById('umbralOxigeno').value = umbralesGuardados.oxigenoMin;
    }
}

function guardarPreferencias(e) {
    e.preventDefault();
    const preferencias = {
        intervalo: document.getElementById('intervaloActualizacion').value,
        tema: document.getElementById('tema').value,
        notificaciones: document.getElementById('notificaciones').value
    };
    localStorage.setItem('preferenciasIoT', JSON.stringify(preferencias));
    aplicarTemaGlobal(preferencias.tema);
    mostrarNotificacion("Preferencias visuales guardadas", "success");
}

function guardarAlertas(e) {
    e.preventDefault();
    const umbrales = {
        tempMax: document.getElementById('umbralTemperatura').value,
        phMin: document.getElementById('umbralPH').value,
        turbidezMax: document.getElementById('umbralTurbidez').value,
        oxigenoMin: document.getElementById('umbralOxigeno').value
    };
    localStorage.setItem('umbralesGlobales', JSON.stringify(umbrales));
    mostrarNotificacion("Umbrales globales guardados localmente", "success");
}

function aplicarTemaGlobal(tema) {
    if (tema === 'oscuro') {
        document.body.classList.add('dark-mode');
    } else if (tema === 'claro') {
        document.body.classList.remove('dark-mode');
    } else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }
}

// ==========================================
// 5. UTILIDADES Y NOTIFICACIONES
// ==========================================
window.prepararEdicion = prepararEdicion; // Hacer la función global para el onclick del HTML

function mostrarNotificacion(mensaje, tipo) {
    const notificacion = document.getElementById('notificacion');
    const icono = document.getElementById('notificacionIcono');
    const texto = document.getElementById('notificacionMensaje');
    
    if (!notificacion) return;

    texto.textContent = mensaje;
    notificacion.className = `notificacion mostrar ${tipo === 'error' ? 'error' : ''}`;
    
    if (tipo === 'success') {
        icono.className = 'fas fa-check-circle';
    } else {
        icono.className = 'fas fa-exclamation-triangle';
    }

    setTimeout(() => {
        notificacion.classList.remove('mostrar');
    }, 3000);
}