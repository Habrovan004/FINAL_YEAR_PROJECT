from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ChatSession, BotMessage
from .chatbot_engine import get_bot_response

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bot_chat(request):
    """
    Handle a user message and return the chatbot's rule-based response.
    """
    user_text = request.data.get('text', '')
    if not user_text:
        return Response({'error': 'No text provided'}, status=400)

    # 1. Get or create active session
    session, created = ChatSession.objects.get_or_create(
        patient=request.user,
        is_active=True
    )

    # 2. Save Patient Message
    BotMessage.objects.create(session=session, sender='patient', text=user_text)

    # 3. Process with AI Engine
    bot_text = get_bot_response(session, user_text)

    # 4. Save Bot Response
    BotMessage.objects.create(session=session, sender='bot', text=bot_text)

    # 5. Handle Escalation
    if session.current_state == 'escalated':
        # Logic to notify the assigned healthcare provider
        print(f"!!! ESCALATION !!! Alerting provider for patient {request.user.full_name}")
        # summary = f"Urgent: {request.user.full_name} reports danger signs."
        # send_sms(request.user.profile.assigned_provider.user.phone_number, summary)

    return Response({
        'bot_message': bot_text,
        'risk_level': session.risk_level,
        'state': session.current_state
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chat_history(request):
    """Retrieve history of the current bot session"""
    session = ChatSession.objects.filter(patient=request.user, is_active=True).first()
    if not session:
        return Response([])
    
    messages = session.messages.all().order_by('timestamp')
    return Response([{
        'sender': m.sender,
        'text': m.text,
        'time': m.timestamp
    } for m in messages])
