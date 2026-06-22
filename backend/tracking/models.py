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
        """
        Module 3: Clinical Decision Support Engine
        Evaluates combinations of symptoms against medical rules.
        """
        symptom_names = [s.name.lower() for s in self.symptoms.all()]
        danger_count = self.symptoms.filter(is_danger_sign=True).count()
        
        # High Risk Rules (Immediate Alert)
        high_risk_triggers = [
            'severe headache', 'blurred vision', 'bleeding', 'reduced fetal movement',
            'convulsions', 'fever', 'abdominal pain'
        ]
        
        # 1. Any specific High Risk symptom or more than 2 danger signs
        is_high = any(trigger in symptom_names for trigger in high_risk_triggers) or danger_count >= 2
        
        if is_high:
            self.risk_level = 'high'
            self.clinical_recommendation = "URGENT: Please proceed to the nearest medical facility immediately. Your healthcare provider has been alerted."
            # Here we would trigger the SMS/Provider Alert
            return
            
        # 2. Medium Risk Rules (Provider Notification)
        medium_risk_triggers = ['swelling', 'nausea', 'dizziness', 'anxiety']
        is_medium = any(trigger in symptom_names for trigger in medium_risk_triggers) or danger_count == 1
        
        if is_medium:
            self.risk_level = 'medium'
            self.clinical_recommendation = "CAUTION: Your symptoms require a follow-up. A healthcare provider will contact you shortly for a routine review."
            return

        # 3. Low Risk (Self-care Guidance)
        self.risk_level = 'low'
        self.clinical_recommendation = "CONTINUE CARE: Your symptoms appear normal for your stage. Stay hydrated and rest. If symptoms worsen, please report again."
