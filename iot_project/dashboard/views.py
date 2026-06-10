# dashboard/views.py
import requests 
from django.shortcuts import render, redirect
from django.http import JsonResponse
from datetime import datetime
import json

API_BASE_URL = 'https://api-iot-lxy7.onrender.com/api'



def get_value_status(value, type):
    """ Determina el estado (color) de un valor """
    if value is None:
        return ''
    try:
        value = float(value)
    except (ValueError, TypeError):
        return ''

    if type == 'temperatura':
        if 20 <= value <= 25: return 'value-good'
        if (18 <= value < 20) or (25 < value <= 28): return 'value-warning'
        return 'value-danger'
    if type == 'ph':
        if 6.5 <= value <= 7.5: return 'value-good'
        if (6 <= value < 6.5) or (7.5 < value <= 8): return 'value-warning'
        return 'value-danger'
    if type == 'oxigeno':
        if 5 <= value <= 7: return 'value-good'
        if (4 <= value < 5) or (7 < value <= 8): return 'value-warning'
        return 'value-danger'
    if type == 'tds':
        if 20 <= value <= 50: return 'value-good'
        if 60 <= value <= 75: return 'value-warning'
        if value > 100: return 'value-danger'
        return 'value-danger'
    return ''

def check_critical_parameters(sensores):
    """ Revisa si hay valores críticos """
    problems = []
    if sensores.get('temperatura') is not None and float(sensores['temperatura']) > 32:
        problems.append({
            'name': 'Temperatura', 'value': sensores['temperatura'], 
            'limit': 32, 'unit': '°C'
        })
    if sensores.get('ph') is not None and float(sensores['ph']) > 8:
        problems.append({
            'name': 'pH', 'value': sensores['ph'], 
            'limit': 8, 'unit': ''
        })
    if sensores.get('solidos_disueltos') is not None and float(sensores['solidos_disueltos']) > 100:
        problems.append({
            'name': 'Sólidos Disueltos (TDS)', 'value': sensores['solidos_disueltos'], 
            'limit': 100, 'unit': 'TDS'
        })
    return problems

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
            # CORREGIDO: Usar requests (librería) en lugar de request (Django)
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
                request.session['api_token'] = data.get('token')
                request.session['user'] = data.get('user')
                request.session.pop('last_alert_time', None)
                return redirect('dashboard')

        # CORREGIDO: Usar requests.exceptions
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
    """ 
    Vista que devuelve JSON para actualizar el dashboard vía AJAX.
    Esta es la que consulta dashboard.js 
    """
    token = request.session.get('api_token')
    if not token:
        return JsonResponse({'error': 'No autorizado'}, status=401)

    headers = {'Authorization': f'Bearer {token}'}
    data = {}

    try:
        # 1. Obtener estanques
        tanks_res = requests.get(f'{API_BASE_URL}/tanks', headers=headers, timeout=5)
        if tanks_res.ok:
            tanks = tanks_res.json()
            if tanks:
                estanque_id = tanks[0]['_id']
                
                # 2. Obtener lecturas
                readings_res = requests.get(
                    f'{API_BASE_URL}/sensor-readings/{estanque_id}?limit=1', 
                    headers=headers, timeout=5
                )
                
                if readings_res.ok:
                    lecturas = readings_res.json()
                    if lecturas:
                        latest = lecturas[0]
                        sensores = latest.get('valores_sensores', {})
                        
                        # Preparamos los datos EXACTOS que espera el JS
                        data = {
                            'temperatura': sensores.get('temperatura'),
                            'temp_status': get_value_status(sensores.get('temperatura'), 'temperatura'),
                            
                            'ph': sensores.get('ph'),
                            'ph_status': get_value_status(sensores.get('ph'), 'ph'),
                            
                            'solidos_disueltos': sensores.get('solidos_disueltos'),
                            'tds_status': get_value_status(sensores.get('solidos_disueltos'), 'tds'),
                            
                            'oxigeno': sensores.get('oxigeno'),
                            'oxigeno_status': get_value_status(sensores.get('oxigeno'), 'oxigeno'),
                            
                            'timestamp': datetime.now().isoformat() # Hora del servidor
                        }

    except Exception as e:
        print(f"Error API JSON: {e}")
        return JsonResponse({'error': 'Error interno'}, status=500)

    return JsonResponse(data)


def dashboard_view(request):
    """ Vista principal del Dashboard. """
    
    # 1. Proteger la ruta
    token = request.session.get('api_token')
    if not token:
        return redirect('login')

    # 2. Preparar el contexto
    context = {}
    headers = {'Authorization': f'Bearer {token}'}

    try:
        # CORREGIDO: Usar requests.get
        tanks_response = requests.get(f'{API_BASE_URL}/tanks', headers=headers, timeout=10)
        tanks_response.raise_for_status()
        tanks = tanks_response.json()

        if tanks:
            estanque_id = tanks[0]['_id']
            
            # CORREGIDO: Usar requests.get
            readings_response = requests.get(
                f'{API_BASE_URL}/sensor-readings/{estanque_id}?limit=1', 
                headers=headers, 
                timeout=10
            )
            readings_response.raise_for_status()
            readings = readings_response.json()

            if readings:
                latest_data = readings[0]
                sensores = latest_data.get('valores_sensores', {})
                
                context['temperatura'] = sensores.get('temperatura')
                context['ph'] = sensores.get('ph')
                context['solidos_disueltos'] = sensores.get('solidos_disueltos')
                context['oxigeno'] = sensores.get('oxigeno')
                
                if latest_data.get('timestamp'):
                    context['timestamp'] = datetime.fromisoformat(
                        latest_data['timestamp'].replace('Z', '+00:00')
                    )

                context['temp_status'] = get_value_status(context['temperatura'], 'temperatura')
                context['ph_status'] = get_value_status(context['ph'], 'ph')
                context['tds_status'] = get_value_status(context['solidos_disueltos'], 'tds')
                context['oxigeno_status'] = get_value_status(context['oxigeno'], 'oxigeno')

                problems = check_critical_parameters(sensores)
                if problems:
                    current_time = datetime.now().timestamp()
                    last_alert_time = request.session.get('last_alert_time', 0)
                    ALERT_COOLDOWN = 2 * 60 * 60

                    if (current_time - last_alert_time) >= ALERT_COOLDOWN:
                        context['show_alert'] = True
                        context['problems'] = problems
                        request.session['last_alert_time'] = current_time

    # CORREGIDO: Usar requests.exceptions
    except requests.exceptions.RequestException as e:
        if hasattr(e, 'response') and e.response is not None:
            if e.response.status_code in [401, 403]:
                request.session.flush()
                return redirect('login')
        
        print(f"Error al obtener datos del API: {e}")
        context['api_error'] = 'No se pudieron cargar los datos de los sensores.'
    
    except Exception as e:
        print(f"Error inesperado en dashboard: {e}")
        context['api_error'] = 'Ocurrió un error inesperado.'

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
            payload = {
                'email': email,
                'password': password,
                'rol': 'user'
            }
            
            api_url = f'{API_BASE_URL}/users/register' 
            
            # CORREGIDO: Usar requests.post
            response = requests.post(api_url, json=payload, timeout=30)
            
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

        # CORREGIDO: Usar requests.exceptions
        except requests.exceptions.RequestException as e:
            print(f"Error de conexión con la API de registro: {e}")
            context['error_message'] = 'No se pudo conectar con el servidor de registro.'
            return render(request, 'dashboard/register.html', context)
        
        except Exception as e:
            print(f"Error inesperado en registro: {e}")
            context['error_message'] = 'Ha ocurrido un error inesperado.'
            return render(request, 'dashboard/register.html', context)
        
def usuarios_view(request): 
    # 1. Comprobar sesión
    token = request.session.get('api_token')
    if not token:
        return redirect('login')
        
    # 2. Comprobar rol de admin
    user_data = request.session.get('user', {})
    user_role = user_data.get('rolUser', 'user').lower()
    
    if user_role != 'admin':
        return redirect('dashboard')

    context = {
        'api_token': token
    }
    return render(request, 'dashboard/usuarios.html', context)

def informes_view(request):
    token = request.session.get('api_token')
    if not token: return redirect('login')
    
    # SEGURIDAD: Solo admin
    user_data = request.session.get('user', {})
    if user_data.get('rolUser') != 'admin':
        return redirect('dashboard') # Lo mandamos de vuelta al dashboard
        
    context = {'api_token': token}
    return render(request, 'dashboard/informes.html', context)

def historial_view(request):
    token = request.session.get('api_token')
    if not token: return redirect('login')
    
    # SEGURIDAD: Solo admin
    user_data = request.session.get('user', {})
    if user_data.get('rolUser') != 'admin':
        return redirect('dashboard')

    context = {'api_token': token}
    return render(request, 'dashboard/historial.html', context)

def ajustes_view(request):
    token = request.session.get('api_token')
    if not token: return redirect('login')

    user_data = request.session.get('user', {})
    if user_data.get('rolUser') != 'admin':
        return redirect('dashboard')

    context = {
        'api_token': token,
        'user_json': json.dumps(user_data) # <-- La línea mágica
    }
    return render(request, 'dashboard/ajustes.html', context)
    
def perfil_view(request):
    token = request.session.get('api_token')
    if not token:
        return redirect('login')
        
    user_data = request.session.get('user', {})    
        
    context = {
        'api_token': token,
        'user_json': json.dumps(user_data) # <-- La línea mágica
    }
    return render(request, 'dashboard/perfil.html', context)

#Funcionalidad para recuperar contraseña (Cambio realizado por Andy Alcázar)

import requests
from django.shortcuts import render
from dashboard.config.firebase_config import FIREBASE_API_KEY



def reset_password_view(request):

    if request.method == "POST":

        email = request.POST.get("email", "").strip()

        if not email:
            return render(
                request,
                "dashboard/reset_password.html",
                {
                    "error": "Por favor ingrese su correo electrónico"
                }
            )

        try:

            response = requests.post(
    f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={FIREBASE_API_KEY}",
    json={
        "requestType": "PASSWORD_RESET",
        "email": email
    }
)

            if response.status_code == 200:

                return render(
                    request,
                    "dashboard/reset_password.html",
                    {
                        "success": "El correo se envió correctamente."
                    }
                )

            error_data = response.json()

            return render(
                request,
                "dashboard/reset_password.html",
                {
                    "error": error_data.get(
                        "error",
                        {}
                    ).get(
                        "message",
                        "No fue posible enviar el correo."
                    )
                }
            )

        except Exception as e:

            return render(
                request,
                "dashboard/reset_password.html",
                {
                    "error": str(e)
                }
            )

    return render(
        request,
        "dashboard/reset_password.html"
    )