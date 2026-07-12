from django.core.management.base import BaseCommand
from tips.models import Tip, TipCategory

# These six categories mirror the hardcoded category tabs on the patient-facing
# Learn page (frontend/src/pages/Learn/LearnPage.tsx CATEGORIES). That page
# filters tips client-side by checking whether a tip's `title` or `tip_type`
# contains the category's label with underscores turned into spaces (e.g.
# "warning_signs" -> "warning signs") — it does NOT filter by this TipCategory
# FK. So every tip's English title below deliberately leads with the matching
# phrase (e.g. "What to Do — ...") to make sure it surfaces under the right tab.
CATEGORIES = [
    {"key": "what_to_do", "name": "What to Do", "name_sw": "Cha Kufanya", "icon": "check-circle", "color": "#22C55E"},
    {"key": "what_to_avoid", "name": "What to Avoid", "name_sw": "Cha Kuepuka", "icon": "x-circle", "color": "#F97316"},
    {"key": "warning_signs", "name": "Warning Signs", "name_sw": "Dalili za Hatari", "icon": "alert-triangle", "color": "#EF4444"},
    {"key": "hormonal_changes", "name": "Hormonal Changes", "name_sw": "Mabadiliko ya Homoni", "icon": "sparkles", "color": "#A855F7"},
    {"key": "birth_prep", "name": "Birth Prep", "name_sw": "Maandalizi ya Kujifungua", "icon": "package", "color": "#3B82F6"},
    {"key": "nutrition", "name": "Nutrition & Food", "name_sw": "Lishe na Chakula", "icon": "utensils", "color": "#14B8A6"},
]

# (category_key, trimester, title, title_sw, description, description_sw, tip_type)
TIPS = [
    # ── What to Do ──────────────────────────────────────────────────────────
    ("what_to_do", "1", "What to Do: Start folic acid daily", "Cha Kufanya: Anza folic acid kila siku",
     "Take a folic acid supplement every day in your first trimester — it helps prevent neural tube "
     "defects in your baby's developing brain and spine.",
     "Tumia kidonge cha folic acid kila siku katika miezi mitatu ya kwanza — husaidia kuzuia kasoro za "
     "ubongo na uti wa mgongo wa mtoto anayekua.",
     "tip"),
    ("what_to_do", "2", "What to Do: Attend every ANC visit", "Cha Kufanya: Hudhuria kila miadi ya ANC",
     "Keep every antenatal care appointment, even if you feel well. Each visit lets your provider track "
     "your baby's growth and catch problems early.",
     "Hudhuria kila miadi ya kliniki ya ujauzito, hata kama unajisikia vizuri. Kila ziara humpa mhudumu "
     "wako nafasi ya kufuatilia ukuaji wa mtoto na kubaini matatizo mapema.",
     "tip"),
    ("what_to_do", "3", "What to Do: Pack your hospital bag", "Cha Kufanya: Andaa mfuko wa hospitalini",
     "By 36 weeks, pack a bag with your ANC card, ID, baby clothes, and toiletries so you're ready when "
     "labour starts.",
     "Kufikia wiki ya 36, andaa mfuko wenye kadi yako ya ANC, kitambulisho, nguo za mtoto, na vifaa vya "
     "usafi ili uwe tayari uchungu utakapoanza.",
     "tip"),
    ("what_to_do", "all", "What to Do: Drink enough water every day", "Cha Kufanya: Kunywa maji ya kutosha kila siku",
     "Drink at least 8 glasses of clean water a day. Good hydration helps prevent constipation, swelling, "
     "and urinary tract infections.",
     "Kunywa angalau glasi 8 za maji safi kila siku. Kunywa maji ya kutosha husaidia kuzuia choo kigumu, "
     "uvimbe, na maambukizi ya njia ya mkojo.",
     "tip"),

    # ── What to Avoid ───────────────────────────────────────────────────────
    ("what_to_avoid", "1", "What to Avoid: Alcohol and smoking", "Cha Kuepuka: Pombe na sigara",
     "Avoid alcohol, smoking, and unprescribed medication in your first trimester — this is when your "
     "baby's major organs are forming.",
     "Epuka pombe, sigara, na dawa zisizoagizwa na daktari katika miezi mitatu ya kwanza — huu ndio "
     "wakati viungo muhimu vya mtoto vinapoumbika.",
     "tip"),
    ("what_to_avoid", "2", "What to Avoid: Raw or undercooked food", "Cha Kuepuka: Chakula kibichi au kisichoiva vizuri",
     "Avoid raw or undercooked meat, fish, and eggs, and unpasteurised dairy — they raise your risk of "
     "food-borne infections that can harm your pregnancy.",
     "Epuka nyama, samaki, na mayai yasiyoiva vizuri, pamoja na maziwa yasiyochemshwa — huongeza hatari "
     "ya maambukizi ya vyakula ambayo yanaweza kudhuru ujauzito wako.",
     "tip"),
    ("what_to_avoid", "3", "What to Avoid: Lying flat on your back", "Cha Kuepuka: Kulala chali moja kwa moja",
     "In your third trimester, avoid lying flat on your back for long periods — it can press on a major "
     "vein and reduce blood flow to your baby. Sleep on your side instead.",
     "Katika miezi mitatu ya mwisho, epuka kulala chali kwa muda mrefu — kunaweza kubana mshipa mkubwa "
     "na kupunguza mzunguko wa damu kwenda kwa mtoto. Badala yake, lala ukiegemea ubavu.",
     "tip"),
    ("what_to_avoid", "all", "What to Avoid: Self-medicating without advice", "Cha Kuepuka: Kujitibu bila ushauri wa daktari",
     "Avoid taking any medication, herbal remedy, or supplement without checking with your provider first "
     "— some are not safe during pregnancy.",
     "Epuka kutumia dawa yoyote, tiba za asili, au virutubisho bila kuuliza mhudumu wako kwanza — "
     "baadhi si salama wakati wa ujauzito.",
     "tip"),

    # ── Warning Signs ───────────────────────────────────────────────────────
    ("warning_signs", "1", "Warning Signs: Severe abdominal pain or bleeding", "Dalili za Hatari: Maumivu makali ya tumbo au kutokwa damu",
     "Go to the hospital immediately if you have severe abdominal pain or vaginal bleeding in early "
     "pregnancy — these can signal a serious complication.",
     "Nenda hospitalini mara moja ukipata maumivu makali ya tumbo au kutokwa na damu ukeni mapema kwenye "
     "ujauzito — hizi zinaweza kuashiria tatizo kubwa.",
     "warning"),
    ("warning_signs", "2", "Warning Signs: Severe headache or blurred vision", "Dalili za Hatari: Maumivu makali ya kichwa au kuona ukungu",
     "A severe headache, blurred vision, or sudden swelling of your face and hands can be signs of "
     "preeclampsia — seek care the same day.",
     "Maumivu makali ya kichwa, kuona ukungu, au uvimbe wa ghafla wa uso na mikono vinaweza kuwa dalili "
     "za preeclampsia — tafuta huduma siku hiyo hiyo.",
     "warning"),
    ("warning_signs", "3", "Warning Signs: Reduced fetal movement", "Dalili za Hatari: Mtoto kupunguza kutamba",
     "If your baby is moving much less than usual, or not at all, go to the hospital right away for a "
     "check-up.",
     "Kama mtoto anatamba kidogo sana kuliko kawaida, au hatembei kabisa, nenda hospitalini mara moja "
     "kwa uchunguzi.",
     "warning"),
    ("warning_signs", "all", "Warning Signs: Know when to seek help immediately", "Dalili za Hatari: Fahamu wakati wa kutafuta msaada haraka",
     "Convulsions, high fever, difficulty breathing, chest pain, or fainting are danger signs at any "
     "stage of pregnancy — get emergency care right away.",
     "Kutetemeka (degedege), homa kali, kushindwa kupumua, maumivu ya kifua, au kuzimia ni dalili za "
     "hatari katika hatua yoyote ya ujauzito — tafuta huduma ya dharura mara moja.",
     "warning"),

    # ── Hormonal Changes ────────────────────────────────────────────────────
    ("hormonal_changes", "1", "Hormonal Changes: Morning sickness and fatigue", "Mabadiliko ya Homoni: Kichefuchefu na uchovu",
     "Rising hormone levels can cause nausea and tiredness in the first trimester. Small, frequent meals "
     "and rest can help — this usually eases by week 12–14.",
     "Kuongezeka kwa homoni kunaweza kusababisha kichefuchefu na uchovu katika miezi mitatu ya kwanza. "
     "Kula milo midogo mara kwa mara na kupumzika kunasaidia — kwa kawaida hupungua kufikia wiki ya 12–14.",
     "info"),
    ("hormonal_changes", "2", "Hormonal Changes: Skin and hair changes", "Mabadiliko ya Homoni: Mabadiliko ya ngozi na nywele",
     "Pregnancy hormones can darken your skin in patches or make your hair feel thicker. These changes "
     "are normal and usually fade after birth.",
     "Homoni za ujauzito zinaweza kusababisha weusi wa ngozi katika baadhi ya sehemu au nywele kuhisi "
     "nzito zaidi. Mabadiliko haya ni ya kawaida na kwa kawaida hupotea baada ya kujifungua.",
     "info"),
    ("hormonal_changes", "3", "Hormonal Changes: Braxton Hicks contractions", "Mabadiliko ya Homoni: Mikazo ya Braxton Hicks",
     "You may feel irregular, mild tightening in your belly — these are practice contractions. They "
     "differ from real labour, which comes in a regular, strengthening pattern.",
     "Unaweza kuhisi mikazo midogo isiyo ya kawaida tumboni — hii ni mazoezi ya mwili kabla ya uchungu "
     "halisi. Hutofautiana na uchungu wa kweli, ambao huja kwa mpangilio wa kawaida na kuongezeka nguvu.",
     "info"),
    ("hormonal_changes", "all", "Hormonal Changes: Mood swings are normal", "Mabadiliko ya Homoni: Mabadiliko ya hisia ni ya kawaida",
     "Shifting hormones can bring sudden mood changes throughout pregnancy. This is common — talk to "
     "your provider if low moods persist or feel overwhelming.",
     "Mabadiliko ya homoni yanaweza kuleta mabadiliko ya ghafla ya hisia katika kipindi chote cha "
     "ujauzito. Hii ni ya kawaida — zungumza na mhudumu wako kama hisia za huzuni zinaendelea au ni nzito.",
     "info"),

    # ── Birth Prep ──────────────────────────────────────────────────────────
    ("birth_prep", "1", "Birth Prep: Choose your care facility early", "Maandalizi ya Kujifungua: Chagua kituo chako mapema",
     "It's never too early to think about where you'll deliver. Choosing your facility early lets you "
     "plan transport and understand what services are available.",
     "Si mapema sana kufikiria utakapojifungua. Kuchagua kituo chako mapema kunakusaidia kupanga "
     "usafiri na kuelewa huduma zinazopatikana.",
     "tip"),
    ("birth_prep", "2", "Birth Prep: Start thinking about a birth plan", "Maandalizi ya Kujifungua: Anza kufikiria mpango wa kujifungua",
     "Discuss your preferences for labour and delivery with your provider, and identify a birth partner "
     "who can support you on the day.",
     "Zungumza na mhudumu wako kuhusu matakwa yako ya uchungu na kujifungua, na mtambue mtu wa kukusaidia "
     "siku hiyo.",
     "tip"),
    ("birth_prep", "3", "Birth Prep: Know the signs that labour has started", "Maandalizi ya Kujifungua: Fahamu dalili za uchungu kuanza",
     "Regular, strengthening contractions, water breaking, or a bloody show mean labour may be starting "
     "— head to your chosen facility rather than waiting at home if you're unsure.",
     "Mikazo ya mara kwa mara inayozidi kuwa na nguvu, maji kukatika, au kuona ute wenye damu vinaweza "
     "kuashiria uchungu unaanza — nenda kituo ulichochagua badala ya kusubiri nyumbani kama huna uhakika.",
     "warning"),
    ("birth_prep", "all", "Birth Prep: Pack your bag and plan transport", "Maandalizi ya Kujifungua: Andaa mfuko na panga usafiri",
     "From your third trimester, keep your hospital bag ready and know how you'll get to your facility "
     "at any hour, day or night.",
     "Kuanzia miezi mitatu ya mwisho, weka mfuko wako wa hospitalini tayari na fahamu jinsi utakavyofika "
     "kituoni saa yoyote, mchana au usiku.",
     "tip"),

    # ── Nutrition & Food ────────────────────────────────────────────────────
    ("nutrition", "1", "Nutrition: Eat iron-rich foods", "Lishe: Kula vyakula vyenye madini ya chuma",
     "Your body needs more iron during pregnancy to prevent anemia. Eat beans, dark leafy greens, and "
     "red meat, paired with fruit to help absorption.",
     "Mwili wako unahitaji madini ya chuma zaidi wakati wa ujauzito ili kuzuia upungufu wa damu. Kula "
     "maharage, mboga za majani ya kijani, na nyama nyekundu, ukichanganya na matunda ili kusaidia "
     "unyonyaji.",
     "nutrition"),
    ("nutrition", "2", "Nutrition: Build strong bones with calcium", "Lishe: Jenga mifupa imara kwa kalisi",
     "Your baby's bones are developing fast in the second trimester. Drink milk and eat yogurt, small "
     "fish with bones, and green vegetables for enough calcium.",
     "Mifupa ya mtoto inakua kwa kasi katika miezi mitatu ya pili. Kunywa maziwa na kula mtindi, samaki "
     "wadogo wenye mifupa, na mboga za kijani ili kupata kalisi ya kutosha.",
     "nutrition"),
    ("nutrition", "3", "Nutrition: Eat smaller, frequent meals", "Lishe: Kula milo midogo mara kwa mara",
     "Your baby needs steady energy as they grow bigger. If you feel full quickly, eat smaller meals "
     "more often, and keep prioritising protein, iron, and calcium.",
     "Mtoto anahitaji nishati ya kutosha anapozidi kukua. Kama unashiba haraka, kula milo midogo mara "
     "kwa mara, na endelea kuweka kipaumbele kwenye protini, chuma, na kalisi.",
     "nutrition"),
    ("nutrition", "all", "Nutrition: Balance your plate every day", "Lishe: Sawazisha sahani yako kila siku",
     "Aim for a mix of grains, protein, vegetables, and fruit at every meal, and limit sugary or "
     "highly processed foods.",
     "Lenga kuwa na mchanganyiko wa nafaka, protini, mboga, na matunda kwenye kila mlo, na punguza "
     "vyakula vyenye sukari nyingi au vilivyosindikwa kupita kiasi.",
     "nutrition"),
]


class Command(BaseCommand):
    help = (
        'Seeds the six Learn-page tip categories (What to Do, What to Avoid, Warning Signs, '
        'Hormonal Changes, Birth Prep, Nutrition & Food) with four approved, bilingual tips each '
        '(1st/2nd/3rd trimester + general), replacing any previously seeded tips/categories.'
    )

    def handle(self, *args, **options):
        # Replace rather than merge — earlier seed data used different category
        # names/titles that don't match the Learn page's category-tab filters.
        Tip.objects.all().delete()
        TipCategory.objects.all().delete()

        cat_map = {}
        for c in CATEGORIES:
            cat = TipCategory.objects.create(
                name=c['name'], name_sw=c['name_sw'], icon=c['icon'], color=c['color'],
            )
            cat_map[c['key']] = cat

        for order, (cat_key, trimester, title, title_sw, desc, desc_sw, tip_type) in enumerate(TIPS):
            Tip.objects.create(
                category=cat_map[cat_key],
                title=title,
                title_sw=title_sw,
                description=desc,
                description_sw=desc_sw,
                tip_type=tip_type,
                trimester=trimester,
                is_daily=False,
                order=order,
                is_ai_generated=False,
                is_reviewed=True,
                is_approved=True,
            )

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(cat_map)} tip categories and {len(TIPS)} tips (4 per category)."
        ))
