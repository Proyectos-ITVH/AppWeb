from django.urls import path
from . import views

urlpatterns = [
    # Autenticación
    path('', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),

    # Vistas Principales (HTML)
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('usuarios/', views.usuarios_view, name='usuarios'),
    path('informes/', views.informes_view, name='informes'),
    path('historial/', views.historial_view, name='historial'),
    path('ajustes/', views.ajustes_view, name='ajustes'),
    path('perfil/', views.perfil_view, name='perfil'),

   
    path('api/datos-dashboard/', views.obtener_datos_json, name='api_datos'),
]