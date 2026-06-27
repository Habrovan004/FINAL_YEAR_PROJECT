from django.db import models
from django.conf import settings
from django.utils import timezone


# WHO-aligned danger-sign keywords. Matched case-insensitively in the
# `symptoms` free-text field. Match in either English or Swahili.
DANGER_SIGN_KEYWORDS = [
    # English
    'severe headache', 'blurred vision', 'vision change', 'vaginal bleeding',
    'heavy bleeding', 'bleeding', 'reduced fetal movement', 'no fetal movement',
    'baby not moving', 'convulsion', 'seizure', 'difficulty breathing',
    'high fever', 'severe abdominal pain', 'severe belly pain',
    'swelling of face', 'swelling of hands', 'fluid leaking',
    'water broke', 'chest pain', 'loss of consciousness', 'fainting',
    # Swahili
    'maumivu makali ya kichwa', 'kuona ukungu', 'damu', 'mtoto hatembei',
    'kutetemeka', 'kushindwa kupumua', 'homa kali', 'maumivu makali ya tumbo',
    'kuvimba uso', 'kuvimba mikono', 'kupoteza fahamu',
]


class ANCVisit(models.Model):
    COMPLICATION_CHOICES = [
        ('none', 'None'),
        ('hypertension', 'Pregnancy-induced Hypertension'),
        ('diabetes', 'Gestational Diabetes'),
        ('anemia', 'Anemia'),
        ('swelling', 'Severe Swelling'),
        ('other', 'Other Complication'),
    ]

    URINE_RESULT_CHOICES = [
        ('not_tested', 'Not tested'),
        ('negative', 'Negative'),
        ('trace', 'Trace'),
        ('1+', '1+'),
        ('2+', '2+'),
        ('3+', '3+'),
        ('4+', '4+'),
    ]

    BLOOD_GROUP_CHOICES = [
        ('unknown', 'Unknown'),
        ('A+', 'A+'), ('A-', 'A-'),
        ('B+', 'B+'), ('B-', 'B-'),
        ('AB+', 'AB+'), ('AB-', 'AB-'),
        ('O+', 'O+'), ('O-', 'O-'),
    ]

    SERO_STATUS_CHOICES = [
        ('unknown', 'Unknown / Not tested'),
        ('negative', 'Negative'),
        ('positive', 'Positive'),
        ('on_treatment', 'Positive — on treatment'),
        ('treated', 'Treated'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='anc_visits')
    provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conducted_visits')

    visit_date = models.DateTimeField(auto_now_add=True)

    # Core vitals
    weight_kg = models.FloatField()
    blood_pressure_systolic = models.IntegerField(help_text="Top number (e.g., 120)")
    blood_pressure_diastolic = models.IntegerField(help_text="Bottom number (e.g., 80)")
    gestational_age_weeks = models.IntegerField()

    # Obstetric exam
    fundal_height_cm = models.FloatField(null=True, blank=True, help_text="Symphysio-fundal height in cm")
    fetal_heart_rate_bpm = models.IntegerField(null=True, blank=True, help_text="Normal range: 110–160 bpm")
    is_multiple_pregnancy = models.BooleanField(default=False)

    # Lab results
    urine_protein = models.CharField(max_length=12, choices=URINE_RESULT_CHOICES, default='not_tested')
    urine_glucose = models.CharField(max_length=12, choices=URINE_RESULT_CHOICES, default='not_tested')
    hemoglobin_g_dl = models.FloatField(null=True, blank=True, help_text="g/dL; <11 indicates anemia in pregnancy")
    blood_group = models.CharField(max_length=10, choices=BLOOD_GROUP_CHOICES, default='unknown', blank=True)
    hiv_status = models.CharField(max_length=20, choices=SERO_STATUS_CHOICES, default='unknown')
    syphilis_status = models.CharField(max_length=20, choices=SERO_STATUS_CHOICES, default='unknown')

    # Narrative
    complications = models.CharField(max_length=50, choices=COMPLICATION_CHOICES, default='none')
    symptoms = models.TextField(blank=True, help_text="Mother's complaints, danger signs, etc.")
    visit_notes = models.TextField(blank=True, help_text="Provider notes")

    # Follow-up
    next_appointment_date = models.DateField(null=True, blank=True)

    # Risk assessment
    risk_level = models.CharField(max_length=10, choices=RISK_LEVEL_CHOICES, default='low')
    risk_reasons = models.JSONField(default=list, blank=True, help_text="List of strings explaining why this visit was flagged")
    risk_level_override = models.BooleanField(default=False, help_text="Provider manually set the risk level — skip auto-calc")

    # Recommendations stored with the visit
    recommendations = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-visit_date']

    def __str__(self):
        return f"Visit for {self.patient.full_name} on {self.visit_date.date()}"

    # ─────────────────────────── Risk evaluation ────────────────────────────

    def evaluate_risk(self):
        """Auto-detect high-risk pregnancy based on WHO-aligned criteria.

        Returns: (risk_level: str, reasons: list[str])
        """
        reasons = []

        # 1. Hypertension / preeclampsia risk
        if self.blood_pressure_systolic and self.blood_pressure_systolic >= 140:
            reasons.append(f"Systolic BP {self.blood_pressure_systolic} ≥ 140 (hypertension)")
        if self.blood_pressure_diastolic and self.blood_pressure_diastolic >= 90:
            reasons.append(f"Diastolic BP {self.blood_pressure_diastolic} ≥ 90 (hypertension)")

        # 2. Anemia (Hb < 11 g/dL during pregnancy per WHO)
        if self.hemoglobin_g_dl is not None and self.hemoglobin_g_dl < 11:
            reasons.append(f"Hemoglobin {self.hemoglobin_g_dl} g/dL < 11 (anemia)")

        # 3. Multiple pregnancy
        if self.is_multiple_pregnancy:
            reasons.append("Multiple pregnancy")

        # 4. Maternal age (uses patient.date_of_birth if available)
        try:
            dob = getattr(self.patient, 'date_of_birth', None)
            if dob:
                today = timezone.localdate()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                if age < 18:
                    reasons.append(f"Maternal age {age} < 18 (adolescent pregnancy)")
                elif age > 35:
                    reasons.append(f"Maternal age {age} > 35 (advanced maternal age)")
        except Exception:  # pragma: no cover — defensive only
            pass

        # 5. Previous complications from patient profile
        try:
            profile = getattr(self.patient, 'profile', None)
            prev = list(profile.previous_complications or []) if profile else []
            meaningful = [p for p in prev if p and str(p).lower() not in ('none', 'no', '')]
            if meaningful:
                reasons.append(f"Previous pregnancy complications: {', '.join(meaningful)}")
        except Exception:  # pragma: no cover
            pass

        # 6. Urine protein (preeclampsia / kidney disease)
        if self.urine_protein in ('2+', '3+', '4+'):
            reasons.append(f"Urine protein {self.urine_protein} (possible preeclampsia)")

        # 7. Urine glucose (gestational diabetes)
        if self.urine_glucose in ('2+', '3+', '4+'):
            reasons.append(f"Urine glucose {self.urine_glucose} (possible gestational diabetes)")

        # 8. Fetal heart rate out of normal range
        if self.fetal_heart_rate_bpm is not None:
            if self.fetal_heart_rate_bpm < 110:
                reasons.append(f"FHR {self.fetal_heart_rate_bpm} bpm < 110 (fetal bradycardia)")
            elif self.fetal_heart_rate_bpm > 160:
                reasons.append(f"FHR {self.fetal_heart_rate_bpm} bpm > 160 (fetal tachycardia)")

        # 9. Danger signs in free-text symptoms
        sx = (self.symptoms or '').lower()
        matched = [kw for kw in DANGER_SIGN_KEYWORDS if kw in sx]
        if matched:
            reasons.append(f"Danger sign(s): {', '.join(matched[:3])}")

        # 10. Pre-existing complication selection
        if self.complications and self.complications not in ('none',):
            # 'anemia' already covered by Hb; still log the selection
            reasons.append(f"Reported complication: {self.get_complications_display()}")

        if reasons:
            return ('high', reasons)

        # Medium thresholds: borderline values
        if self.blood_pressure_systolic and self.blood_pressure_systolic >= 130:
            return ('medium', [f"Borderline systolic BP {self.blood_pressure_systolic}"])
        if self.urine_protein == '1+' or self.urine_glucose == '1+':
            return ('medium', ["Trace urine findings — recheck next visit"])

        return ('low', [])

    # ─────────────────────────── Recommendations ────────────────────────────

    def generate_recommendations(self):
        """Rule-based clinical recommendation engine."""
        recs = []

        if self.blood_pressure_systolic >= 140 or self.blood_pressure_diastolic >= 90:
            recs.append({
                'type': 'alert',
                'title': 'High Blood Pressure Warning',
                'message': 'Possible pregnancy-induced hypertension. Monitor closely and check urine protein.',
            })

        if self.hemoglobin_g_dl is not None and self.hemoglobin_g_dl < 11:
            recs.append({
                'type': 'action',
                'title': 'Anemia Management',
                'message': 'Prescribe iron/folic acid supplements and schedule a follow-up blood test in 2 weeks.',
            })

        if self.weight_kg and self.weight_kg < 45:
            recs.append({
                'type': 'info',
                'title': 'Nutritional Assessment',
                'message': 'Low maternal weight. Recommend increased caloric and iron intake.',
            })

        if self.gestational_age_weeks >= 36:
            recs.append({
                'type': 'info',
                'title': 'Birth Preparation',
                'message': 'Nearing full term. Discuss birth plan and emergency signs with the mother.',
            })

        if self.complications == 'anemia':
            recs.append({
                'type': 'action',
                'title': 'Anemia Management',
                'message': 'Prescribe iron/folic acid supplements and schedule a follow-up blood test in 2 weeks.',
            })

        if self.urine_protein in ('2+', '3+', '4+'):
            recs.append({
                'type': 'alert',
                'title': 'Proteinuria',
                'message': 'Significant urine protein — assess for preeclampsia. Consider referral.',
            })

        return recs

    # ─────────────────────────── Save hook ────────────────────────────

    def save(self, *args, **kwargs):
        if not self.risk_level_override:
            level, reasons = self.evaluate_risk()
            self.risk_level = level
            self.risk_reasons = reasons
        elif not self.risk_reasons:
            # Manual override but no reasons given — record the auto reasons as context
            _, reasons = self.evaluate_risk()
            self.risk_reasons = reasons
        # Always refresh recommendations so edits stay in sync
        self.recommendations = self.generate_recommendations()
        super().save(*args, **kwargs)
