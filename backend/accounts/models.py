import random
import string
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

class UserManager(BaseUserManager):
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError('Phone number is required')
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(phone_number, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    objects = UserManager()

    USER_TYPES = [
        ('patient', 'Mother'),
        ('partner', 'Partner'),
        ('provider', 'Healthcare Provider'),
        ('hospital_manager', 'Hospital Manager'),
    ]

    phone_number = models.CharField(max_length=20, unique=True)
    email = models.EmailField(blank=True, null=True)
    full_name = models.CharField(max_length=150)
    user_type = models.CharField(max_length=20, choices=USER_TYPES, default='patient')
    date_of_birth = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return str(self.full_name)

class ProviderProfile(models.Model):
    objects = models.Manager()
    
    SPECIALIZATIONS = [
        ('obstetrician', 'Obstetrician'),
        ('midwife', 'Midwife'),
        ('nurse', 'Nurse Practitioner'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='provider_profile')
    hospital = models.ForeignKey('hospitals.Hospital', on_delete=models.CASCADE, related_name='providers')
    specialization = models.CharField(max_length=20, choices=SPECIALIZATIONS)
    is_available = models.BooleanField(default=True)
    max_workload = models.IntegerField(default=50)
    current_workload = models.IntegerField(default=0)

    def __str__(self):
        # Explicit type conversion to avoid IDE errors
        return "Provider: " + str(self.user.full_name)

class HospitalManagerProfile(models.Model):
    objects = models.Manager()

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='manager_profile')
    hospital = models.ForeignKey('hospitals.Hospital', on_delete=models.CASCADE, related_name='managers')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return "Manager: " + str(self.user.full_name)


class OTPCode(models.Model):
    objects = models.Manager()
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otp_codes')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    def is_expired(self):
        now = timezone.now()
        diff = now - self.created_at
        return diff.total_seconds() > 600

    @classmethod
    def generate_for_user(cls, user):
        # Delete all previous OTPs for this user first
        cls.objects.filter(user=user).delete()
        otp_code = str(random.randint(100000, 999999))
        return cls.objects.create(user=user, code=otp_code)

class PartnerLink(models.Model):
    objects = models.Manager()
    
    patient = models.OneToOneField(User, on_delete=models.CASCADE, related_name='partner_link')
    partner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='patient_links')
    partner_phone = models.CharField(max_length=20)
    invitation_code = models.CharField(max_length=10, unique=True)
    is_confirmed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def generate_invitation(cls, patient, partner_phone):
        # Simplified generator
        chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        code = ''.join(random.choice(chars) for _ in range(8))
        return cls.objects.update_or_create(
            patient=patient,
            defaults={'partner_phone': partner_phone, 'invitation_code': code, 'is_confirmed': False}
        )

    def __str__(self):
        return "Link: " + str(self.patient.full_name)
