import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from patients.models import BabyGrowth
from tips.models import Tip, TipCategory
from hospitals.models import Hospital
from tracking.models import Symptom

def seed():
    print("🌱 Seeding Mimba Yangu database...")

    # 1. Seed Symptoms
    symptoms = [
        {"name": "Nausea", "name_sw": "Kichefuchefu", "icon": "🤢"},
        {"name": "Headache", "name_sw": "Maumivu ya kichwa", "icon": "🤕"},
        {"name": "Fatigue", "name_sw": "Uchovu", "icon": "😴"},
        {"name": "Swelling", "name_sw": "Kuvimba", "icon": "🦶"},
        {"name": "Back Pain", "name_sw": "Maumivu ya mgongo", "icon": "🦴"},
        {"name": "Heartburn", "name_sw": "Kiungulia", "icon": "🔥"},
    ]
    for s in symptoms:
        Symptom.objects.get_or_create(name=s['name'], defaults=s)
    print("✅ Symptoms seeded.")

    # 2. Seed Hospitals
    hospitals = [
        {
            "name": "Muhimbili National Hospital",
            "type": "public",
            "services": "Full Maternity, NICU, Emergency surgery",
            "phone": "+255 22 215 1367",
            "address": "Kalenga St, Dar es Salaam",
            "latitude": -6.8066,
            "longitude": 39.2747
        },
        {
            "name": "Aga Khan Hospital",
            "type": "private",
            "services": "Premium Maternity, Specialized Pediatrics",
            "phone": "+255 22 211 5151",
            "address": "Ocean Road, Dar es Salaam",
            "latitude": -6.8011,
            "longitude": 39.2897
        },
        {
            "name": "Amana Regional Referral Hospital",
            "type": "public",
            "services": "Maternity Ward, ANC Clinics",
            "phone": "+255 22 284 3301",
            "address": "Ilala, Dar es Salaam",
            "latitude": -6.8225,
            "longitude": 39.2655
        }
    ]
    for h in hospitals:
        Hospital.objects.get_or_create(name=h['name'], defaults=h)
    print("✅ Hospitals seeded.")

    # 3. Seed Baby Growth (Sample for brevity, can be expanded to 40)
    growth_data = [
        {"week": 4, "title": "The Journey Begins", "title_sw": "Safari Inaanza", "size_comparison": "A Poppy Seed", "description": "The blastocyst has implanted in your uterus. It's tiny but growing fast!"},
        {"week": 8, "title": "Baby's Moving!", "title_sw": "Mtoto Anacheza", "size_comparison": "A Raspberry", "description": "Baby's arms and legs are growing, and the heart is beating twice as fast as yours."},
        {"week": 12, "title": "End of 1st Trimester", "title_sw": "Mwisho wa Muhula wa 1", "size_comparison": "A Lime", "description": "Baby's fingers and toes are fully formed. The risk of miscarriage drops significantly."},
        {"week": 20, "title": "Halfway There!", "title_sw": "Nusu ya Safari", "size_comparison": "A Banana", "description": "You might feel baby's first kicks now! This is a great time for an ultrasound."},
        {"week": 32, "title": "Practicing Breathing", "title_sw": "Mazoezi ya Kupumua", "size_comparison": "A Squash", "description": "Baby is practicing breathing and opening their eyes. They are getting plump!"},
        {"week": 40, "title": "Ready for the World", "title_sw": "Tayari kwa Dunia", "size_comparison": "A Watermelon", "description": "Congratulations! Baby is fully formed and ready to meet you any day now."},
    ]
    for g in growth_data:
        BabyGrowth.objects.update_or_create(week=g['week'], defaults=g)
    print("✅ Baby growth data seeded.")

    # 4. Seed Tip Categories and Tips
    cat_nutrition, _ = TipCategory.objects.get_or_create(name="Nutrition", defaults={"name_sw": "Lishe", "icon": "🥗", "color": "#dcfce7"})
    cat_warning, _ = TipCategory.objects.get_or_create(name="Warning Signs", defaults={"name_sw": "Dalili za Hatari", "icon": "⚠️", "color": "#fee2e2"})

    tips = [
        {
            "category": cat_nutrition,
            "title": "Stay Hydrated",
            "title_sw": "Kunywa Maji ya Kutosha",
            "description": "Drink at least 8-10 glasses of water daily to maintain amniotic fluid levels.",
            "tip_type": "nutrition",
            "trimester": "all",
            "is_daily": True
        },
        {
            "category": cat_warning,
            "title": "Severe Headache",
            "title_sw": "Maumivu Makali ya Kichwa",
            "description": "If you have a headache that won't go away, contact your doctor as it could be a sign of high blood pressure.",
            "tip_type": "warning",
            "trimester": "2",
            "is_daily": False
        },
        {
            "category": cat_nutrition,
            "title": "Eat Iron-Rich Foods",
            "title_sw": "Kula Vyakula vyenye Chuma",
            "description": "Focus on spinach, liver, and beans to prevent anemia during your second trimester.",
            "tip_type": "nutrition",
            "trimester": "2",
            "is_daily": True
        }
    ]
    for t in tips:
        Tip.objects.get_or_create(title=t['title'], defaults=t)
    print("✅ Tip categories and tips seeded.")

    print("\n🚀 All done! Your Mimba Yangu app is now full of content.")

if __name__ == "__main__":
    seed()
