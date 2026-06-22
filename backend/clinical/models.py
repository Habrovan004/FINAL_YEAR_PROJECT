from django.db import models
from django.conf import settings

class ANCVisit(models.Model):
    COMPLICATION_CHOICES = [
        ('none', 'None'),
        ('hypertension', 'Pregnancy-induced Hypertension'),
        ('diabetes', 'Gestational Diabetes'),
        ('anemia', 'Anemia'),
        ('swelling', 'Severe Swelling'),
        ('other', 'Other Complication'),
    ]

    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='anc_visits')
    provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conducted_visits')
    
    visit_date = models.DateTimeField(auto_now_add=True)
    weight_kg = models.FloatField()
    blood_pressure_systolic = models.IntegerField(help_text="Top number (e.g., 120)")
    blood_pressure_diastolic = models.IntegerField(help_text="Bottom number (e.g., 80)")
    gestational_age_weeks = models.IntegerField()
    complications = models.CharField(max_length=50, choices=COMPLICATION_CHOICES, default='none')
    visit_notes = models.TextField(blank=True)
    
    # Recommendations stored with the visit
    recommendations = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-visit_date']

    def __str__(self):
        return f"Visit for {self.patient.full_name} on {self.visit_date.date()}"

    def generate_recommendations(self):
        """
        Rule-based clinical recommendation engine logic.
        """
        recs = []
        
        # 1. Blood Pressure Check
        if self.blood_pressure_systolic >= 140 or self.blood_pressure_diastolic >= 90:
            recs.append({
                'type': 'alert',
                'title': 'High Blood Pressure Warning',
                'message': 'Possible pregnancy-induced hypertension. Monitor closely and consider protein-in-urine test.'
            })
            
        # 2. Weight Check (Basic logic: significant changes)
        # In a real app, we would compare with the PREVIOUS visit weight
        if self.weight_kg < 45:
             recs.append({
                'type': 'info',
                'title': 'Nutritional Assessment',
                'message': 'Low maternal weight. Recommend increased caloric and iron intake.'
            })

        # 3. Gestational Age Specifics
        if self.gestational_age_weeks >= 36:
            recs.append({
                'type': 'info',
                'title': 'Birth Preparation',
                'message': 'Nearing full term. Discuss birth plan and emergency signs with the mother.'
            })
            
        # 4. Complication Specifics
        if self.complications == 'anemia':
            recs.append({
                'type': 'action',
                'title': 'Anemia Management',
                'message': 'Prescribe iron/folic acid supplements and schedule a follow-up blood test in 2 weeks.'
            })

        return recs

    def save(self, *args, **kwargs):
        # Auto-generate recommendations before saving if empty
        if not self.recommendations:
            self.recommendations = self.generate_recommendations()
        super().save(*args, **kwargs)
