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
    # Touched (at most every few minutes) by JWTAuthentication on any
    # authenticated API call — the closest proxy we have to "opened the app",
    # used to decide whether a mother needs an SMS nudge on a provider reply.
    last_active_at = models.DateTimeField(null=True, blank=True)

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

class PasswordResetCode(models.Model):
    """One-time code proving phone-number ownership before a password reset.

    Scoped specifically to password reset (not a generic reusable OTP model)
    since that's the only place this is needed right now.
    """
    objects = models.Manager()

    RESET_CODE_TTL_MINUTES = 10

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_codes')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def is_expired(self):
        return timezone.now() > self.expires_at

    @classmethod
    def generate_for_user(cls, user):
        # A stale, still-pending code shouldn't remain valid once a new one
        # is requested — but keep used codes around as an audit trail.
        cls.objects.filter(user=user, is_used=False).delete()
        code = str(random.randint(100000, 999999))
        expires_at = timezone.now() + timezone.timedelta(minutes=cls.RESET_CODE_TTL_MINUTES)
        return cls.objects.create(user=user, code=code, expires_at=expires_at)
