import string
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

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
        ('provider', 'Healthcare Provider'),
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
