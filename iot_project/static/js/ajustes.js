document.addEventListener('DOMContentLoaded', function() {

    // ==========================================
    // 1. CARGAR PREFERENCIAS VISUALES
    // ==========================================
    cargarAjustesLocales();
    const formPreferencias = document.getElementById('formPreferencias');
    if (formPreferencias) formPreferencias.addEventListener('submit', guardarPreferencias);

    // ==========================================
    // 2. LÓGICA DE CONTROL DE RANGOS
    // ==========================================
    const selectEstanque = document.getElementById('selectEstanqueAjustes');
    const tablaBody = document.getElementById('tabla-rangos-body');
    
    const modalEdicion = document.getElementById('modalRangos');
    const formEdicion = document.getElementById('formRangos');
    const btnCerrarEdicion = document.getElementById('btnCerrarModal');
    
    const modalNuevo = document.getElementById('modalNuevoSensor');
    const formNuevo = document.getElementById('formNuevoSensor');
    const btnAbrirNuevo = document.getElementById('btnAbrirModalNuevo');
    const btnCerrarNuevo = document.getElementById('btnCerrarModalNuevo');

    // MODAL RENOMBRAR
    const modalRenombrar = document.getElementById('modalRenombrar');
    const btnRenombrar = document.getElementById('btnRenombrarEstanque');
    const btnCerrarRenombrar = document.getElementById('btnCerrarRenombrar');
    const btnGuardarNombre = document.getElementById('btnGuardarNombre');
    const inputNuevoNombre = document.getElementById('inputNuevoNombre');
    
    const parametros = [
        { id: 'temp', nombre: '<i class="fas fa-temperature-high" style="color: #e74c3c; width: 25px;"></i> Temperatura (°C)', minKey: 'temp_min', maxKey: 'temp_max' },
        { id: 'ph', nombre: '<i class="fas fa-vial" style="color: #2ecc71; width: 25px;"></i> pH', minKey: 'ph_min', maxKey: 'ph_max' },
        { id: 'tds', nombre: '<i class="fas fa-tint" style="color: #3498db; width: 25px;"></i> Sólidos (TDS)', minKey: 'tds_min', maxKey: 'tds_max' },
        { id: 'oxigeno', nombre: '<i class="fas fa-wind" style="color: #9b59b6; width: 25px;"></i> Oxígeno (mg/L)', minKey: 'oxigeno_min', maxKey: 'oxigeno_max' }
    ];

    let estanqueActual = null;

    // INICIALIZACIÓN DE LA TABLA
    if (window.RANGOS_LOCALES && window.RANGOS_LOCALES.length > 0) {
        if (selectEstanque) selectEstanque.innerHTML = '';
        window.RANGOS_LOCALES.forEach(est => {
            const option = document.createElement('option');
            option.value = est.id;
            option.textContent = est.nombre;
            if (selectEstanque) selectEstanque.appendChild(option);
        });

        if (selectEstanque) selectEstanque.addEventListener('change', (e) => cargarTabla(e.target.value));
        cargarTabla(window.RANGOS_LOCALES[0].id);
    } else {
        if (tablaBody) tablaBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: var(--text-muted);">No hay estanques registrados o el servidor está cargando.</td></tr>';
    }

    function cargarTabla(idEstanque) {
        estanqueActual = window.RANGOS_LOCALES.find(e => e.id === idEstanque);
        if (!estanqueActual || !tablaBody) return;
        tablaBody.innerHTML = '';

        const crearFila = (id, nombre, min, max) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid var(--border-color)";
            tr.innerHTML = `
                <td style="padding: 15px; font-weight: bold; font-size: 1.05rem;">${nombre}</td>
                <td style="padding: 15px; text-align: center; color: var(--danger, #e74c3c); font-weight: bold;">${min}</td>
                <td style="padding: 15px; text-align: center; color: var(--danger, #e74c3c); font-weight: bold;">${max}</td>
                <td style="padding: 15px; text-align: center;">
                    <button class="btn-primary btn-editar" data-param="${id}" style="padding: 6px 12px; font-size: 0.9rem; border-radius: 4px; background-color: #2b7a78; color: white; border: none; cursor: pointer;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </td>
            `;
            tablaBody.appendChild(tr);
        };

        parametros.forEach(param => {
            crearFila(param.id, param.nombre, estanqueActual.rangos_fijos[param.minKey], estanqueActual.rangos_fijos[param.maxKey]);
        });

        if (estanqueActual.sensores_extra) {
            estanqueActual.sensores_extra.forEach(sensor => {
                const nombreHtml = `<i class="fas fa-microchip" style="color: #f39c12; width: 25px;"></i> ${sensor.nombre} (${sensor.tipo})`;
                crearFila(`extra_${sensor.id}`, nombreHtml, sensor.rango_min, sensor.rango_max);
            });
        }

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', (e) => abrirModalEdicion(e.currentTarget.getAttribute('data-param')));
        });
    }

    // --- MODAL DE EDICIÓN DE RANGOS ---
    function abrirModalEdicion(paramId) {
        document.getElementById('editParametro').value = paramId;

        if (paramId.startsWith('extra_')) {
            const realId = parseInt(paramId.split('_')[1]);
            const sensor = estanqueActual.sensores_extra.find(s => s.id === realId);
            document.getElementById('modalTitulo').textContent = `Ajustar límites: ${sensor.nombre}`;
            document.getElementById('inputMin').value = sensor.rango_min;
            document.getElementById('inputMax').value = sensor.rango_max;
        } else {
            const paramConfig = parametros.find(p => p.id === paramId);
            const nombreLimpio = paramConfig.nombre.replace(/<[^>]*>?/gm, '');
            document.getElementById('modalTitulo').textContent = `Ajustar límites: ${nombreLimpio}`;
            document.getElementById('inputMin').value = estanqueActual.rangos_fijos[paramConfig.minKey];
            document.getElementById('inputMax').value = estanqueActual.rangos_fijos[paramConfig.maxKey];
        }
        if (modalEdicion) modalEdicion.style.display = 'flex';
    }

    if (btnCerrarEdicion) btnCerrarEdicion.addEventListener('click', () => modalEdicion.style.display = 'none');

    if (formEdicion) {
        formEdicion.addEventListener('submit', function(e) {
            e.preventDefault();
            const paramId = document.getElementById('editParametro').value;
            const valMin = parseFloat(document.getElementById('inputMin').value);
            const valMax = parseFloat(document.getElementById('inputMax').value);

            fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({
                    action: 'editar_sensor',
                    estanque_id: estanqueActual.id,
                    param_id: paramId,
                    rango_min: valMin,
                    rango_max: valMax
                })
            }).then(() => window.location.reload());
        });
    }

    // --- MODAL NUEVO SENSOR ---
    if (btnAbrirNuevo) btnAbrirNuevo.addEventListener('click', () => modalNuevo.style.display = 'flex');
    if (btnCerrarNuevo) btnCerrarNuevo.addEventListener('click', () => modalNuevo.style.display = 'none');

    if (formNuevo) {
        formNuevo.addEventListener('submit', function(e) {
            e.preventDefault();
            const btnSubmit = formNuevo.querySelector('button[type="submit"]');
            if (btnSubmit) btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({
                    action: 'agregar_sensor',
                    estanque_id: estanqueActual.id,
                    nombre: document.getElementById('nuevoNombreSensor').value,
                    tipo: document.getElementById('nuevoTipoSensor').value.toUpperCase(),
                    rango_min: parseFloat(document.getElementById('nuevoRangoMin').value),
                    rango_max: parseFloat(document.getElementById('nuevoRangoMax').value)
                })
            }).then(() => window.location.reload());
        });
    }

    // ==========================================
    // 3. MODAL RENOMBRAR ESTANQUE
    // ==========================================
    if (btnRenombrar) {
        btnRenombrar.addEventListener('click', () => {
            if (!estanqueActual) return;
            // Precargamos el nombre actual en el input
            inputNuevoNombre.value = estanqueActual.nombre;
            modalRenombrar.style.display = 'flex';
        });
    }

    if (btnCerrarRenombrar) {
        btnCerrarRenombrar.addEventListener('click', () => {
            modalRenombrar.style.display = 'none';
        });
    }

    if (btnGuardarNombre) {
        btnGuardarNombre.addEventListener('click', () => {
            const nuevoNombre = inputNuevoNombre.value.trim();
            if (!nuevoNombre) {
                mostrarNotificacion('El nombre no puede estar vacío', 'error');
                return;
            }

            btnGuardarNombre.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({
                    action: 'renombrar_estanque',
                    estanque_id: estanqueActual.id,
                    nuevo_nombre: nuevoNombre
                })
            })
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success') {
                    // Actualizamos el nombre en el select sin recargar
                    const optionActual = selectEstanque.querySelector(`option[value="${estanqueActual.id}"]`);
                    if (optionActual) optionActual.textContent = nuevoNombre;
                    estanqueActual.nombre = nuevoNombre;
                    modalRenombrar.style.display = 'none';
                    mostrarNotificacion('Estanque renombrado correctamente', 'success');
                } else {
                    mostrarNotificacion(data.message || 'Error al renombrar', 'error');
                }
                btnGuardarNombre.innerHTML = '<i class="fas fa-save"></i> Guardar';
            })
            .catch(() => {
                mostrarNotificacion('Error de conexión', 'error');
                btnGuardarNombre.innerHTML = '<i class="fas fa-save"></i> Guardar';
            });
        });
    }

    // ==========================================
    // 4. FUNCIONES DE UTILIDAD
    // ==========================================
    function cargarAjustesLocales() {
        const prefGuardadas = JSON.parse(localStorage.getItem('preferenciasIoT'));
        if (prefGuardadas) {
            if (document.getElementById('intervaloActualizacion')) document.getElementById('intervaloActualizacion').value = prefGuardadas.intervalo;
            if (document.getElementById('tema')) document.getElementById('tema').value = prefGuardadas.tema;
            if (document.getElementById('notificaciones')) document.getElementById('notificaciones').value = prefGuardadas.notificaciones;
            aplicarTemaGlobal(prefGuardadas.tema);
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

    function mostrarNotificacion(mensaje, tipo) {
        const notificacion = document.getElementById('notificacion');
        const icono = document.getElementById('notificacionIcono');
        const texto = document.getElementById('notificacionMensaje');
        if (!notificacion) return;
        texto.textContent = mensaje;
        notificacion.className = `notificacion mostrar ${tipo === 'error' ? 'error' : ''}`;
        if (tipo === 'success') {
            if (icono) icono.className = 'fas fa-check-circle';
        } else {
            if (icono) icono.className = 'fas fa-exclamation-triangle';
        }
        setTimeout(() => {
            notificacion.classList.remove('mostrar');
        }, 3000);
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});