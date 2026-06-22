def assess_clinical_risk(symptoms_list):
    """
    Clinical Decision Support Engine (CDSE)
    Evaluates combinations of symptoms to determine clinical risk level.
    """
    # Define Danger Signs based on WHO/Maternal Care guidelines
    DANGER_SIGNS = [
        'Severe Headache', 'Blurred Vision', 'Reduced Fetal Movement', 
        'Vaginal Bleeding', 'Severe Belly Pain', 'Convulsions'
    ]
    
    # Define Medium Risk Signs
    MEDIUM_SIGNS = [
        'Swelling in feet', 'Severe Heartburn', 'High Fever', 'Continuous Nausea'
    ]
    
    selected_names = [s.name for s in symptoms_list]
    
    # Logic 1: High Risk (Any danger sign OR multiple medium signs)
    high_risk_count = sum(1 for s in selected_names if s in DANGER_SIGNS)
    medium_risk_count = sum(1 for s in selected_names if s in MEDIUM_SIGNS)
    
    if high_risk_count >= 1:
        return 'high', "URGENT: Danger signs detected. Please contact your assigned provider or go to the emergency room immediately."
    
    # Logic 2: Medium Risk (Multiple medium signs or specific combinations)
    if medium_risk_count >= 2:
        return 'medium', "Provider Notification: Multiple symptoms reported. Your provider has been notified for follow-up."
    
    if medium_risk_count == 1:
        return 'medium', "Follow-up Recommended: Please monitor your symptoms and contact your clinic if they persist."

    # Logic 3: Low Risk
    return 'low', "Recorded: Continue your self-care routine. Rest and stay hydrated."
