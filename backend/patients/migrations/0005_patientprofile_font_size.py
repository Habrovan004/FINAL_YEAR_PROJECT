# Generated manually to align PatientProfile with the current model.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0004_ancmilestone_babygrowth_length_cm_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='patientprofile',
            name='font_size',
            field=models.CharField(
                choices=[('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')],
                default='medium',
                max_length=10,
            ),
        ),
    ]
