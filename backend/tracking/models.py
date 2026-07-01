from django.db import models
from django.conf import settings

class Symptom(models.Model):
    # IDE Support
    objects = models.Manager()

    name = models.CharField(max_length=100)
    name_sw = models.CharField(max_length=100, blank=True)
    icon = models.CharField(max_length=50, blank=True)
    severity_relevant = models.BooleanField(default=True)
    is_danger_sign = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class MoodLog(models.Model):
    objects = models.Manager()

    MOOD_CHOICES = [
        (5, 'Great'), (4, 'Good'), (3, 'Okay'), (2, 'Not well'), (1, 'Bad')
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mood_logs')
    mood = models.IntegerField(choices=MOOD_CHOICES)
    symptoms = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    weight_kg = models.FloatField(null=True, blank=True)
    baby_kicks = models.IntegerField(null=True, blank=True)
    logged_at = models.DateTimeField(auto_now_add=True)
    date = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ['-logged_at']
        unique_together = ['user', 'date']

    def __str__(self):
        return f"{self.user.full_name} on {self.date}"

class SymptomReport(models.Model):
    objects = models.Manager()

    RISK_LEVELS = [
        ('low', 'Low Risk'),
        ('medium', 'Medium Risk'),
        ('high', 'High Risk'),
    ]

    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='symptom_reports')
    symptoms = models.ManyToManyField(Symptom, related_name='reports')
    additional_notes = models.TextField(blank=True)

    risk_level = models.CharField(max_length=10, choices=RISK_LEVELS, default='low')
    clinical_recommendation = models.TextField(blank=True)

    is_reviewed = models.BooleanField(default=False)
    provider_action_taken = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Report from {self.patient.full_name} - {self.risk_level.upper()}"

    def evaluate_risk(self):
        from tracking.utils import assess_clinical_risk
        risk, recommendation, _ = assess_clinical_risk(self.symptoms.all())
        self.risk_level = risk
        self.clinical_recommendation = recommendation
