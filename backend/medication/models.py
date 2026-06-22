from django.db import models
from django.conf import settings

class Prescription(models.Model):
    FREQUENCY_CHOICES = [
        ('1', 'Once a day'),
        ('2', 'Twice a day'),
        ('3', 'Three times a day'),
        ('4', 'Four times a day'),
        ('custom', 'Custom schedule'),
    ]

    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='prescriptions')
    provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='issued_prescriptions')
    
    medication_name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=100, help_text="e.g., 200mg")
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES)
    duration_days = models.IntegerField()
    instructions = models.TextField(blank=True, help_text="e.g., Take after meals")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    start_date = models.DateField()

    def __str__(self):
        return f"{self.medication_name} for {self.patient.full_name}"

class MedicationReminder(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='reminders')
    scheduled_time = models.DateTimeField()
    is_sent = models.BooleanField(default=False)
    is_acknowledged = models.BooleanField(default=False, help_text="User confirmed taking medication")
    
    # Tracking status
    sent_at = models.DateTimeField(null=True, blank=True)
    sms_status = models.CharField(max_length=50, blank=True, help_text="Status from Africa's Talking")

    class Meta:
        ordering = ['scheduled_time']

    def __str__(self):
        return f"Reminder: {self.prescription.medication_name} at {self.scheduled_time}"
