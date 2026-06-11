from django.db import models

class ConfiguracionEstanque(models.Model):
    # Guardamos el ID que viene de tu API externa para saber de qué estanque hablamos
    estanque_id = models.CharField(max_length=100, unique=True)
    nombre_estanque = models.CharField(max_length=150, default="Estanque")

    # Rangos de Temperatura (°C)
    temp_min = models.FloatField(default=20.0)
    temp_max = models.FloatField(default=30.0)

    # Rangos de pH
    ph_min = models.FloatField(default=6.5)
    ph_max = models.FloatField(default=8.5)

    # Rangos de Sólidos Disueltos (TDS)
    tds_min = models.FloatField(default=0.0)
    tds_max = models.FloatField(default=500.0)

    # Rangos de Oxígeno Disuelto (mg/L)
    oxigeno_min = models.FloatField(default=5.0)
    oxigeno_max = models.FloatField(default=20.0)

    # Fecha de última modificación
    ultima_actualizacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Configuración: {self.nombre_estanque}"

class SensorPersonalizado(models.Model):
    estanque_id = models.CharField(max_length=100)
    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=50) # Ej. TURBIDEZ, AMONIACO
    rango_min = models.FloatField(default=0.0)
    rango_max = models.FloatField(default=100.0)

    def __str__(self):
        return f"{self.nombre} - Estanque {self.estanque_id}"