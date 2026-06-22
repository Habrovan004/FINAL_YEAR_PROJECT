from django.db import models

class Hospital(models.Model):
    HOSPITAL_TYPES = [('public', 'Public'), ('private', 'Private'), ('maternity', 'Maternity Center')]
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=HOSPITAL_TYPES, default='public')
    services = models.CharField(max_length=200, blank=True, help_text="e.g. Full maternity, NICU")
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self): return self.name
