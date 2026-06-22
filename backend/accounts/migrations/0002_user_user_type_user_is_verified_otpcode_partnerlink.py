from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='user_type',
            field=models.CharField(choices=[('patient', 'Patient'), ('partner', 'Partner'), ('admin', 'Admin')], default='patient', max_length=10),
        ),
        migrations.CreateModel(
            name='OTPCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=6)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_used', models.BooleanField(default=False)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='otp_codes', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='PartnerLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('partner_phone', models.CharField(max_length=20)),
                ('invitation_code', models.CharField(max_length=10, unique=True)),
                ('is_confirmed', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('partner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='patient_links', to=settings.AUTH_USER_MODEL)),
                ('patient', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='partner_link', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
