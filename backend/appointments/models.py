from django.db import models
from django.conf import settings

class Appointment(models.Model):
    objects = models.Manager()

    VISIT_TYPES = [
        ('anc', 'ANC Routine Check-up'),
        ('ultrasound', 'Ultrasound Scan'),
        ('blood_test', 'Blood Test'),
        ('consultation', 'Doctor Consultation'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('attended', 'Attended'),
        ('missed', 'Missed'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='appointments')
    provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='provider_appointments', null=True)
    hospital = models.ForeignKey('hospitals.Hospital', on_delete=models.SET_NULL, null=True, blank=True)

    visit_type = models.CharField(max_length=20, choices=VISIT_TYPES, default='anc')
    appointment_date = models.DateField()
    appointment_time = models.TimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='upcoming')

    notes = models.TextField(blank=True)
    what_to_bring = models.TextField(blank=True)

    # SMS Reminder Status Tracking
    reminder_48h_sent = models.BooleanField(default=False)
    reminder_2h_sent = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['appointment_date', 'appointment_time']
        # Rule: One appointment per provider at the same date/time
        unique_together = ('provider', 'appointment_date', 'appointment_time')

    def __str__(self):
        return f"{self.user.full_name} with {self.provider.full_name if self.provider else 'N/A'} on {self.appointment_date}"
