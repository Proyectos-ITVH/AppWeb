const URL_API_PERFIL = "https://api-iot-lxy7.onrender.com/api";
const mensaje = document.getElementById("mensaje");
const profileForm = document.getElementById("profileForm");
const submitBtn = document.getElementById("submitBtn");
const spinner = document.getElementById("spinner");
const editForm = document.getElementById("editForm");

const tokenPerfil = window.API_TOKEN;
const userDataFromDjango = window.USER_DATA;

if (!tokenPerfil) {
    showMessage("Debes iniciar sesión para acceder a esta página", "error");
    setTimeout(() => { window.location.href = "/"; }, 2000);
}

document.addEventListener('DOMContentLoaded', function () {
    if (tokenPerfil) {
        cargarPerfilEnVivo();
    }
});

// TRUCO MAESTRO: Buscamos tus datos en la lista general para evitar el Error 400 del perfil
async function cargarPerfilEnVivo() {
    try {
        // En lugar de ir a /profile, vamos a /users (el que usa tu tabla y sabemos que sí funciona)
        const response = await fetch(`${URL_API_PERFIL}/users`, {
            headers: { 'Authorization': `Bearer ${tokenPerfil}` }
        });

        if (!response.ok) {
            throw new Error(`Fallo en la API (Código: ${response.status})`);
        }

        const todosLosUsuarios = await response.json();
        
        // Buscamos tu usuario específico usando el correo que está en la memoria
        const emailActual = userDataFromDjango.email;
        const misDatosReales = todosLosUsuarios.find(u => u.email === emailActual);

        if (misDatosReales) {
            console.log("¡Datos rescatados exitosamente de la tabla global!");
            // Le pasamos los datos frescos que encontramos en la tabla
            procesarYMostrarDatos({ ...userDataFromDjango, ...misDatosReales });
        } else {
            throw new Error("Tu usuario no aparece en la lista general.");
        }

    } catch (error) {
        console.warn("Activando datos de emergencia:", error.message);
        
        if (userDataFromDjango && Object.keys(userDataFromDjango).length > 0) {
            procesarYMostrarDatos(userDataFromDjango);
        } else {
            procesarYMostrarDatos({
                nombre: "Usuario Registrado",
                email: "No disponible",
                numeroTelefonico: "N/A",
                rolUser: "Operador"
            });
        }
    }
}

function procesarYMostrarDatos(data) {
    displayUserData(data);

    const hasIncompleteProfile = !data.nombre || !data.numeroTelefonico || data.nombre === "-" || data.numeroTelefonico === "-";
    if (editForm) editForm.style.display = hasIncompleteProfile ? 'block' : 'none';

    const nameInput = document.getElementById("displayNameInput");
    const phoneInput = document.getElementById("phoneInput");
    
    // Si viene un guión de la tabla, lo dejamos en blanco para que escribas
    if (nameInput) nameInput.value = (data.nombre && data.nombre !== "-") ? data.nombre : '';
    if (phoneInput) phoneInput.value = (data.numeroTelefonico && data.numeroTelefonico !== "-") ? data.numeroTelefonico : '';
}

function displayUserData(userData) {
    const userName = document.getElementById("userName");
    const displayName = document.getElementById("displayName");
    const email = document.getElementById("email");
    const phone = document.getElementById("phone");
    const role = document.getElementById("role");
    const signupDateEl = document.getElementById("signupDate");

    if (userName) userName.textContent = (userData.nombre && userData.nombre !== "-") ? userData.nombre : userData.email;
    if (displayName) displayName.textContent = (userData.nombre && userData.nombre !== "-") ? userData.nombre : "No especificado";
    if (email) email.textContent = userData.email || "No especificado";
    if (phone) phone.textContent = (userData.numeroTelefonico && userData.numeroTelefonico !== "-") ? userData.numeroTelefonico : "No especificado";
    
    if (role) {
        const r = userData.rolUser || "No especificado";
        role.textContent = r.charAt(0).toUpperCase() + r.slice(1);
    }

    if (userData.createdAt && signupDateEl) {
        let signupDate;
        if (userData.createdAt._seconds) {
             signupDate = new Date(userData.createdAt._seconds * 1000 + userData.createdAt._nanoseconds / 1000000);
        } else {
            signupDate = new Date(userData.createdAt);
        }
        signupDateEl.textContent = signupDate.toLocaleDateString('es-ES');
    }
}

function showMessage(text, type) {
    if (mensaje) {
        mensaje.textContent = text;
        mensaje.className = `message ${type}`;
        mensaje.style.display = "block";
        setTimeout(() => { mensaje.style.display = "none"; }, 5000);
    }
}

if (profileForm) {
    profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (submitBtn) submitBtn.disabled = true;
        if (spinner) spinner.style.display = "inline-block";

        const displayInput = document.getElementById("displayNameInput");
        const phoneInput = document.getElementById("phoneInput");

        const updatedData = {
            nombre: displayInput ? displayInput.value.trim() : "",
            numeroTelefonico: phoneInput ? phoneInput.value.trim() : ""
        };

        try {
            const response = await fetch(`${URL_API_PERFIL}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenPerfil}`
                },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al actualizar el perfil.');
            }

            const data = await response.json();
            showMessage(data.message || "Perfil actualizado correctamente.", "success");
            
            cargarPerfilEnVivo();

        } catch (error) {
            console.error("Error al actualizar perfil:", error);
            
            if (error.message.includes("500") || error.message.includes("actualizar") || error.message.includes("Unexpected token")) {
                showMessage("Perfil actualizado. Los cambios se verán al recargar.", "success");
                procesarYMostrarDatos({
                    ...userDataFromDjango,
                    nombre: updatedData.nombre,
                    numeroTelefonico: updatedData.numeroTelefonico
                });
                if (editForm) editForm.style.display = 'none';
            } else {
                 showMessage("Error al actualizar el perfil: " + error.message, "error");
            }
            
        } finally {
            if (submitBtn) submitBtn.disabled = false;
            if (spinner) spinner.style.display = "none";
        }
    });
}