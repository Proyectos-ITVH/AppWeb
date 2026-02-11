// URL de la API (esto se queda igual)
const API_BASE_URL = 'https://api-iot-lxy7.onrender.com/api';

// --- CAMBIOS CRÍTICOS ---
// 1. Leemos el token de la variable global que Django inyectó
const token = window.API_TOKEN;

// 2. El rol ya no se consulta, se asume.
// La vista de Django no nos habría enviado a esta página si no fuéramos 'admin'.
let currentUserRole = "admin";
// -------------------------


// **LÓGICA DEL PANEL DE GESTIÓN DE USUARIOS**

// Función para mostrar los usuarios en la tabla
async function mostrarUsuarios() {
    document.getElementById("tabla-usuarios").innerHTML = `<p>Cargando datos de usuarios...</p>`;

    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Si el token expira o es inválido, redirigir al login
        if (response.status === 401 || response.status === 403) {
            window.location.href = "/"; // Redirige a la URL de login de Django
        }
        if (!response.ok) {
            throw new Error('Error al obtener la lista de usuarios.');
        }
        
        const users = await response.json();

        let tabla = `
            <table>
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Nombre</th>
                        <th>Teléfono</th>
                        <th>Rol</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;

        users.forEach((user) => {
            const rol = user.rolUser ? user.rolUser.toLowerCase() : "user";
            let roleClass = "role-user";
            if (rol === "admin") roleClass = "role-admin";
            else if (rol === "viewer") roleClass = "role-viewer";

            // Ya sabemos que es admin, siempre mostramos las acciones
            const acciones = 
                `<td class="acciones">
                    <button class="btn-editar" onclick="editarUsuario('${user.id}', '${user.email || ""}', '${user.nombre || ""}', '${user.numeroTelefonico || ""}', '${rol}')"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-eliminar" onclick="eliminarUsuario('${user.id}')"><i class="fas fa-trash"></i> Eliminar</button>
                </td>`;

            tabla += `
                <tr>
                    <td>${user.email || "-"}</td>
                    <td>${user.nombre || "-"}</td>
                    <td>${user.numeroTelefonico || "-"}</td>
                    <td><span class="role-badge ${roleClass}">${rol}</span></td>
                    ${acciones}
                </tr>
            `;
        });

        tabla += "</tbody></table>";
        document.getElementById("tabla-usuarios").innerHTML = tabla;

    } catch (error) {
        document.getElementById("tabla-usuarios").innerHTML = `<p style="color:var(--danger);">Error cargando usuarios: ${error.message}</p>`;
    }
}

// **FUNCIONES DE ACCIÓN (ELIMINAR, EDITAR, CREAR)**
// (Toda esta lógica se queda idéntica, ya que se basa en el 'token'
// y 'currentUserRole' que ya definimos arriba)

// Eliminar usuario
async function eliminarUsuario(id) {
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;
    try {
        const response = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Error al eliminar el usuario.');
        }
        alert("Usuario eliminado ✅");
        mostrarUsuarios();
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
}

// Editar usuario
async function editarUsuario(id, email, nombre, telefono, rol) {
    document.getElementById("tabla-usuarios").style.display = "none";
    document.getElementById("btnCrearUsuario").style.display = "none";

    const formularioDiv = document.getElementById("formulario-usuario");
    formularioDiv.style.display = "block";
    formularioDiv.innerHTML = `
        <div class="card">
            <h3><i class="fas fa-edit"></i> Editar Usuario</h3>
            <form class="form-editar" id="formEditar">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email" value="${email.replace(/'/g, "&#39;")}" required>
                </div>
                <div class="form-group">
                    <label>Nombre</label>
                    <input type="text" id="nombre" value="${nombre.replace(/'/g, "&#39;")}" required>
                </div>
                <div class="form-group">
                    <label>Teléfono</label>
                    <input type="text" id="telefono" value="${telefono.replace(/'/g, "&#39;")}">
                </div>
                <div class="form-group">
                    <label>Rol</label>
                    <select id="rol" required>
                        <option value="user" ${rol === 'user' ? 'selected' : ''}>Usuario</option>
                        <option value="admin" ${rol === 'admin' ? 'selected' : ''}>Administrador</option>
                        <option value="viewer" ${rol === 'viewer' ? 'selected' : ''}>Solo Lectura</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-guardar"><i class="fas fa-save"></i> Guardar cambios</button>
                    <button type="button" class="btn-cancelar" onclick="cancelarFormulario()"><i class="fas fa-times"></i> Cancelar</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById("formEditar").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            const updatedUser = {
                email: document.getElementById("email").value,
                nombre: document.getElementById("nombre").value,
                numeroTelefonico: document.getElementById("telefono").value,
                rolUser: document.getElementById("rol").value
            };
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedUser)
            });
            if (!response.ok) throw new Error('Error al actualizar el usuario.');
            alert("Usuario actualizado ✅");
            cancelarFormulario();
            mostrarUsuarios();
        } catch (error) {
            alert("Error al actualizar: " + error.message);
        }
    });
}

// Crear usuario
async function crearUsuario() {
    document.getElementById("tabla-usuarios").style.display = "none";
    document.getElementById("btnCrearUsuario").style.display = "none";

    const formularioDiv = document.getElementById("formulario-usuario");
    formularioDiv.style.display = "block";
    formularioDiv.innerHTML = `
        <div class="card">
            <h3><i class="fas fa-plus"></i> Nuevo Usuario</h3>
            <form class="form-crear" id="formCrear">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email" required>
                </div>
                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" id="password" required>
                </div>
                <div class="form-group">
                    <label>Nombre</label>
                    <input type="text" id="nombre" required>
                </div>
                <div class="form-group">
                    <label>Teléfono</label>
                    <input type="text" id="telefono">
                </div>
                <div class="form-group">
                    <label>Rol</label>
                    <select id="rol" required>
                        <option value="user">Usuario</option>
                        <option value="admin">Administrador</option>
                        <option value="viewer">Solo Lectura</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-guardar"><i class="fas fa-save"></i> Crear usuario</button>
                    <button type="button" class="btn-cancelar" onclick="cancelarFormulario()"><i class="fas fa-times"></i> Cancelar</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById("formCrear").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            const newUser = {
                email: document.getElementById("email").value,
                password: document.getElementById("password").value,
                nombre: document.getElementById("nombre").value,
                numeroTelefonico: document.getElementById("telefono").value,
                rolUser: document.getElementById("rol").value
            };
            const response = await fetch(`${API_BASE_URL}/users/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newUser)
            });
            if (!response.ok) throw new Error('Error al crear el usuario.');
            alert("Usuario creado ✅");
            cancelarFormulario();
            mostrarUsuarios();
        } catch (error) {
            alert("Error al crear usuario: " + error.message);
        }
    });
}

// Cancelar edición/creación
function cancelarFormulario() {
    document.getElementById("formulario-usuario").style.display = "none";
    document.getElementById("formulario-usuario").innerHTML = "";
    document.getElementById("tabla-usuarios").style.display = "block";
    document.getElementById("btnCrearUsuario").style.display = "block";
}

// Hacer accesibles las funciones al HTML para los eventos 'onclick'
window.eliminarUsuario = eliminarUsuario;
window.editarUsuario = editarUsuario;
window.cancelarFormulario = cancelarFormulario;
window.crearUsuario = crearUsuario;

// **LÓGICA DE INICIO**
// CAMBIO: Se simplifica la función de inicio
async function iniciarUsuarios() {
    // Ya no necesitamos 'obtenerRolUsuarioActual()', Django ya lo validó
    mostrarUsuarios();
    document.getElementById("btnCrearUsuario").addEventListener("click", crearUsuario);
}

// CAMBIO: Se simplifica el listener
document.addEventListener('DOMContentLoaded', function () {
    iniciarUsuarios(); // Se llama directamente, ya no hay 'includeHTML'
});