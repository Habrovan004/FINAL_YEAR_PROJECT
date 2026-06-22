from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator

class PatientProfile(models.Model):
    objects = models.Manager()

    PREGNANCY_STATUS = [
        ('pregnant', 'Currently Pregnant'),
        ('planning', 'Planning Pregnancy'),
        ('not_now', 'Not Right Now'),
    ]
    LANGUAGE_CHOICES = [('en', 'English'), ('sw', 'Swahili')]
    FONT_SIZE_CHOICES = [
        ('small', 'Small'),
        ('medium', 'Medium'),
        ('large', 'Large'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    assigned_provider = models.ForeignKey('accounts.ProviderProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='patients')
    
    pregnancy_status = models.CharField(max_length=20, choices=PREGNANCY_STATUS, default='pregnant')
    lmp_date = models.DateField(null=True, blank=True, help_text="Last Menstrual Period date")
    due_date = models.DateField(null=True, blank=True)
    
    weight_kg = models.FloatField(null=True, blank=True, validators=[MinValueValidator(20.0)])
    height_cm = models.FloatField(null=True, blank=True, validators=[MinValueValidator(50.0)])
    
    is_first_pregnancy = models.BooleanField(default=True)
    previous_pregnancies = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    previous_complications = models.JSONField(default=lambda: [], blank=True)

    hospital = models.ForeignKey('hospitals.Hospital', on_delete=models.SET_NULL, null=True, blank=True)
    partner_phone = models.CharField(max_length=20, blank=True)
    language = models.CharField(max_length=5, choices=LANGUAGE_CHOICES, default='en')
    font_size = models.CharField(max_length=10, choices=FONT_SIZE_CHOICES, default='medium')
    
    notifications_enabled = models.BooleanField(default=True)
    audio_guidance = models.BooleanField(default=False)
    large_text_mode = models.BooleanField(default=False)
    onboarding_completed = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def pregnancy_week(self):
        if self.lmp_date:
            days = (timezone.localdate() - self.lmp_date).days
            if days < 0: return 0
            return days // 7
        return 0

    def trimester(self):
        week = self.pregnancy_week()
        if week <= 12: return '1st'
        elif week <= 26: return '2nd'
        elif week > 26: return '3rd'
        return 'Not Pregnant'

    def __str__(self):
        return f"Profile of user #{self.user_id}"

class BabyGrowth(models.Model):
    # Added Manager for IDE
    objects = models.Manager()

    week = models.IntegerField(unique=True, help_text="Week of pregnancy")
    title = models.CharField(max_length=200)
    title_sw = models.CharField(max_length=200, blank=True)
    
    # Detailed development info
    description = models.TextField()
    description_sw = models.TextField(blank=True)
    organ_formation = models.TextField(blank=True, help_text="Major organs forming this week")
    
    size_comparison = models.CharField(max_length=100, blank=True, help_text="e.g., 'A blueberry'")
    size_comparison_sw = models.CharField(max_length=100, blank=True)
    
    length_cm = models.FloatField(null=True, blank=True)
    weight_g = models.FloatField(null=True, blank=True)
    
    image = models.ImageField(upload_to='baby_growth_images/', blank=True, null=True)

    class Meta:
        ordering = ['week']
        verbose_name_plural = "Baby Growth Information"

    def __str__(self):
        return f"Week {self.week}: {self.title}"

class ANCMilestone(models.Model):
    objects = models.Manager()
    
    week = models.IntegerField(help_text="Target week for this ANC milestone")
    title = models.CharField(max_length=200)
    title_sw = models.CharField(max_length=200)
    description = models.TextField()
    description_sw = models.TextField()
    
    class Meta:
        ordering = ['week']

    def __str__(self):
        return f"ANC {self.week}: {self.title}"
