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

    # 3. Seed Baby Growth — 10 milestone weeks with bilingual content.
    growth_data = [
        {
            "week": 4, "emoji": "🌱",
            "title": "Early Foundations", "title_sw": "Misingi ya Awali",
            "size_comparison": "poppy seed", "size_comparison_sw": "mbegu ya popi",
            "length_cm": 0.2,
            "description": "The neural tube and early placenta are forming.",
            "description_sw": "Mrija wa neva na placenta ya awali zinaundwa.",
            "baby_facts": [
                "Early brain and spine cells are developing",
                "The placenta starts supporting growth",
            ],
            "baby_facts_sw": [
                "Seli za awali za ubongo na mgongo zinakua",
                "Placenta inaanza kusaidia ukuaji",
            ],
            "mother_feels": [
                "Missed period",
                "Tender breasts",
                "Tiredness may begin",
            ],
            "mother_feels_sw": [
                "Hedhi kukosa",
                "Maumivu ya matiti",
                "Uchovu unaweza kuanza",
            ],
        },
        {
            "week": 8, "emoji": "🫐",
            "title": "Tiny Limbs", "title_sw": "Viungo Vidogo",
            "size_comparison": "blueberry", "size_comparison_sw": "blueberry",
            "length_cm": 1.6,
            "description": "Tiny arms, legs, and facial features are taking shape.",
            "description_sw": "Mikono midogo, miguu, na sura za uso zinaanza kuunda.",
            "baby_facts": [
                "Heartbeat is usually present",
                "Fingers and toes are beginning",
            ],
            "baby_facts_sw": [
                "Mapigo ya moyo huwa yanasikika",
                "Vidole vya mikono na miguu vinaanza",
            ],
            "mother_feels": [
                "Nausea can be stronger",
                "Frequent urination",
                "Food smells may bother you",
            ],
            "mother_feels_sw": [
                "Kichefuchefu kinaweza kuwa kikali",
                "Kukojoa mara kwa mara",
                "Harufu ya chakula inaweza kusumbua",
            ],
        },
        {
            "week": 12, "emoji": "🍋",
            "title": "End of 1st Trimester", "title_sw": "Mwisho wa Muhula wa 1",
            "size_comparison": "lime", "size_comparison_sw": "limau",
            "length_cm": 5.4,
            "description": "Most major organs have formed and will keep maturing.",
            "description_sw": "Viungo vingi vikubwa vimeundwa na vitaendelea kukomaa.",
            "baby_facts": [
                "Baby can make small movements",
                "Reflexes are starting",
            ],
            "baby_facts_sw": [
                "Mtoto anaweza kufanya mwendo mdogo",
                "Mienendo ya akili inaanza",
            ],
            "mother_feels": [
                "Energy may slowly return",
                "Waistbands may feel tight",
                "Nausea may ease soon",
            ],
            "mother_feels_sw": [
                "Nguvu inaweza kurejea polepole",
                "Mikanda ya kiuno inaweza kubana",
                "Kichefuchefu kinaweza kupungua",
            ],
        },
        {
            "week": 17, "emoji": "🍌",
            "title": "Hearing the World", "title_sw": "Kusikia Dunia",
            "size_comparison": "banana", "size_comparison_sw": "ndizi",
            "length_cm": 16.4,
            "description": "Baby can hear sounds outside the womb.",
            "description_sw": "Mtoto anaweza kusikia sauti za nje ya tumbo.",
            "baby_facts": [
                "Hearing is developing",
                "Tiny fingerprints are forming",
                "Baby is practicing swallowing",
            ],
            "baby_facts_sw": [
                "Usikivu unakua",
                "Alama za vidole zinaundwa",
                "Mtoto anajifunza kumeza",
            ],
            "mother_feels": [
                "Kicks becoming more regular",
                "Back pain may start",
                "You may notice round ligament pain",
            ],
            "mother_feels_sw": [
                "Mapigo yanazidi kuwa ya kawaida",
                "Maumivu ya mgongo yanaweza kuanza",
                "Unaweza kuhisi maumivu ya mishipa",
            ],
        },
        {
            "week": 20, "emoji": "🥭",
            "title": "Halfway There", "title_sw": "Nusu ya Safari",
            "size_comparison": "mango", "size_comparison_sw": "embe",
            "length_cm": 25.6,
            "description": "Movements may become easier to recognize this week.",
            "description_sw": "Mwendo unaweza kuwa rahisi kutambua wiki hii.",
            "baby_facts": [
                "Sleep and wake cycles are developing",
                "Skin is protected by vernix",
            ],
            "baby_facts_sw": [
                "Mizunguko ya usingizi na uamsho inakua",
                "Ngozi inalindwa na vernix",
            ],
            "mother_feels": [
                "Stronger flutters or kicks",
                "Leg cramps may start",
                "Appetite may increase",
            ],
            "mother_feels_sw": [
                "Mapigo au mwendo wa nguvu zaidi",
                "Mikazo ya miguu inaweza kuanza",
                "Hamu ya kula inaweza kuongezeka",
            ],
        },
        {
            "week": 24, "emoji": "🌽",
            "title": "Building Lungs", "title_sw": "Mapafu Yanajengwa",
            "size_comparison": "ear of corn", "size_comparison_sw": "sikio la mahindi",
            "length_cm": 30.0,
            "description": "Lungs are developing important air sacs.",
            "description_sw": "Mapafu yanakua na mifuko muhimu ya hewa.",
            "baby_facts": [
                "Baby responds to sound",
                "Taste buds are active",
            ],
            "baby_facts_sw": [
                "Mtoto anaitikia sauti",
                "Vionjo vya ladha vinatumika",
            ],
            "mother_feels": [
                "Belly growth feels faster",
                "Mild swelling can happen",
                "Back strain may increase",
            ],
            "mother_feels_sw": [
                "Tumbo linaonekana kukua haraka",
                "Uvimbe mdogo unaweza kutokea",
                "Mkazo wa mgongo unaweza kuongezeka",
            ],
        },
        {
            "week": 28, "emoji": "🍆",
            "title": "Eyes Open", "title_sw": "Macho Yanafunguka",
            "size_comparison": "eggplant", "size_comparison_sw": "biringanya",
            "length_cm": 37.6,
            "description": "Baby can blink and is building more body fat.",
            "description_sw": "Mtoto anaweza kufumba macho na anajenga mafuta zaidi mwilini.",
            "baby_facts": [
                "Eyes open and close",
                "Brain growth is rapid",
            ],
            "baby_facts_sw": [
                "Macho yanafunguka na kufungwa",
                "Ukuaji wa ubongo ni wa haraka",
            ],
            "mother_feels": [
                "Shortness of breath may appear",
                "Sleep may be harder",
                "Braxton Hicks may start",
            ],
            "mother_feels_sw": [
                "Kuhema kunaweza kuonekana",
                "Kulala kunaweza kuwa kugumu",
                "Mikazo ya Braxton Hicks inaweza kuanza",
            ],
        },
        {
            "week": 32, "emoji": "🥥",
            "title": "Practicing Breathing", "title_sw": "Mazoezi ya Kupumua",
            "size_comparison": "coconut", "size_comparison_sw": "nazi",
            "length_cm": 42.4,
            "description": "Baby is gaining weight and practicing breathing movements.",
            "description_sw": "Mtoto anaongeza uzito na kujifunza mwendo wa kupumua.",
            "baby_facts": [
                "Bones are hardening",
                "Movements may feel stronger but less roomy",
            ],
            "baby_facts_sw": [
                "Mifupa inakuwa ngumu",
                "Mwendo unaweza kuhisi wa nguvu lakini nafasi ni ndogo",
            ],
            "mother_feels": [
                "Pelvic pressure",
                "Heartburn may increase",
                "More frequent urination",
            ],
            "mother_feels_sw": [
                "Shinikizo la nyonga",
                "Kiungulia kinaweza kuongezeka",
                "Kukojoa zaidi",
            ],
        },
        {
            "week": 36, "emoji": "🍈",
            "title": "Getting Ready", "title_sw": "Maandalizi",
            "size_comparison": "melon", "size_comparison_sw": "tikiti",
            "length_cm": 47.4,
            "description": "Baby is getting ready for birth.",
            "description_sw": "Mtoto anajiandaa kwa kuzaliwa.",
            "baby_facts": [
                "Baby may move head-down",
                "Lungs are nearly mature",
            ],
            "baby_facts_sw": [
                "Mtoto anaweza kugeuka kichwa chini",
                "Mapafu yanakaribia kukomaa",
            ],
            "mother_feels": [
                "Pressure lower in the belly",
                "Walking may feel slower",
                "Practice contractions",
            ],
            "mother_feels_sw": [
                "Shinikizo chini ya tumbo",
                "Kutembea kunaweza kuhisi polepole",
                "Mikazo ya mazoezi",
            ],
        },
        {
            "week": 40, "emoji": "🎉",
            "title": "Ready for the World", "title_sw": "Tayari kwa Dunia",
            "size_comparison": "small pumpkin", "size_comparison_sw": "malenge dogo",
            "length_cm": 51.2,
            "description": "Baby is full term and ready to meet you.",
            "description_sw": "Mtoto amekamilika na yuko tayari kukutana nawe.",
            "baby_facts": [
                "Organs are ready for life outside",
                "Baby continues gaining a little weight",
            ],
            "baby_facts_sw": [
                "Viungo viko tayari kwa maisha ya nje",
                "Mtoto anaendelea kuongeza uzito kidogo",
            ],
            "mother_feels": [
                "More pelvic pressure",
                "Stronger contractions may begin",
                "Call care when labor signs start",
            ],
            "mother_feels_sw": [
                "Shinikizo zaidi la nyonga",
                "Mikazo ya nguvu inaweza kuanza",
                "Pigia huduma ukianza kuona dalili za leba",
            ],
        },
    ]
    for g in growth_data:
        BabyGrowth.objects.update_or_create(week=g['week'], defaults=g)
    print("✅ Baby growth data seeded.")

    # 4. Seed Tip Categories and Tips
    #
    # The Learn page's category tabs (frontend/src/pages/Learn/LearnPage.tsx)
    # filter client-side by checking whether the tip's title/tip_type contains
    # the category's English phrase (e.g. "what to do", "hormonal changes") —
    # so every tip below deliberately includes that phrase in its title.
    cat_nutrition, _ = TipCategory.objects.get_or_create(name="Nutrition", defaults={"name_sw": "Lishe", "icon": "🥗", "color": "#dcfce7"})
    cat_warning, _ = TipCategory.objects.get_or_create(name="Warning Signs", defaults={"name_sw": "Dalili za Hatari", "icon": "⚠️", "color": "#fee2e2"})
    cat_what_to_do, _ = TipCategory.objects.get_or_create(name="What to Do", defaults={"name_sw": "Nini cha Kufanya", "icon": "🍎", "color": "#ffe4e6"})
    cat_what_to_avoid, _ = TipCategory.objects.get_or_create(name="What to Avoid", defaults={"name_sw": "Nini cha Kuepuka", "icon": "⚠️", "color": "#ffe4e6"})
    cat_body_changes, _ = TipCategory.objects.get_or_create(name="Body Changes", defaults={"name_sw": "Mabadiliko ya Mwili", "icon": "✨", "color": "#ede9fe"})
    cat_birth_prep, _ = TipCategory.objects.get_or_create(name="Birth Prep", defaults={"name_sw": "Maandalizi ya Kujifungua", "icon": "🐣", "color": "#fce7f3"})

    tips = [
        # ── Nutrition & Food ────────────────────────────────────────────
        {
            "category": cat_nutrition,
            "title": "Stay Hydrated",
            "title_sw": "Kunywa Maji ya Kutosha",
            "description": "Drink at least 8-10 glasses of water daily to maintain amniotic fluid levels.",
            "description_sw": "Kunywa angalau glasi 8-10 za maji kila siku ili kudumisha kiwango cha maji ya uchungu.",
            "tip_type": "nutrition",
            "trimester": "all",
            "is_daily": True,
        },
        {
            "category": cat_nutrition,
            "title": "Eat Iron-Rich Foods",
            "title_sw": "Kula Vyakula vyenye Chuma",
            "description": "Focus on spinach, liver, and beans to prevent anemia during your second trimester.",
            "description_sw": "Zingatia mchicha, maini, na maharage ili kuzuia upungufu wa damu wakati wa trimester ya pili.",
            "tip_type": "nutrition",
            "trimester": "2",
            "is_daily": True,
        },
        {
            "category": cat_nutrition,
            "title": "Nutrition & Food Tips for the First Trimester",
            "title_sw": "Ushauri wa Lishe kwa Trimester ya Kwanza",
            "description": "Eat small, frequent meals with folate-rich foods like beans and leafy greens to ease nausea and support early development.",
            "description_sw": "Kula milo midogo mara kwa mara yenye vyakula vyenye folate kama maharage na mboga za majani ili kupunguza kichefuchefu na kusaidia ukuaji wa awali.",
            "tip_type": "nutrition",
            "trimester": "1",
            "is_daily": True,
        },
        {
            "category": cat_nutrition,
            "title": "Nutrition & Food for the Third Trimester",
            "title_sw": "Lishe na Chakula kwa Trimester ya Tatu",
            "description": "Add more calcium and fiber-rich foods to support the baby's bones and ease constipation as your due date nears.",
            "description_sw": "Ongeza vyakula vyenye kalsiamu na nyuzinyuzi ili kusaidia mifupa ya mtoto na kupunguza kuvimbiwa unapokaribia tarehe ya kujifungua.",
            "tip_type": "nutrition",
            "trimester": "3",
            "is_daily": True,
        },
        # ── Warning Signs ───────────────────────────────────────────────
        {
            "category": cat_warning,
            "title": "Severe Headache",
            "title_sw": "Maumivu Makali ya Kichwa",
            "description": "If you have a headache that won't go away, contact your doctor as it could be a sign of high blood pressure.",
            "description_sw": "Ukiwa na maumivu ya kichwa yasiyoisha, wasiliana na daktari wako kwani yanaweza kuwa dalili ya shinikizo la juu la damu.",
            "tip_type": "warning",
            "trimester": "2",
            "is_daily": False,
        },
        {
            "category": cat_warning,
            "title": "Warning Signs You Should Never Ignore",
            "title_sw": "Dalili za Hatari Usizopaswa Kuzipuuza",
            "description": "Vaginal bleeding, severe abdominal pain, blurred vision, or reduced baby movement need immediate medical attention — don't wait it out.",
            "description_sw": "Kutokwa na damu ukeni, maumivu makali ya tumbo, kutoona vizuri, au kupungua kwa mwendo wa mtoto vinahitaji huduma ya haraka — usisubiri.",
            "tip_type": "warning",
            "trimester": "all",
            "is_daily": False,
        },
        {
            "category": cat_warning,
            "title": "Warning Signs in Early Pregnancy",
            "title_sw": "Dalili za Hatari Katika Ujauzito wa Mwanzo",
            "description": "Heavy bleeding or severe cramping in the first trimester can signal a miscarriage or ectopic pregnancy — see a provider right away.",
            "description_sw": "Kutokwa na damu nyingi au maumivu makali ya tumbo katika trimester ya kwanza yanaweza kuashiria mimba kuharibika au mimba nje ya mfuko wa uzazi — muone mtoa huduma mara moja.",
            "tip_type": "warning",
            "trimester": "1",
            "is_daily": False,
        },
        {
            "category": cat_warning,
            "title": "Warning Signs of Labour Complications",
            "title_sw": "Dalili za Hatari za Matatizo ya Uchungu",
            "description": "Fluid leaking before term, no fetal movement, or sudden swelling of the hands and face can signal a complication — contact your provider immediately.",
            "description_sw": "Kutoka kwa maji kabla ya muda, kukosekana kwa mwendo wa mtoto, au uvimbe wa ghafla wa mikono na uso vinaweza kuashiria tatizo — wasiliana na mtoa huduma mara moja.",
            "tip_type": "warning",
            "trimester": "3",
            "is_daily": False,
        },
        # ── What to Do ──────────────────────────────────────────────────
        {
            "category": cat_what_to_do,
            "title": "What to Do in Every Trimester: Take Your Prenatal Vitamins",
            "title_sw": "Nini cha Kufanya Kila Trimester: Tumia Vidonge vya Ujauzito",
            "description": "Take your folic acid and iron supplements daily as prescribed to support your baby's growth and your own health.",
            "description_sw": "Tumia vidonge vya folic acid na chuma kila siku kama ulivyoelekezwa ili kusaidia ukuaji wa mtoto na afya yako.",
            "tip_type": "tip",
            "trimester": "all",
            "is_daily": True,
        },
        {
            "category": cat_what_to_do,
            "title": "What to Do in Your First Trimester",
            "title_sw": "Nini cha Kufanya Katika Trimester ya Kwanza",
            "description": "Book your first antenatal visit as soon as you confirm your pregnancy, and get plenty of rest while your body adjusts.",
            "description_sw": "Panga kliniki yako ya kwanza ya ujauzito mara tu unapothibitisha ujauzito, na pumzika vya kutosha wakati mwili wako unazoea.",
            "tip_type": "tip",
            "trimester": "1",
            "is_daily": False,
        },
        {
            "category": cat_what_to_do,
            "title": "What to Do in Your Second Trimester",
            "title_sw": "Nini cha Kufanya Katika Trimester ya Pili",
            "description": "Start gentle exercise like walking, sleep on your side, and begin tracking your baby's daily movements.",
            "description_sw": "Anza mazoezi mepesi kama kutembea, lala ubavuni, na anza kufuatilia mwendo wa mtoto kila siku.",
            "tip_type": "tip",
            "trimester": "2",
            "is_daily": False,
        },
        {
            "category": cat_what_to_do,
            "title": "What to Do in Your Third Trimester",
            "title_sw": "Nini cha Kufanya Katika Trimester ya Tatu",
            "description": "Pack your hospital bag, count your baby's kicks daily, and make sure you know the signs of labour.",
            "description_sw": "Andaa mkoba wako wa hospitalini, hesabu mateke ya mtoto kila siku, na hakikisha unajua dalili za uchungu.",
            "tip_type": "tip",
            "trimester": "3",
            "is_daily": False,
        },
        # ── What to Avoid ───────────────────────────────────────────────
        {
            "category": cat_what_to_avoid,
            "title": "What to Avoid During Pregnancy: Alcohol and Smoking",
            "title_sw": "Nini cha Kuepuka Wakati wa Ujauzito: Pombe na Sigara",
            "description": "Avoid alcohol, smoking, and secondhand smoke throughout pregnancy — they raise the risk of birth defects and low birth weight.",
            "description_sw": "Epuka pombe, sigara, na moshi wa sigara wakati wote wa ujauzito — vinaongeza hatari ya kasoro za kuzaliwa na uzito mdogo wa mtoto.",
            "tip_type": "tip",
            "trimester": "all",
            "is_daily": False,
        },
        {
            "category": cat_what_to_avoid,
            "title": "What to Avoid in Your First Trimester",
            "title_sw": "Nini cha Kuepuka Katika Trimester ya Kwanza",
            "description": "Avoid raw or undercooked meat, unpasteurized dairy, and any medication your doctor hasn't approved.",
            "description_sw": "Epuka nyama mbichi au isiyoiva vizuri, maziwa yasiyochemshwa, na dawa yoyote ambayo daktari hajaidhinisha.",
            "tip_type": "tip",
            "trimester": "1",
            "is_daily": False,
        },
        {
            "category": cat_what_to_avoid,
            "title": "What to Avoid in Your Second Trimester",
            "title_sw": "Nini cha Kuepuka Katika Trimester ya Pili",
            "description": "Avoid lying flat on your back for long periods and cut back on caffeine to one cup a day or less.",
            "description_sw": "Epuka kulala chali kwa muda mrefu na punguza kafeini hadi kikombe kimoja au chini kwa siku.",
            "tip_type": "tip",
            "trimester": "2",
            "is_daily": False,
        },
        {
            "category": cat_what_to_avoid,
            "title": "What to Avoid in Your Third Trimester",
            "title_sw": "Nini cha Kuepuka Katika Trimester ya Tatu",
            "description": "Avoid long-distance travel without breaks and standing for long stretches, since both can strain your body as your due date nears.",
            "description_sw": "Epuka safari ndefu bila mapumziko na kusimama kwa muda mrefu, kwani vyote vinaweza kulemea mwili wako unapokaribia kujifungua.",
            "tip_type": "tip",
            "trimester": "3",
            "is_daily": False,
        },
        # ── Body Changes (hormonal) ─────────────────────────────────────
        {
            "category": cat_body_changes,
            "title": "Hormonal Changes in Pregnancy Explained",
            "title_sw": "Mabadiliko ya Homoni Wakati wa Ujauzito Yamefafanuliwa",
            "description": "Rising hCG, progesterone, and estrogen drive most pregnancy symptoms — knowing why can make them easier to manage.",
            "description_sw": "Kuongezeka kwa hCG, progesterone, na estrogen ndiko kunakosababisha dalili nyingi za ujauzito — kujua sababu kunaweza kurahisisha kuzimudu.",
            "tip_type": "info",
            "trimester": "all",
            "is_daily": False,
        },
        {
            "category": cat_body_changes,
            "title": "Hormonal Changes in Your First Trimester",
            "title_sw": "Mabadiliko ya Homoni Katika Trimester ya Kwanza",
            "description": "Nausea, breast tenderness, and fatigue in early pregnancy are driven by the sudden rise in pregnancy hormones — they usually ease by the second trimester.",
            "description_sw": "Kichefuchefu, maumivu ya matiti, na uchovu mwanzoni mwa ujauzito husababishwa na kuongezeka kwa homoni kwa ghafla — kwa kawaida hupungua kufikia trimester ya pili.",
            "tip_type": "info",
            "trimester": "1",
            "is_daily": False,
        },
        {
            "category": cat_body_changes,
            "title": "Hormonal Changes in Your Second Trimester",
            "title_sw": "Mabadiliko ya Homoni Katika Trimester ya Pili",
            "description": "You may notice skin darkening, a dark line down your belly, and more energy — all normal effects of pregnancy hormones.",
            "description_sw": "Unaweza kugundua weusi wa ngozi, mstari mweusi tumboni, na nguvu zaidi — yote ni madhara ya kawaida ya homoni za ujauzito.",
            "tip_type": "info",
            "trimester": "2",
            "is_daily": False,
        },
        {
            "category": cat_body_changes,
            "title": "Hormonal Changes in Your Third Trimester",
            "title_sw": "Mabadiliko ya Homoni Katika Trimester ya Tatu",
            "description": "The hormone relaxin loosens your joints and ligaments to prepare your body for birth, which is why you may feel less steady on your feet.",
            "description_sw": "Homoni ya relaxin hulegeza viungo na mishipa ili kuandaa mwili wako kwa kujifungua, ndiyo maana unaweza kujisikia huna usawa mzuri unapotembea.",
            "tip_type": "info",
            "trimester": "3",
            "is_daily": False,
        },
        # ── Birth Prep ──────────────────────────────────────────────────
        {
            "category": cat_birth_prep,
            "title": "Birth Prep Checklist for Every Mother",
            "title_sw": "Orodha ya Maandalizi ya Kujifungua kwa Kila Mama",
            "description": "Know your facility, your emergency contacts, and your transport plan well before your due date — good birth prep starts early.",
            "description_sw": "Jua kituo chako cha afya, mawasiliano ya dharura, na mpango wa usafiri mapema kabla ya tarehe yako ya kujifungua — maandalizi mazuri huanza mapema.",
            "tip_type": "tip",
            "trimester": "all",
            "is_daily": False,
        },
        {
            "category": cat_birth_prep,
            "title": "Birth Prep: Choosing Your Delivery Facility Early",
            "title_sw": "Maandalizi ya Kujifungua: Kuchagua Kituo Mapema",
            "description": "Pick and register at your preferred delivery facility early in pregnancy so there are no surprises when labour starts.",
            "description_sw": "Chagua na jiandikishe katika kituo unachopendelea cha kujifungulia mapema katika ujauzito ili kuepuka mshangao uchungu unapoanza.",
            "tip_type": "tip",
            "trimester": "1",
            "is_daily": False,
        },
        {
            "category": cat_birth_prep,
            "title": "Birth Prep: Antenatal Classes and Breathing Techniques",
            "title_sw": "Maandalizi ya Kujifungua: Madarasa na Mbinu za Kupumua",
            "description": "Join antenatal classes to learn breathing and relaxation techniques that make labour easier to cope with.",
            "description_sw": "Jiunge na madarasa ya ujauzito kujifunza mbinu za kupumua na kutuliza ambazo hurahisisha kukabiliana na uchungu wa kujifungua.",
            "tip_type": "tip",
            "trimester": "2",
            "is_daily": False,
        },
        {
            "category": cat_birth_prep,
            "title": "Birth Prep: Packing Your Hospital Bag and Birth Plan",
            "title_sw": "Maandalizi ya Kujifungua: Mkoba wa Hospitalini na Mpango wa Kujifungua",
            "description": "Pack your hospital bag and write down your birth plan by 36 weeks so you're ready whenever labour begins.",
            "description_sw": "Andaa mkoba wako wa hospitalini na andika mpango wako wa kujifungua kufikia wiki 36 ili uwe tayari wakati wowote uchungu utakapoanza.",
            "tip_type": "tip",
            "trimester": "3",
            "is_daily": False,
        },
    ]
    for t in tips:
        t.setdefault("is_approved", True)
        t.setdefault("is_reviewed", True)
        Tip.objects.update_or_create(title=t['title'], defaults=t)
    print("✅ Tip categories and tips seeded.")

    print("\n🚀 All done! Your Mimba Yangu app is now full of content.")

if __name__ == "__main__":
    seed()
