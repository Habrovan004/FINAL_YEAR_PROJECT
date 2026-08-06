from django.core.management.base import BaseCommand
from hospitals.models import Hospital

HOSPITALS = [
    {"name": "Muhimbili National Hospital", "latitude": -6.7985, "longitude": 39.2191, "type": "public", "address": "Kalenga St, Dar es Salaam", "phone": "+255222151367", "services": "Full Maternity, NICU, Emergency"},
    {"name": "Temeke Regional Hospital", "latitude": -6.8560, "longitude": 39.2403, "type": "public", "address": "Kilwa Rd, Temeke, Dar es Salaam", "phone": "+255222843301", "services": "Maternity Ward, ANC Clinics"},
    {"name": "Mwananyamala Hospital", "latitude": -6.7652, "longitude": 39.2345, "type": "public", "address": "Bagamoyo Rd, Dar es Salaam", "phone": "+255222772222", "services": "Maternity, Pediatrics, General Care"},
    {"name": "Aga Khan Hospital", "latitude": -6.8002, "longitude": 39.2731, "type": "private", "address": "Ocean Road, Dar es Salaam", "phone": "+255222115151", "services": "Premium Maternity, Specialized Pediatrics"},
    {"name": "Regency Medical Centre", "latitude": -6.7730, "longitude": 39.2580, "type": "private", "address": "Ali Hassan Mwinyi Rd, Dar es Salaam", "phone": "+255222150500", "services": "Maternity, Advanced Diagnostics"},
    {"name": "CCBRT Hospital", "latitude": -6.7690, "longitude": 39.2390, "type": "private", "address": "Bagamoyo Rd, Dar es Salaam", "phone": "+255222622683", "services": "Maternity, Disability & Rehabilitation"},
    {"name": "Marie Stopes Tanzania", "latitude": -6.7850, "longitude": 39.2000, "type": "private", "address": "Kinondoni Rd, Dar es Salaam", "phone": "+255744550000", "services": "Reproductive Health, Family Planning"},
    {"name": "Ocean Road Cancer Institute", "latitude": -6.8020, "longitude": 39.2880, "type": "public", "address": "Ocean Road, Dar es Salaam", "phone": "+255222127200", "services": "Oncology (Specialized, not primary maternity)"},
    {"name": "St. Francis Hospital", "latitude": -7.0000, "longitude": 39.2000, "type": "private", "address": "Mbagala, Dar es Salaam", "phone": "+255754789012", "services": "General Care, Basic Maternity"},
    {"name": "Sinza Hospital", "latitude": -6.7800, "longitude": 39.2000, "type": "public", "address": "Sinza, Dar es Salaam", "phone": "+255222700000", "services": "General Care, Basic Maternity"},
    {"name": "Amana Regional Referral Hospital", "latitude": -6.8225, "longitude": 39.2655, "type": "public", "address": "Ilala, Dar es Salaam", "phone": "+255 22 284 3301", "services": "Maternity Ward, ANC Clinics"},
]

class Command(BaseCommand):
    help = 'Seeds initial hospital data into the database.'

    def handle(self, *args, **kwargs):
        for h in HOSPITALS:
            Hospital.objects.get_or_create(
                name=h['name'], 
                defaults={
                    'latitude': h['latitude'], 
                    'longitude': h['longitude'], 
                    'type': h['type'],
                    'address': h['address'],
                    'phone': h['phone'],
                    'services': h['services'],
                    'is_active': True
                }
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(HOSPITALS)} hospitals."))

