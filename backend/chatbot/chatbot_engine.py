def get_bot_response(session, user_text):
    """
    Module 5: Rule-Based AI Engine
    Evaluates responses against a condition-action rule set.
    """
    text = user_text.lower()
    state = session.current_state
    
    # 1. INITIAL SCREENING
    if state == 'initial':
        if any(word in text for word in ['headache', 'kichwa']):
            session.current_state = 'checking_headache'
            session.collected_symptoms.append('headache')
            session.save()
            return "I see you mentioned a headache. Is it very severe, and do you also have blurred vision or 'stars' in your eyes?"
        
        if any(word in text for word in ['movement', 'kick', 'cheza']):
            session.current_state = 'checking_fetal_movement'
            session.save()
            return "Have you noticed any reduction in your baby's movements or kicks today?"
            
        return "Hello! I'm your Mimba Yangu assistant. How are you feeling today? Are you experiencing any pain, swelling, or headaches?"

    # 2. CHECKING HEADACHE (Pre-eclampsia Rule)
    if state == 'checking_headache':
        if any(word in text for word in ['yes', 'ndio', 'severe', 'blurred', 'pata picha']):
            session.risk_level = 'high'
            session.current_state = 'escalated'
            session.save()
            # Trigger Escalation
            return "URGENT ALERT: These symptoms (severe headache + blurred vision) are danger signs. Please rest in a quiet room and contact your provider immediately. I have already alerted them for you."
        else:
            session.current_state = 'initial'
            session.save()
            return "Thank you. If the headache persists or you notice swelling, please let me know. Do you have any other concerns?"

    # 3. CHECKING FETAL MOVEMENT
    if state == 'checking_fetal_movement':
        if any(word in text for word in ['yes', 'ndio', 'less', 'stopped']):
            session.risk_level = 'high'
            session.current_state = 'escalated'
            session.save()
            return "URGENT ALERT: Reduced fetal movement is a critical sign. Please go to your nearest health facility immediately. Your provider has been notified."
        else:
            session.current_state = 'initial'
            session.save()
            return "That's good to hear. Keep tracking the kicks daily. Is there anything else?"

    return "I'm here to help. Please describe how you're feeling."
