"""
Clinical Decision Support (CDS) Engine — Module 3 of the workflow.

Scoring per the workflow document:
    critical (WHO danger sign) = 3 points
    moderate                   = 1 point

    total 0          → LOW
    total 1 or 2     → MEDIUM
    total >= 3 OR any critical sign → HIGH
"""

# WHO danger signs — any single one of these triggers HIGH regardless of total.
CRITICAL_SIGNS = {
    'Severe Headache',
    'Blurred Vision',
    'Reduced Fetal Movement',
    'Vaginal Bleeding',
    'Heavy Bleeding',
    'Severe Belly Pain',
    'Severe Abdominal Pain',
    'Convulsions',
    'Difficulty Breathing',
    'High Fever',
}

MODERATE_SIGNS = {
    'Swelling in feet',
    'Swelling',
    'Severe Heartburn',
    'Continuous Nausea',
    'Dizziness',
    'Anxiety',
    'Headache',
    'Fatigue',
}


def assess_clinical_risk(symptoms_list):
    """Run the CDS scoring on a list of Symptom model instances.

    Returns ``(risk_level, recommendation, score)`` where ``risk_level`` is
    one of ``'low' | 'medium' | 'high'``.
    """
    names = [s.name for s in symptoms_list]

    critical_count = sum(1 for n in names if n in CRITICAL_SIGNS)
    moderate_count = sum(1 for n in names if n in MODERATE_SIGNS)
    score = critical_count * 3 + moderate_count * 1

    if critical_count >= 1 or score >= 3:
        return (
            'high',
            "URGENT: Danger signs detected. Go to your nearest health facility immediately. "
            "Your provider has been alerted.",
            score,
        )

    if 1 <= score <= 2:
        return (
            'medium',
            "Your symptoms need a follow-up. Your provider will contact you for a routine review.",
            score,
        )

    return (
        'low',
        "Your symptoms appear normal for your stage. Stay hydrated and rest. Report again if they worsen.",
        score,
    )
