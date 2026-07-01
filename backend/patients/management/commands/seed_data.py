from django.core.management.base import BaseCommand

from patients.models import BabyGrowth
from tips.models import Tip, TipCategory
from hospitals.models import Hospital
from tracking.models import Symptom


class Command(BaseCommand):
    help = 'Seed core app data: symptoms, hospitals, baby growth milestones, and tip categories/tips.'

    def handle(self, *args, **options):
        self.stdout.write('Seeding Mimba Yangu database...')
        self._seed_symptoms()
        self._seed_hospitals()
        self._seed_baby_growth()
        self._seed_tips()
        self.stdout.write(self.style.SUCCESS('All done! Your Mimba Yangu app is now full of content.'))

    def _seed_symptoms(self):
        symptoms = [
            {'name': 'Nausea',     'name_sw': 'Kichefuchefu',       'icon': '🤢'},
            {'name': 'Headache',   'name_sw': 'Maumivu ya kichwa',  'icon': '🤕'},
            {'name': 'Fatigue',    'name_sw': 'Uchovu',             'icon': '😴'},
            {'name': 'Swelling',   'name_sw': 'Kuvimba',            'icon': '🦶'},
            {'name': 'Back Pain',  'name_sw': 'Maumivu ya mgongo',  'icon': '🦴'},
            {'name': 'Heartburn',  'name_sw': 'Kiungulia',          'icon': '🔥'},
        ]
        for s in symptoms:
            Symptom.objects.get_or_create(name=s['name'], defaults=s)
        self.stdout.write('  Symptoms seeded.')

    def _seed_hospitals(self):
        hospitals = [
            {
                'name': 'Muhimbili National Hospital',
                'type': 'public',
                'services': 'Full Maternity, NICU, Emergency surgery',
                'phone': '+255 22 215 1367',
                'address': 'Kalenga St, Dar es Salaam',
                'latitude': -6.8066,
                'longitude': 39.2747,
            },
            {
                'name': 'Aga Khan Hospital',
                'type': 'private',
                'services': 'Premium Maternity, Specialized Pediatrics',
                'phone': '+255 22 211 5151',
                'address': 'Ocean Road, Dar es Salaam',
                'latitude': -6.8011,
                'longitude': 39.2897,
            },
            {
                'name': 'Amana Regional Referral Hospital',
                'type': 'public',
                'services': 'Maternity Ward, ANC Clinics',
                'phone': '+255 22 284 3301',
                'address': 'Ilala, Dar es Salaam',
                'latitude': -6.8225,
                'longitude': 39.2655,
            },
        ]
        for h in hospitals:
            Hospital.objects.get_or_create(name=h['name'], defaults=h)
        self.stdout.write('  Hospitals seeded.')

    def _seed_baby_growth(self):
        growth_data = [
            {
                'week': 4, 'emoji': '🌱',
                'title': 'Early Foundations', 'title_sw': 'Misingi ya Awali',
                'size_comparison': 'poppy seed', 'size_comparison_sw': 'mbegu ya popi',
                'length_cm': 0.2,
                'description': 'The neural tube and early placenta are forming.',
                'description_sw': 'Mrija wa neva na placenta ya awali zinaundwa.',
                'baby_facts': ['Early brain and spine cells are developing', 'The placenta starts supporting growth'],
                'baby_facts_sw': ['Seli za awali za ubongo na mgongo zinakua', 'Placenta inaanza kusaidia ukuaji'],
                'mother_feels': ['Missed period', 'Tender breasts', 'Tiredness may begin'],
                'mother_feels_sw': ['Hedhi kukosa', 'Maumivu ya matiti', 'Uchovu unaweza kuanza'],
            },
            {
                'week': 8, 'emoji': '🫐',
                'title': 'Tiny Limbs', 'title_sw': 'Viungo Vidogo',
                'size_comparison': 'blueberry', 'size_comparison_sw': 'blueberry',
                'length_cm': 1.6,
                'description': 'Tiny arms, legs, and facial features are taking shape.',
                'description_sw': 'Mikono midogo, miguu, na sura za uso zinaanza kuunda.',
                'baby_facts': ['Heartbeat is usually present', 'Fingers and toes are beginning'],
                'baby_facts_sw': ['Mapigo ya moyo huwa yanasikika', 'Vidole vya mikono na miguu vinaanza'],
                'mother_feels': ['Nausea can be stronger', 'Frequent urination', 'Food smells may bother you'],
                'mother_feels_sw': ['Kichefuchefu kinaweza kuwa kikali', 'Kukojoa mara kwa mara', 'Harufu ya chakula inaweza kusumbua'],
            },
            {
                'week': 12, 'emoji': '🍋',
                'title': 'End of 1st Trimester', 'title_sw': 'Mwisho wa Muhula wa 1',
                'size_comparison': 'lime', 'size_comparison_sw': 'limau',
                'length_cm': 5.4,
                'description': 'Most major organs have formed and will keep maturing.',
                'description_sw': 'Viungo vingi vikubwa vimeundwa na vitaendelea kukomaa.',
                'baby_facts': ['Baby can make small movements', 'Reflexes are starting'],
                'baby_facts_sw': ['Mtoto anaweza kufanya mwendo mdogo', 'Mienendo ya akili inaanza'],
                'mother_feels': ['Energy may slowly return', 'Waistbands may feel tight', 'Nausea may ease soon'],
                'mother_feels_sw': ['Nguvu inaweza kurejea polepole', 'Mikanda ya kiuno inaweza kubana', 'Kichefuchefu kinaweza kupungua'],
            },
            {
                'week': 17, 'emoji': '🍌',
                'title': 'Hearing the World', 'title_sw': 'Kusikia Dunia',
                'size_comparison': 'banana', 'size_comparison_sw': 'ndizi',
                'length_cm': 16.4,
                'description': 'Baby can hear sounds outside the womb.',
                'description_sw': 'Mtoto anaweza kusikia sauti za nje ya tumbo.',
                'baby_facts': ['Hearing is developing', 'Tiny fingerprints are forming', 'Baby is practicing swallowing'],
                'baby_facts_sw': ['Usikivu unakua', 'Alama za vidole zinaundwa', 'Mtoto anajifunza kumeza'],
                'mother_feels': ['Kicks becoming more regular', 'Back pain may start', 'You may notice round ligament pain'],
                'mother_feels_sw': ['Mapigo yanazidi kuwa ya kawaida', 'Maumivu ya mgongo yanaweza kuanza', 'Unaweza kuhisi maumivu ya mishipa'],
            },
            {
                'week': 20, 'emoji': '🥭',
                'title': 'Halfway There', 'title_sw': 'Nusu ya Safari',
                'size_comparison': 'mango', 'size_comparison_sw': 'embe',
                'length_cm': 25.6,
                'description': 'Movements may become easier to recognize this week.',
                'description_sw': 'Mwendo unaweza kuwa rahisi kutambua wiki hii.',
                'baby_facts': ['Sleep and wake cycles are developing', 'Skin is protected by vernix'],
                'baby_facts_sw': ['Mizunguko ya usingizi na uamsho inakua', 'Ngozi inalindwa na vernix'],
                'mother_feels': ['Stronger flutters or kicks', 'Leg cramps may start', 'Appetite may increase'],
                'mother_feels_sw': ['Mapigo au mwendo wa nguvu zaidi', 'Mikazo ya miguu inaweza kuanza', 'Hamu ya kula inaweza kuongezeka'],
            },
            {
                'week': 24, 'emoji': '🌽',
                'title': 'Building Lungs', 'title_sw': 'Mapafu Yanajengwa',
                'size_comparison': 'ear of corn', 'size_comparison_sw': 'sikio la mahindi',
                'length_cm': 30.0,
                'description': 'Lungs are developing important air sacs.',
                'description_sw': 'Mapafu yanakua na mifuko muhimu ya hewa.',
                'baby_facts': ['Baby responds to sound', 'Taste buds are active'],
                'baby_facts_sw': ['Mtoto anaitikia sauti', 'Vionjo vya ladha vinatumika'],
                'mother_feels': ['Belly growth feels faster', 'Mild swelling can happen', 'Back strain may increase'],
                'mother_feels_sw': ['Tumbo linaonekana kukua haraka', 'Uvimbe mdogo unaweza kutokea', 'Mkazo wa mgongo unaweza kuongezeka'],
            },
            {
                'week': 28, 'emoji': '🍆',
                'title': 'Eyes Open', 'title_sw': 'Macho Yanafunguka',
                'size_comparison': 'eggplant', 'size_comparison_sw': 'biringanya',
                'length_cm': 37.6,
                'description': 'Baby can blink and is building more body fat.',
                'description_sw': 'Mtoto anaweza kufumba macho na anajenga mafuta zaidi mwilini.',
                'baby_facts': ['Eyes open and close', 'Brain growth is rapid'],
                'baby_facts_sw': ['Macho yanafunguka na kufungwa', 'Ukuaji wa ubongo ni wa haraka'],
                'mother_feels': ['Shortness of breath may appear', 'Sleep may be harder', 'Braxton Hicks may start'],
                'mother_feels_sw': ['Kuhema kunaweza kuonekana', 'Kulala kunaweza kuwa kugumu', 'Mikazo ya Braxton Hicks inaweza kuanza'],
            },
            {
                'week': 32, 'emoji': '🥥',
                'title': 'Practicing Breathing', 'title_sw': 'Mazoezi ya Kupumua',
                'size_comparison': 'coconut', 'size_comparison_sw': 'nazi',
                'length_cm': 42.4,
                'description': 'Baby is gaining weight and practicing breathing movements.',
                'description_sw': 'Mtoto anaongeza uzito na kujifunza mwendo wa kupumua.',
                'baby_facts': ['Bones are hardening', 'Movements may feel stronger but less roomy'],
                'baby_facts_sw': ['Mifupa inakuwa ngumu', 'Mwendo unaweza kuhisi wa nguvu lakini nafasi ni ndogo'],
                'mother_feels': ['Pelvic pressure', 'Heartburn may increase', 'More frequent urination'],
                'mother_feels_sw': ['Shinikizo la nyonga', 'Kiungulia kinaweza kuongezeka', 'Kukojoa zaidi'],
            },
            {
                'week': 36, 'emoji': '🍈',
                'title': 'Getting Ready', 'title_sw': 'Maandalizi',
                'size_comparison': 'melon', 'size_comparison_sw': 'tikiti',
                'length_cm': 47.4,
                'description': 'Baby is getting ready for birth.',
                'description_sw': 'Mtoto anajiandaa kwa kuzaliwa.',
                'baby_facts': ['Baby may move head-down', 'Lungs are nearly mature'],
                'baby_facts_sw': ['Mtoto anaweza kugeuka kichwa chini', 'Mapafu yanakaribia kukomaa'],
                'mother_feels': ['Pressure lower in the belly', 'Walking may feel slower', 'Practice contractions'],
                'mother_feels_sw': ['Shinikizo chini ya tumbo', 'Kutembea kunaweza kuhisi polepole', 'Mikazo ya mazoezi'],
            },
            {
                'week': 40, 'emoji': '🎉',
                'title': 'Ready for the World', 'title_sw': 'Tayari kwa Dunia',
                'size_comparison': 'small pumpkin', 'size_comparison_sw': 'malenge dogo',
                'length_cm': 51.2,
                'description': 'Baby is full term and ready to meet you.',
                'description_sw': 'Mtoto amekamilika na yuko tayari kukutana nawe.',
                'baby_facts': ['Organs are ready for life outside', 'Baby continues gaining a little weight'],
                'baby_facts_sw': ['Viungo viko tayari kwa maisha ya nje', 'Mtoto anaendelea kuongeza uzito kidogo'],
                'mother_feels': ['More pelvic pressure', 'Stronger contractions may begin', 'Call care when labor signs start'],
                'mother_feels_sw': ['Shinikizo zaidi la nyonga', 'Mikazo ya nguvu inaweza kuanza', 'Pigia huduma ukianza kuona dalili za leba'],
            },
        ]
        for g in growth_data:
            BabyGrowth.objects.update_or_create(week=g['week'], defaults=g)
        self.stdout.write('  Baby growth data seeded.')

    def _seed_tips(self):
        cat_nutrition, _ = TipCategory.objects.get_or_create(
            name='Nutrition',
            defaults={'name_sw': 'Lishe', 'icon': '🥗', 'color': '#dcfce7'},
        )
        cat_warning, _ = TipCategory.objects.get_or_create(
            name='Warning Signs',
            defaults={'name_sw': 'Dalili za Hatari', 'icon': '⚠️', 'color': '#fee2e2'},
        )
        tips = [
            {
                'category': cat_nutrition,
                'title': 'Stay Hydrated',
                'title_sw': 'Kunywa Maji ya Kutosha',
                'description': 'Drink at least 8-10 glasses of water daily to maintain amniotic fluid levels.',
                'tip_type': 'nutrition',
                'trimester': 'all',
                'is_daily': True,
            },
            {
                'category': cat_warning,
                'title': 'Severe Headache',
                'title_sw': 'Maumivu Makali ya Kichwa',
                'description': 'If you have a headache that won\'t go away, contact your doctor.',
                'tip_type': 'warning',
                'trimester': '2',
                'is_daily': False,
            },
            {
                'category': cat_nutrition,
                'title': 'Eat Iron-Rich Foods',
                'title_sw': 'Kula Vyakula vyenye Chuma',
                'description': 'Focus on spinach, liver, and beans to prevent anemia during your second trimester.',
                'tip_type': 'nutrition',
                'trimester': '2',
                'is_daily': True,
            },
        ]
        for t in tips:
            Tip.objects.get_or_create(title=t['title'], defaults=t)
        self.stdout.write('  Tip categories and tips seeded.')
