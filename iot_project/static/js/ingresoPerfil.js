// --- CAMBIOS CRÍTICOS ---
// 1. Se elimina 'includeHTML' y 'setActiveNavLink'
// 2. Se elimina 'localStorage' para leer el token
// 3. Se cambian las redirecciones a '/' (login de Django)
// -------------------------

const API_BASE_URL = "https://api-iot-lxy7.onrender.com/api";
const mensaje = document.getElementById("mensaje");
const profileForm = document.getElementById("profileForm");
const submitBtn = document.getElementById("submitBtn");
const spinner = document.getElementById("spinner");
const editForm = document.getElementById("editForm");

// Leemos el token de la variable global que Django inyectó
const token = window.API_TOKEN;

// Verificación inicial
if (!token) {
    showMessage("Debes iniciar sesión para acceder a esta página", "error");
    setTimeout(() => {
        window.location.href = "/"; // Redirigir al login de Django
    }, 2000);
}

document.addEventListener('DOMContentLoaded', function () {
    // Si el token existe, carga los datos del usuario
    if (token) {
        loadUserData();
    }
    // 'menu.js' se carga desde el HTML, ya no es necesario aquí
});

async function loadUserData() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                // Token expirado o inválido, redirigir al login
                window.location.href = "/";
                return;
            }
            throw new Error('Error al cargar el perfil.');
        }

        const data = await response.json();

        // El resto de la lógica para mostrar datos y rellenar
        // el formulario se queda igual.
        displayUserData(data);

        // Mostrar formulario de edición si faltan campos
        const hasIncompleteProfile = !data.nombre || !data.numeroTelefonico;
        editForm.style.display = hasIncompleteProfile ? 'block' : 'none';

        // Prellenar formulario
        document.getElementById("displayNameInput").value = data.nombre || '';
        document.getElementById("phoneInput").value = data.numeroTelefonico || '';

    } catch (error) {
        console.error("Error al cargar datos del usuario:", error);
        showMessage("Error al cargar los datos del usuario: " + error.message, "error");
    }
}

function displayUserData(userData) {
    document.getElementById("userName").textContent = userData.nombre || userData.email || "Usuario";
    document.getElementById("displayName").textContent = userData.nombre || "No especificado";
    document.getElementById("email").textContent = userData.email || "No especificado";
    document.getElementById("phone").textContent = userData.numeroTelefonico || "No especificado";
    document.getElementById("role").textContent = userData.rolUser || "No especificado";

    // Si la fecha de creación existe, la mostramos
    if (userData.createdAt) {
        // Asumimos que createdAt puede ser un objeto de Firestore o una fecha ISO
        let signupDate;
        if (userData.createdAt._seconds) {
             signupDate = new Date(userData.createdAt._seconds * 1000 + userData.createdAt._nanoseconds / 1000000);
        } else {
            signupDate = new Date(userData.createdAt);
        }
        document.getElementById("signupDate").textContent = signupDate.toLocaleDateString('es-ES');
    }
}

function showMessage(text, type) {
    mensaje.textContent = text;
    mensaje.className = `message ${type}`;
    mensaje.style.display = "block";
    setTimeout(() => {
        mensaje.style.display = "none";
    }, 5000);
}

profileForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    submitBtn.disabled = true;
    spinner.style.display = "inline-block";

    const updatedData = {
        nombre: document.getElementById("displayNameInput").value.trim(),
        numeroTelefonico: document.getElementById("phoneInput").value.trim()
    };

    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al actualizar el perfil.');
        }

        const data = await response.json();

        // Recarga los datos desde la API para asegurar la sincronización
        await loadUserData(); 

        showMessage(data.message || "Perfil actualizado correctamente.", "success");
    } catch (error) {
        console.error("Error al actualizar perfil:", error);
        showMessage("Error al actualizar el perfil: " + error.message, "error");
    } finally {
        submitBtn.disabled = false;
        spinner.style.display = "none";
    }
});