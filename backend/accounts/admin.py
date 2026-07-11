from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from .models import User, ProviderProfile

# Custom forms for UserAdmin to handle phone_number instead of username
class UserAdminCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('phone_number', 'full_name', 'user_type') # Include full_name and user_type

    def clean_phone_number(self):
        phone_number = self.cleaned_data['phone_number']
        if User.objects.filter(phone_number=phone_number).exists():
            raise forms.ValidationError("A user with that phone number already exists.")
        return phone_number

class UserAdminChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = '__all__'

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserAdminChangeForm
    add_form = UserAdminCreationForm

    list_display = ('phone_number', 'full_name', 'user_type', 'is_verified', 'is_staff', 'is_active')
    list_filter = ('user_type', 'is_verified', 'is_staff', 'is_active')
    search_fields = ('phone_number', 'full_name')
    ordering = ('phone_number',)

    fieldsets = (
        (None, {'fields': ('phone_number', 'password')}),
        ('Personal info', {'fields': ('full_name', 'date_of_birth', 'user_type')}),
        ('Permissions', {'fields': ('is_active', 'is_verified', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'created_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'full_name', 'user_type', 'password', 'password2'),
        }),
    )
    readonly_fields = ('last_login', 'created_at')

@admin.register(ProviderProfile)
class ProviderProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'hospital', 'specialization', 'is_available', 'current_workload', 'max_workload')
    list_filter = ('hospital', 'specialization', 'is_available')
    search_fields = ('user__full_name', 'user__phone_number', 'hospital__name')
    raw_id_fields = ('user', 'hospital') # Use raw_id_fields for FKs to avoid dropdown performance issues