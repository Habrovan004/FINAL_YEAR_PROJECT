from django.core.management.base import BaseCommand
from tracking.models import Symptom


SYMPTOMS = [
    # (name, name_sw, icon, is_danger_sign)
    ("Nausea",                       "Kichefuchefu",                 "nausea",     False),
    ("Vomiting",                     "Kutapika",                     "vomit",      False),
    ("Headache",                     "Maumivu ya kichwa",            "headache",   False),
    ("Severe headache",              "Maumivu makali ya kichwa",     "warning",    True),
    ("Tiredness",                    "Uchovu",                       "sleep",      False),
    ("Dizziness",                    "Kizunguzungu",                 "dizzy",      False),
    ("Heartburn",                    "Kiungulia",                    "fire",       False),
    ("Back pain",                    "Maumivu ya mgongo",            "back",       False),
    ("Abdominal pain",               "Maumivu ya tumbo",             "tummy",      False),
    ("Severe abdominal pain",        "Maumivu makali ya tumbo",      "warning",    True),
    ("Swelling (feet/ankles)",       "Uvimbe wa miguu",              "foot",       False),
    ("Sudden swelling (face/hands)", "Uvimbe wa ghafla (uso/mikono)","warning",    True),
    ("Cramps",                       "Mikazo",                       "cramp",      False),
    ("Constipation",                 "Kufunga choo",                 "toilet",     False),
    ("Frequent urination",           "Kukojoa mara kwa mara",        "drop",       False),
    ("Cravings",                     "Tamaa za chakula",             "food",       False),
    ("Insomnia",                     "Kukosa usingizi",              "moon",       False),
    ("Mood swings",                  "Mabadiliko ya hisia",          "mood",       False),
    ("Breast tenderness",            "Maumivu ya matiti",            "heart",      False),
    ("Shortness of breath",          "Kuhema kwa shida",             "lung",       False),
    ("Blurred vision",               "Uoni hafifu",                  "warning",    True),
    ("Vaginal bleeding",             "Kutokwa na damu ukeni",        "warning",    True),
    ("Reduced fetal movement",       "Kupungua kwa mwendo wa mtoto", "warning",    True),
    ("Fever",                        "Homa",                         "warning",    True),
    ("Leaking fluid",                "Kuvuja kwa maji",              "warning",    True),
]


class Command(BaseCommand):
    help = "Seed the tracking.Symptom table with the standard maternal-health symptom list."

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for name, name_sw, icon, danger in SYMPTOMS:
            obj, was_created = Symptom.objects.get_or_create(
                name=name,
                defaults={"name_sw": name_sw, "icon": icon, "is_danger_sign": danger},
            )
            if was_created:
                created += 1
            else:
                changed = False
                if obj.name_sw != name_sw:
                    obj.name_sw = name_sw
                    changed = True
                if obj.icon != icon:
                    obj.icon = icon
                    changed = True
                if obj.is_danger_sign != danger:
                    obj.is_danger_sign = danger
                    changed = True
                if changed:
                    obj.save()
                    updated += 1

        total = Symptom.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f"Symptoms: +{created} created, {updated} updated, {total} total."
        ))
