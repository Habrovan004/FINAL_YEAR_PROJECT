from django.contrib import admin
from .models import PatientProfile, BabyGrowth, ANCMilestone

@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'pregnancy_status', 'lmp_date', 'due_date', 'hospital', 'assigned_provider', 'onboarding_completed')
    list_filter = ('pregnancy_status', 'is_first_pregnancy', 'onboarding_completed', 'language')
    search_fields = ('user__full_name', 'user__phone_number', 'hospital__name')
    raw_id_fields = ('user', 'hospital', 'assigned_provider')
    fieldsets = (
        (None, {'fields': ('user', 'assigned_provider', 'hospital', 'onboarding_completed')}),
        ('Pregnancy Details', {'fields': ('pregnancy_status', 'lmp_date', 'due_date', 'is_first_pregnancy', 'previous_pregnancies', 'previous_complications')}),
        ('Measurements & Preferences', {'fields': ('weight_kg', 'height_cm', 'language', 'notifications_enabled', 'audio_guidance', 'large_text_mode')}),
        ('Partner Info', {'fields': ('partner_phone',)}),
    )

@admin.register(BabyGrowth)
class BabyGrowthAdmin(admin.ModelAdmin):
    list_display = ('week', 'title', 'size_comparison', 'length_cm', 'weight_g')
    search_fields = ('title', 'description', 'size_comparison')
    list_filter = ('week',)

@admin.register(ANCMilestone)
class ANCMilestoneAdmin(admin.ModelAdmin):
    list_display = ('week', 'title')
    search_fields = ('title', 'description')
    list_filter = ('week',)
