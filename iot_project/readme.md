# 🐟 AcuaTech - Sistema de Monitoreo IoT para Tilapias

**AcuaTech** es una solución integral basada en **Django** y **MySQL** diseñada para el monitoreo en tiempo real de la calidad del agua en estanques de cultivo de tilapia. El sistema permite a los acuicultores visualizar parámetros críticos para prevenir enfermedades y reducir significativamente la mortalidad de los peces.

---

## 🚀 Características Principales

* **Panel de Control (Dashboard)**: Interfaz dinámica con tarjetas informativas que muestran datos actualizados de los sensores.
* **Monitoreo de Parámetros Críticos**: Seguimiento constante de temperatura, pH, oxígeno disuelto y sólidos disueltos (TDS).
* **Visualización Histórica**: Gráficas interactivas desarrolladas con **Chart.js** para analizar el comportamiento del agua a lo largo del tiempo.
* **Generación de Informes**: Capacidad para exportar datos históricos en formatos **PDF** y **Excel** para auditorías y control.
* **Diseño 100% Responsivo**: Optimización completa para dispositivos móviles, incluyendo un menú de navegación tipo hamburguesa personalizado.

---

## 🛠️ Stack Tecnológico

* **Backend**: Python & Django.
* **Base de Datos**: MySQL (para almacenamiento robusto de registros).
* **Frontend**: HTML5, CSS3 (Pico.css para estilos base ligeros) y JavaScript.
* **Seguridad**: Manejo de autenticación de usuarios y protección de rutas críticas.

---

## 📦 Instalación y Uso Local

Para ejecutar este proyecto en tu entorno local, sigue estos pasos:

1.  **Clonar el proyecto**:
    ```bash
    git clone [https://github.com/Proyectos-ITVH/AppWeb.git](https://github.com/Proyectos-ITVH/AppWeb.git)
    ```

2.  **Configurar el entorno virtual**:
    Utiliza el nombre exacto de la carpeta ignorada para mantener el orden:
    ```bash
    python -m venv iot_proyect_env
    iot_proyect_env\Scripts\activate  # En Windows
    ```

3.  **Instalar dependencias**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Ejecutar la aplicación**:
    ```bash
    python manage.py runserver
    ```

---

## 📝 Notas de Seguridad
El proyecto utiliza un archivo `.gitignore` para proteger el entorno virtual (`iot_proyect_env/`) y archivos de configuración local, asegurando que las credenciales de la base de datos y llaves secretas no sean públicas.

---
**Desarrollado como parte del proyecto de innovación tecnológica 2026.**