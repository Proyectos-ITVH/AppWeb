# dashboard/views.py
import requests 
from django.shortcuts import render, redirect
from django.http import JsonResponse
from datetime import datetime
import json
from .models import ConfiguracionEstanque, SensorPersonalizado

API_BASE_URL = 'https://api-iot-lxy7.onrender.com/api'


def get_value_status(value, config, param_type):
    """
    Determina el color de un valor basándose en los rangos de la BD.
    Usa un margen del 10% para el estado warning.
    """
    if value is None:
        return ''
    try:
        value = float(value)
    except (ValueError, TypeError):
        return ''

    rangos = {
        'temperatura': (config.temp_min, config.temp_max),
        'ph':          (config.ph_min,   config.ph_max),
        'tds':         (config.tds_min,  config.tds_max),
        'oxigeno':     (config.oxigeno_min, config.oxigeno_max),
    }

    if param_type not in rangos:
        return ''

    minimo, maximo = rangos[param_type]
    rango = maximo - minimo
    margen = rango * 0.10

    if minimo <= value <= maximo:
        return 'value-good'
    elif (minimo - margen) <= value <= (maximo + margen):
        return 'value-warning'
    else:
        return 'value-danger'


def fuera_de_rango(valor, minimo, maximo):
    try:
        v = float(valor)
        return v < minimo or v > maximo
    except (TypeError, ValueError):
        return False


# --- Vistas de Django ---

def login_view(request):
    """ Maneja el inicio de sesión. """
    if 'api_token' in request.session:
        return redirect('dashboard')

    error_message = None

    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')

        try:
            response = requests.post(
                f'{API_BASE_URL}/users/login',
                json={'email': email, 'password': password},
                timeout=30 
            )

            if not response.ok:
                error_data = response.json()
                error_message = error_data.get('message', 'Error: Credenciales incorrectas.')
            else:
                data = response.json()
                user = data.get('user')
                user['nombre_display'] = email.split('@')[0]
                request.session['api_token'] = data.get('token')
                request.session['user'] = user
                request.session.pop('last_alert_time', None)
                return redirect('dashboard')

        except requests.exceptions.RequestException as e:
            print(f"Error de conexión con la API: {e}")
            error_message = 'No se pudo conectar con el servidor de autenticación.'
        except Exception as e:
            print(f"Error inesperado en login: {e}")
            error_message = 'Ha ocurrido un error inesperado.'

    context = {'error': error_message}
    return render(request, 'dashboard/login.html', context)


def logout_view(request):
    """ Limpia la sesión de Django. """
    request.session.flush()
    return redirect('login')


def obtener_datos_json(request):
    token = request.session.get('api_token')
    if not token:
        return JsonResponse({'error': 'No autorizado'}, status=401)

    headers = {'Authorization': f'Bearer {token}'}
    estanques_lista = []
    all_problems = []

    try:
        tanks_res = requests.get(f'{API_BASE_URL}/tanks', headers=headers, timeout=5)
        if tanks_res.ok:
            tanks = tanks_res.json()
            
            for tank in tanks:
                t_id = tank['_id']
                tank_data = {
                    'id': t_id,
                    'nombre': tank.get('nombre', 'Estanque sin nombre'),
                    'temperatura': '--', 'temp_status': '',
                    'ph': '--', 'ph_status': '',
                    'solidos_disueltos': '--', 'tds_status': '',
                    'oxigeno': '--', 'oxigeno_status': ''
                }
                
                config, _ = ConfiguracionEstanque.objects.get_or_create(
                    estanque_id=t_id,
                    defaults={'nombre_estanque': tank.get('nombre', 'Estanque')}
                )

                readings_res = requests.get(
                    f'{API_BASE_URL}/sensor-readings/{t_id}?limit=1', 
                    headers=headers, timeout=5
                )
                
                if readings_res.ok:
                    lecturas = readings_res.json()
                    if lecturas:
                        sensores = lecturas[0].get('valores_sensores', {})
                        
                        tank_data['temperatura'] = sensores.get('temperatura', '--')
                        tank_data['temp_status'] = get_value_status(sensores.get('temperatura'), config, 'temperatura')
                        tank_data['ph'] = sensores.get('ph', '--')
                        tank_data['ph_status'] = get_value_status(sensores.get('ph'), config, 'ph')
                        tank_data['solidos_disueltos'] = sensores.get('solidos_disueltos', '--')
                        tank_data['tds_status'] = get_value_status(sensores.get('solidos_disueltos'), config, 'tds')
                        tank_data['oxigeno'] = sensores.get('oxigeno', '--')
                        tank_data['oxigeno_status'] = get_value_status(sensores.get('oxigeno'), config, 'oxigeno')
                        
                        if fuera_de_rango(sensores.get('temperatura'), config.temp_min, config.temp_max):
                            all_problems.append({'tank_name': tank_data['nombre'], 'name': 'Temperatura', 'value': sensores.get('temperatura')})
                        if fuera_de_rango(sensores.get('ph'), config.ph_min, config.ph_max):
                            all_problems.append({'tank_name': tank_data['nombre'], 'name': 'pH', 'value': sensores.get('ph')})
                        if fuera_de_rango(sensores.get('solidos_disueltos'), config.tds_min, config.tds_max):
                            all_problems.append({'tank_name': tank_data['nombre'], 'name': 'Sólidos Disueltos', 'value': sensores.get('solidos_disueltos')})
                        if fuera_de_rango(sensores.get('oxigeno'), config.oxigeno_min, config.oxigeno_max):
                            all_problems.append({'tank_name': tank_data['nombre'], 'name': 'Oxígeno', 'value': sensores.get('oxigeno')})

                estanques_lista.append(tank_data)

        return JsonResponse({
            'estanques': estanques_lista, 
            'problems': all_problems, 
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        print(f"Error API JSON: {e}")
        return JsonResponse({'error': 'Error interno'}, status=500)


def dashboard_view(request):
    """ Vista principal del Dashboard Multi-Estanque. """
    token = request.session.get('api_token')
    if not token:
        return redirect('login')

    context = {}
    headers = {'Authorization': f'Bearer {token}'}
    estanques_data = []
    all_problems = []

    try:
        tanks_response = requests.get(f'{API_BASE_URL}/tanks', headers=headers, timeout=10)
        tanks_response.raise_for_status()
        tanks = tanks_response.json()

        for tank in tanks:
            t_id = tank['_id']
            tank_info = {
                'id': t_id,
                'id_limpio': t_id,
                'nombre': tank.get('nombre', 'Estanque'),
                'temperatura': '--', 'ph': '--', 'solidos_disueltos': '--', 'oxigeno': '--',
                'temp_status': '', 'ph_status': '', 'tds_status': '', 'oxigeno_status': ''
            }

            config, _ = ConfiguracionEstanque.objects.get_or_create(
                estanque_id=t_id,
                defaults={'nombre_estanque': tank.get('nombre', 'Estanque')}
            )

            readings_response = requests.get(
                f'{API_BASE_URL}/sensor-readings/{t_id}?limit=1', 
                headers=headers, timeout=10
            )
            
            if readings_response.ok:
                readings = readings_response.json()
                if readings:
                    sensores = readings[0].get('valores_sensores', {})
                    
                    tank_info['temperatura'] = sensores.get('temperatura')
                    tank_info['ph'] = sensores.get('ph')
                    tank_info['solidos_disueltos'] = sensores.get('solidos_disueltos')
                    tank_info['oxigeno'] = sensores.get('oxigeno')
                    
                    tank_info['temp_status'] = get_value_status(sensores.get('temperatura'), config, 'temperatura')
                    tank_info['ph_status'] = get_value_status(sensores.get('ph'), config, 'ph')
                    tank_info['tds_status'] = get_value_status(sensores.get('solidos_disueltos'), config, 'tds')
                    tank_info['oxigeno_status'] = get_value_status(sensores.get('oxigeno'), config, 'oxigeno')
                    
                    if fuera_de_rango(sensores.get('temperatura'), config.temp_min, config.temp_max):
                        all_problems.append({'tank_name': tank_info['nombre'], 'name': 'Temperatura', 'value': sensores.get('temperatura')})
                    if fuera_de_rango(sensores.get('ph'), config.ph_min, config.ph_max):
                        all_problems.append({'tank_name': tank_info['nombre'], 'name': 'pH', 'value': sensores.get('ph')})
                    if fuera_de_rango(sensores.get('solidos_disueltos'), config.tds_min, config.tds_max):
                        all_problems.append({'tank_name': tank_info['nombre'], 'name': 'Sólidos Disueltos', 'value': sensores.get('solidos_disueltos')})
                    if fuera_de_rango(sensores.get('oxigeno'), config.oxigeno_min, config.oxigeno_max):
                        all_problems.append({'tank_name': tank_info['nombre'], 'name': 'Oxígeno', 'value': sensores.get('oxigeno')})
                        
            estanques_data.append(tank_info)
        
        context['estanques_data'] = estanques_data
        context['timestamp'] = datetime.now()
        
        if all_problems:
            context['show_alert'] = True
            context['problems'] = all_problems

    except Exception as e:
        print(f"Error inesperado en dashboard: {e}")
        context['api_error'] = 'No se pudieron estructurar los paneles locales.'

    return render(request, 'dashboard/principal.html', context)


def register_view(request):
    """ Maneja el registro de nuevos usuarios. """
    context = {}
    
    if request.method == 'GET':
        return render(request, 'dashboard/register.html', context)
    
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirmPassword')

        if password != confirm_password:
            context['error_message'] = 'Las contraseñas no coinciden.'
            return render(request, 'dashboard/register.html', context)
        
        try:
            payload = {'email': email, 'password': password, 'rol': 'user'}
            response = requests.post(f'{API_BASE_URL}/users/register', json=payload, timeout=30)
            
            if response.ok:
                context['success_message'] = True
                return render(request, 'dashboard/register.html', context)
            else:
                error_data = response.json()
                message = error_data.get('message', 'Error desconocido.')
                if 'auth/email-already-in-use' in message:
                    context['error_message'] = 'El correo electrónico ya está en uso.'
                elif 'auth/invalid-email' in message:
                    context['error_message'] = 'El formato del correo electrónico no es válido.'
                elif 'auth/weak-password' in message:
                    context['error_message'] = 'La contraseña es demasiado débil (mínimo 6 caracteres).'
                else:
                    context['error_message'] = message
                return render(request, 'dashboard/register.html', context)

        except requests.exceptions.RequestException as e:
            print(f"Error de conexión con la API de registro: {e}")
            context['error_message'] = 'No se pudo conectar con el servidor de registro.'
            return render(request, 'dashboard/register.html', context)
        except Exception as e:
            print(f"Error inesperado en registro: {e}")
            context['error_message'] = 'Ha ocurrido un error inesperado.'
            return render(request, 'dashboard/register.html', context)


def usuarios_view(request): 
    token = request.session.get('api_token')
    if not token:
        return redirect('login')
    user_data = request.session.get('user', {})
    if user_data.get('rolUser', 'user').lower() != 'admin':
        return redirect('dashboard')
    context = {'api_token': token}
    return render(request, 'dashboard/usuarios.html', context)


def informes_view(request):
    token = request.session.get('api_token')
    if not token: return redirect('login')
    user_data = request.session.get('user', {})
    if user_data.get('rolUser') != 'admin':
        return redirect('dashboard')
    context = {'api_token': token}
    return render(request, 'dashboard/informes.html', context)


def historial_view(request):
    token = request.session.get('api_token')
    if not token: return redirect('login')
    user_data = request.session.get('user', {})
    if user_data.get('rolUser') != 'admin':
        return redirect('dashboard')
    context = {'api_token': token}
    return render(request, 'dashboard/historial.html', context)


def ajustes_view(request):
    token = request.session.get('api_token')
    user_data = request.session.get('user', {})

    if not token:
        return redirect('login')
    if user_data.get('rolUser') != 'admin':
        return redirect('dashboard')

    headers = {'Authorization': f'Bearer {token}'}

    if request.method == 'POST':
        try:
            datos = json.loads(request.body)
            action = datos.get('action')
            estanque_id = datos.get('estanque_id')

            if action == 'agregar_sensor':
                SensorPersonalizado.objects.create(
                    estanque_id=estanque_id,
                    nombre=datos.get('nombre'),
                    tipo=datos.get('tipo'),
                    rango_min=float(datos.get('rango_min')),
                    rango_max=float(datos.get('rango_max'))
                )
                return JsonResponse({'status': 'success', 'message': 'Nuevo sensor registrado localmente'})

            elif action == 'editar_sensor':
                param_id = str(datos.get('param_id'))
                val_min = float(datos.get('rango_min'))
                val_max = float(datos.get('rango_max'))

                if param_id.startswith('extra_'):
                    real_id = param_id.split('_')[1]
                    sensor = SensorPersonalizado.objects.get(id=real_id)
                    sensor.rango_min = val_min
                    sensor.rango_max = val_max
                    sensor.save()
                else:
                    config = ConfiguracionEstanque.objects.get(estanque_id=estanque_id)
                    if param_id == 'temp':
                        config.temp_min, config.temp_max = val_min, val_max
                    elif param_id == 'ph':
                        config.ph_min, config.ph_max = val_min, val_max
                    elif param_id == 'tds':
                        config.tds_min, config.tds_max = val_min, val_max
                    elif param_id == 'oxigeno':
                        config.oxigeno_min, config.oxigeno_max = val_min, val_max
                    config.save()
                return JsonResponse({'status': 'success', 'message': 'Rangos actualizados'})

            elif action == 'renombrar_estanque':
                nuevo_nombre = datos.get('nuevo_nombre')
                api_response = requests.put(
                    f'{API_BASE_URL}/tanks/{estanque_id}',
                    headers={**headers, 'Content-Type': 'application/json'},
                    json={'nombre': nuevo_nombre},
                    timeout=10
                )
                if api_response.ok:
                    config = ConfiguracionEstanque.objects.get(estanque_id=estanque_id)
                    config.nombre_estanque = nuevo_nombre
                    config.save()
                    return JsonResponse({'status': 'success', 'message': 'Estanque renombrado correctamente'})
                else:
                    return JsonResponse({'status': 'error', 'message': 'La API no pudo renombrar el estanque'}, status=400)

        except Exception as e:
            print(f"Error en ajustes: {e}")
            return JsonResponse({'status': 'error', 'message': 'Hubo un error al procesar'}, status=400)

    context = {'api_token': token, 'user_json': json.dumps(user_data)}
    try:
        tanks_res = requests.get(f'{API_BASE_URL}/tanks', headers=headers, timeout=15)
        if tanks_res.ok:
            tanks = tanks_res.json()
        else:
            tanks = []

        estanques_con_rangos = []
        for tank in tanks:
            t_id = tank['_id']
            t_nombre = tank.get('nombre', 'Estanque')
            config, _ = ConfiguracionEstanque.objects.get_or_create(
                estanque_id=t_id, defaults={'nombre_estanque': t_nombre}
            )
            sensores_extra = list(SensorPersonalizado.objects.filter(estanque_id=t_id).values(
                'id', 'nombre', 'tipo', 'rango_min', 'rango_max'
            ))
            estanques_con_rangos.append({
                'id': t_id,
                'nombre': t_nombre,
                'rangos_fijos': {
                    'temp_min': config.temp_min, 'temp_max': config.temp_max,
                    'ph_min': config.ph_min, 'ph_max': config.ph_max,
                    'tds_min': config.tds_min, 'tds_max': config.tds_max,
                    'oxigeno_min': config.oxigeno_min, 'oxigeno_max': config.oxigeno_max,
                },
                'sensores_extra': sensores_extra
            })
        context['estanques_json'] = json.dumps(estanques_con_rangos)

    except Exception as e:
        print("Error:", e)
        context['estanques_json'] = '[]'

    return render(request, 'dashboard/ajustes.html', context)


def perfil_view(request):
    token = request.session.get('api_token')
    if not token:
        return redirect('login')
    user_data = request.session.get('user', {})
    context = {'api_token': token, 'user_json': json.dumps(user_data)}
    return render(request, 'dashboard/perfil.html', context)


# Funcionalidad para recuperar contraseña
import requests
from django.shortcuts import render
from dashboard.config.firebase_config import FIREBASE_API_KEY


def reset_password_view(request):
    if request.method == "POST":
        email = request.POST.get("email", "").strip()
        if not email:
            return render(request, "dashboard/reset_password.html", {"error": "Por favor ingrese su correo electrónico"})
        try:
            response = requests.post(
                f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={FIREBASE_API_KEY}",
                json={"requestType": "PASSWORD_RESET", "email": email}
            )
            if response.status_code == 200:
                return render(request, "dashboard/reset_password.html", {"success": "El correo se envió correctamente."})
            error_data = response.json()
            return render(request, "dashboard/reset_password.html", {
                "error": error_data.get("error", {}).get("message", "No fue posible enviar el correo.")
            })
        except Exception as e:
            return render(request, "dashboard/reset_password.html", {"error": str(e)})

    return render(request, "dashboard/reset_password.html")