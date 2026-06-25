"""
Module 5 — Chatbot Engine

Two-step pipeline matching the workflow document:

1. ``check_escalation(text)`` — detects distress / direct-help phrases that
   must immediately reach a human provider. Runs BEFORE the Q&A engine so
   no urgent message is ever answered by the bot.

2. ``answer_question(text)`` — keyword Q&A dictionary covering the seven
   maternal-health topics described in section 6.3 of the workflow:
   nutrition, danger signs, ANC visits, common discomforts, labour
   preparation, newborn care, and family planning.

The chatbot is rule-based and bilingual-aware (English + a handful of
Swahili keywords), suitable for low-resource settings.
"""
from __future__ import annotations

import re
from typing import Optional, Tuple


# ────────────────────────────────────────────────────────────────────────
# Escalation keywords — detected first
# ────────────────────────────────────────────────────────────────────────
ESCALATION_PATTERNS = [
    r"\bi need a doctor\b",
    r"\bspeak to (a )?(nurse|provider|doctor)\b",
    r"\bthis is urgent\b",
    r"\bi am in pain\b",
    r"\bi'?m in pain\b",
    r"\bi am bleeding\b",
    r"\bi'?m bleeding\b",
    r"\bi cannot breathe\b",
    r"\bi can'?t breathe\b",
    r"\bplease help( me)?\b",
    r"\bemergency\b",
    r"\bhelp me now\b",
    r"\bnataka daktari\b",        # SW: I want a doctor
    r"\bdharura\b",                # SW: emergency
    r"\bnatokwa damu\b",           # SW: I'm bleeding
]

ESCALATION_REGEX = re.compile("|".join(ESCALATION_PATTERNS), re.IGNORECASE)


def check_escalation(text: str) -> bool:
    """Return True if the message contains any escalation phrase."""
    if not text:
        return False
    return bool(ESCALATION_REGEX.search(text))


# ────────────────────────────────────────────────────────────────────────
# Q&A knowledge base — keyword → (English answer, Swahili answer)
# Each entry is a tuple of (trigger_keywords, english_answer, swahili_answer)
# ────────────────────────────────────────────────────────────────────────
KNOWLEDGE_BASE = [
    # ── Nutrition ──
    (
        ["eat", "food", "nutrition", "diet", "kula", "chakula"],
        "Eat a balanced diet with vegetables, fruits, beans, fish, eggs and whole grains. "
        "Iron-rich foods (dark leafy greens, liver, beans) help prevent anaemia. "
        "Drink at least 8 glasses of clean water daily.",
        "Kula chakula bora chenye mboga, matunda, maharage, samaki, mayai na nafaka. "
        "Vyakula vyenye madini ya chuma (mboga za majani, ini, maharage) huzuia upungufu wa damu. "
        "Kunywa angalau glasi 8 za maji safi kila siku.",
    ),
    (
        ["avoid", "not eat", "harmful", "danger food"],
        "Avoid raw or undercooked meat and eggs, unpasteurised milk, alcohol, "
        "smoking and too much caffeine. Limit very salty or sugary foods.",
        "Epuka nyama na mayai yasiyoiva vizuri, maziwa yasiyochemshwa, pombe, "
        "uvutaji wa sigara na kahawa nyingi. Punguza vyakula vyenye chumvi nyingi au sukari nyingi.",
    ),
    (
        ["iron", "anaemia", "anemia", "tired"],
        "Tiredness can be normal in pregnancy, but it can also signal anaemia. "
        "Eat iron-rich foods (beans, spinach, liver) and take your prescribed iron and folic-acid tablets daily.",
        "Kuchoka ni kawaida wakati wa ujauzito, lakini kunaweza pia kumaanisha upungufu wa damu. "
        "Kula vyakula vyenye madini ya chuma na kumeza dawa zako za chuma na folic acid kila siku.",
    ),

    # ── Danger signs ──
    (
        ["danger", "warning sign", "alama za hatari", "dalili za hatari"],
        "Go to the hospital IMMEDIATELY if you have: severe headache, blurred vision, "
        "heavy bleeding, severe abdominal pain, convulsions, fever, swollen face or hands, "
        "reduced baby movements, or difficulty breathing.",
        "Nenda hospitalini MARA MOJA ukipata: maumivu makali ya kichwa, kutoona vizuri, "
        "kutokwa damu nyingi, maumivu makali ya tumbo, degedege, homa, kuvimba uso au mikono, "
        "kupungua kwa mwendo wa mtoto, au shida ya kupumua.",
    ),
    (
        ["bleed", "bleeding", "damu"],
        "Any bleeding during pregnancy needs urgent attention. Go to your nearest health "
        "facility immediately. While travelling, lie on your left side and stay calm.",
        "Kutokwa damu yoyote wakati wa ujauzito kunahitaji huduma ya haraka. Nenda kituo cha afya "
        "kilicho karibu mara moja. Ukiwa njiani lala upande wa kushoto na kuwa mtulivu.",
    ),
    (
        ["headache", "kichwa kinauma", "maumivu ya kichwa"],
        "A mild headache can be normal. But a SEVERE headache, especially with blurred vision or "
        "swelling, may be a sign of pre-eclampsia and you should go to hospital straight away.",
        "Maumivu kidogo ya kichwa ni ya kawaida. Lakini maumivu MAKALI ya kichwa, hasa pamoja na "
        "kutoona vizuri au kuvimba, yanaweza kuwa dalili ya pre-eclampsia — nenda hospitalini haraka.",
    ),

    # ── ANC visits ──
    (
        ["anc", "antenatal", "check up", "clinic", "visit"],
        "The WHO and Tanzania Ministry of Health recommend at least 8 antenatal care (ANC) visits. "
        "At each visit your weight, blood pressure and baby's growth are checked, and problems "
        "are picked up early. Book through the Appointments page in this app.",
        "WHO na Wizara ya Afya ya Tanzania zinapendekeza angalau mahudhurio 8 ya kliniki ya ujauzito (ANC). "
        "Kila mahudhurio uzito wako, shinikizo la damu na ukuaji wa mtoto huangaliwa. "
        "Hifadhi tarehe yako kupitia ukurasa wa Miadi katika hii app.",
    ),
    (
        ["how many visits", "mahudhurio", "visits do"],
        "You should attend at least 8 ANC visits during your pregnancy: one in the first trimester, "
        "two in the second trimester, and five in the third trimester.",
        "Unapaswa kuhudhuria angalau mahudhurio 8 ya ANC: moja katika robo ya kwanza, "
        "mawili katika robo ya pili, na matano katika robo ya tatu ya ujauzito.",
    ),

    # ── Common discomforts ──
    (
        ["morning sickness", "nausea", "vomit", "kichefuchefu"],
        "Morning sickness usually eases after the first trimester. Eat small frequent meals, "
        "avoid strong smells, and try ginger tea. If you cannot keep any food or fluid down, "
        "contact your provider.",
        "Kichefuchefu kwa kawaida hupungua baada ya robo ya kwanza. Kula milo midogo mara kwa mara, "
        "epuka harufu kali, na jaribu chai ya tangawizi. Usipoweza kushikilia chakula au maji kabisa, "
        "wasiliana na mhudumu wako wa afya.",
    ),
    (
        ["back pain", "mgongo"],
        "Back pain is common. Maintain good posture, avoid heavy lifting, sleep on your side with "
        "a pillow between your knees, and do gentle stretching. Severe pain should be reported.",
        "Maumivu ya mgongo ni kawaida. Kaa wima, epuka kubeba vitu vizito, lala upande na mto kati ya "
        "magoti, na nyoosha mwili pole pole. Maumivu makali yawasilishe.",
    ),
    (
        ["swelling", "swollen", "kuvimba"],
        "Mild swelling of feet and ankles is normal late in pregnancy. But SUDDEN swelling of face "
        "or hands, especially with headache, is a danger sign — go to hospital.",
        "Kuvimba kidogo kwa miguu na vifundo ni kawaida mwishoni mwa ujauzito. Lakini kuvimba "
        "GHAFLA kwa uso au mikono, hasa pamoja na maumivu ya kichwa, ni dalili ya hatari — nenda hospitalini.",
    ),

    # ── Labour preparation ──
    (
        ["labour", "labor", "uchungu", "give birth", "delivery"],
        "Signs that labour is starting: regular contractions getting stronger, lower back pain, "
        "a 'show' of mucus or blood, or your waters breaking. Go to hospital when contractions "
        "are 5 minutes apart or your waters break.",
        "Dalili za uchungu kuanza: mikazo ya kawaida inayoongezeka, maumivu ya mgongo wa chini, "
        "kutoka kwa kamasi au damu kidogo, au maji kuvunjika. Nenda hospitalini mikazo ikiwa "
        "kila baada ya dakika 5 au maji yakivunjika.",
    ),
    (
        ["bag", "hospital bag", "what to bring"],
        "Pack a hospital bag from week 36: 2-3 kangas, baby clothes and nappies, sanitary pads, "
        "soap and toothbrush, your ANC card, ID, and money for transport.",
        "Andaa mfuko wa hospitali kuanzia wiki 36: kanga 2-3, nguo za mtoto na nepi, taulo za hedhi, "
        "sabuni na mswaki, kadi yako ya ANC, kitambulisho, na pesa za usafiri.",
    ),

    # ── Newborn care ──
    (
        ["breastfeed", "kunyonyesha", "milk"],
        "Breastfeed your baby exclusively for the first 6 months — no water, no other food. "
        "Feed on demand, day and night. Make sure the baby latches well to avoid sore nipples.",
        "Mnyonyeshe mtoto wako maziwa ya mama tu kwa miezi 6 ya kwanza — bila maji wala chakula kingine. "
        "Mnyonyeshe anapotaka, mchana na usiku. Hakikisha mtoto anashika titi vizuri ili kuepuka kidonda.",
    ),
    (
        ["newborn", "baby care", "mtoto mchanga"],
        "Keep the baby warm (skin-to-skin contact is best), breastfeed within the first hour, "
        "and take the baby for the first immunisations within 6 weeks of birth. Watch for "
        "fever, refusal to feed, or unusual sleepiness.",
        "Mweke mtoto joto (ngozi kwa ngozi ni bora), mnyonyeshe ndani ya saa moja baada ya kuzaliwa, "
        "na mpeleke chanjo za kwanza ndani ya wiki 6. Angalia homa, kukataa kunyonya, au kulala sana.",
    ),
    (
        ["vaccine", "vaccination", "immunisation", "chanjo"],
        "Bring the baby for the BCG and polio vaccine at birth, then follow the routine immunisation "
        "schedule at 6, 10 and 14 weeks. Vaccines are free at all public facilities.",
        "Mpeleke mtoto chanjo ya BCG na polio wakati wa kuzaliwa, kisha ufuate ratiba ya kawaida "
        "ya chanjo kwa wiki 6, 10 na 14. Chanjo ni bure katika vituo vyote vya umma.",
    ),

    # ── Family planning ──
    (
        ["family planning", "contracept", "uzazi wa mpango"],
        "After delivery you can talk to your provider about family planning. Options available at "
        "most facilities include pills, implants, injections, IUDs and condoms. Spacing births by "
        "at least 2 years protects your health and the baby's.",
        "Baada ya kujifungua unaweza kuzungumza na mhudumu kuhusu uzazi wa mpango. Njia zinazopatikana "
        "ni pamoja na vidonge, kipandikizi, sindano, IUD na kondomu. Kupisha mimba kwa miaka 2 "
        "kunalinda afya yako na ya mtoto.",
    ),

    # ── Greetings (always last so they don't override topic matches) ──
    (
        ["hello", "hi", "habari", "mambo", "salama"],
        "Hello! I'm your Mimba Yangu Health Assistant. You can ask me about nutrition, danger signs, "
        "ANC visits, common discomforts, labour preparation, newborn care or family planning. "
        "If you need to speak to a real provider, just say so.",
        "Habari! Mimi ni msaidizi wako wa afya wa Mimba Yangu. Unaweza kuniuliza kuhusu lishe, "
        "dalili za hatari, kliniki za ANC, matatizo madogo, maandalizi ya kujifungua, malezi ya "
        "mtoto mchanga au uzazi wa mpango. Ukitaka kuongea na mhudumu wa kweli, niambie tu.",
    ),
]


FALLBACK_EN = (
    "I'm sorry, I don't have an answer for that. Let me connect you to a real provider who can help."
)
FALLBACK_SW = (
    "Samahani, sina jibu la swali hilo. Nitakuunganisha na mhudumu wa afya atakayekusaidia."
)


def answer_question(text: str, language: str = "en") -> Tuple[Optional[str], bool]:
    """Find an answer in the knowledge base.

    Returns ``(answer, found)``. When no entry matches, returns the fallback
    text and ``found=False`` — the caller should then trigger escalation.
    """
    if not text:
        return None, False

    lowered = text.lower()
    for keywords, en, sw in KNOWLEDGE_BASE:
        if any(kw in lowered for kw in keywords):
            return (sw if language == "sw" else en), True

    return (FALLBACK_SW if language == "sw" else FALLBACK_EN), False


# ────────────────────────────────────────────────────────────────────────
# Public pipeline used by views
# ────────────────────────────────────────────────────────────────────────
def process_message(text: str, language: str = "en") -> dict:
    """End-to-end chatbot pipeline.

    Returns a dict with keys:
      - escalate: bool — caller should switch conversation to a provider
      - reason: 'distress' | 'no_answer' | None
      - bot_reply: str | None — message to show as the chatbot, when not escalating
    """
    if check_escalation(text):
        return {
            "escalate": True,
            "reason": "distress",
            "bot_reply": (
                "I'm flagging this as urgent and connecting you to a provider now. "
                "While you wait, stay calm and find a safe place to sit or lie down."
                if language != "sw" else
                "Ninaweka hii kama dharura na kukuunganisha na mhudumu sasa. "
                "Wakati unasubiri, tulia na utafute mahali salama pa kukaa au kulala."
            ),
        }

    answer, found = answer_question(text, language=language)
    if found:
        return {"escalate": False, "reason": None, "bot_reply": answer}

    # No match — escalate to provider with the fallback message
    return {"escalate": True, "reason": "no_answer", "bot_reply": answer}
