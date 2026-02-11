// URL base de tu API de backend
const API_BASE_URL = 'https://api-iot-lxy7.onrender.com/api';

// --- CAMBIOS CRÍTICOS ---
// 1. Leemos el token de la variable global que Django inyectó
const token = window.API_TOKEN;

// 2. Se elimina la lógica de 'localStorage' y 'includeHTML'
// 3. Se elimina la redirección, ya que Django protege la vista
if (!token) {
    console.error("Token no encontrado. Redirigiendo al login.");
    window.location.href = "/"; // Redirigir al login de Django
}
// -------------------------

// Función genérica para mostrar notificaciones personalizadas
function mostrarNotificacion(mensaje, tipo) {
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.innerHTML = `
                <i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                ${mensaje}
            `;
    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.classList.add('show');
    }, 10);

    setTimeout(() => {
        notificacion.classList.remove('show');
        setTimeout(() => {
            notificacion.remove();
        }, 300);
    }, 3000);
}

// Función genérica para cargar datos desde la API
async function cargarAjustesDesdeAPI() {
    try {
        const response = await fetch(`${API_BASE_URL}/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // CAMBIO: Manejar token expirado
        if (response.status === 401 || response.status === 403) {
            window.location.href = "/";
            return;
        }
        if (!response.ok) throw new Error('Error al cargar la configuración.');
        
        const settings = await response.json();

        // Rellenar los formularios con los datos del backend
        if (settings.preferencias) {
            Object.keys(settings.preferencias).forEach(key => {
                const input = document.getElementById(key);
                if (input) input.value = settings.preferencias[key];
            });
        }

        if (settings.alertas) {
            Object.keys(settings.alertas).forEach(key => {
                const input = document.getElementById(key);
                if (input) input.value = settings.alertas[key];
            });
        }

        // No mostramos notificación al cargar, es confuso
        // mostrarNotificacion('Configuración cargada correctamente', 'success');
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion(error.message, 'error');
    }
}

// Función genérica para enviar datos a la API
async function guardarAjustesEnAPI(section, data) {
    // CAMBIO: El 'section' en la API es 'preferencias' o 'alertas' (minúscula)
    const apiSection = section.toLowerCase(); 
    const btn = document.querySelector(`#form${section} .btn-guardar`);
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/settings/${apiSection}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = "/";
            return;
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al guardar la configuración.');
        }

        mostrarNotificacion(`Ajustes de ${section} guardados correctamente.`, 'success');
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion(error.message, 'error');
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// Escuchar los eventos de submit de los formularios
document.getElementById("formPreferencias").addEventListener("submit", function (e) {
    e.preventDefault();
    const datos = {
        intervaloActualizacion: document.getElementById('intervaloActualizacion').value,
        tema: document.getElementById('tema').value,
        notificaciones: document.getElementById('notificaciones').value
    };
    guardarAjustesEnAPI('Preferencias', datos); // 'Preferencias' (Mayúscula)
});

document.getElementById("formAlertas").addEventListener("submit", function (e) {
    e.preventDefault();
    const datos = {
        umbralTemperatura: document.getElementById('umbralTemperatura').value,
        umbralPH: document.getElementById('umbralPH').value,
        umbralTurbidez: document.getElementById('umbralTurbidez').value,
        umbralOxigeno: document.getElementById('umbralOxigeno').value
    };
    guardarAjustesEnAPI('Alertas', datos); // 'Alertas' (Mayúscula)
});

// CAMBIO: Se elimina 'includeHTML' y se llama a la función directamente
document.addEventListener('DOMContentLoaded', function () {
    cargarAjustesDesdeAPI();
});