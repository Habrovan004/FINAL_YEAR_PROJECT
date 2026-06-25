"""
Module 5 — Chat endpoints

Workflow:
  1. Mother opens chat → GET /api/chatbot/conversation/  (creates one if none)
  2. Mother sends message → POST /api/chatbot/message/
     - Backend runs escalation detector first.
     - If escalation: type flips to 'provider', a notification fires, the
       provider sees the conversation in their queue.
     - Otherwise: Q&A engine answers as 'chatbot'.
  3. Provider views queue → GET /api/chatbot/provider/queue/
  4. Either party fetches history → GET /api/chatbot/conversation/<id>/messages/
"""
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from .models import Conversation, Message
from .chatbot_engine import process_message


def _serialize_message(m: Message) -> dict:
    sender_name = "Health Assistant"
    if m.sender_type == 'mother' and m.sender:
        sender_name = m.sender.full_name
    elif m.sender_type == 'provider' and m.sender:
        sender_name = m.sender.full_name
    return {
        'id': m.id,
        'sender_type': m.sender_type,
        'sender_name': sender_name,
        'content': m.content,
        'triggered_escalation': m.triggered_escalation,
        'created_at': m.created_at.isoformat(),
    }


def _serialize_conversation(c: Conversation, include_messages: bool = False) -> dict:
    data = {
        'id': c.id,
        'mother_id': c.mother_id,
        'mother_name': c.mother.full_name,
        'provider_id': c.provider_id,
        'provider_name': c.provider.full_name if c.provider else None,
        'type': c.type,
        'is_active': c.is_active,
        'escalated_at': c.escalated_at.isoformat() if c.escalated_at else None,
        'created_at': c.created_at.isoformat(),
        'updated_at': c.updated_at.isoformat(),
    }
    if include_messages:
        data['messages'] = [_serialize_message(m) for m in c.messages_v2.all()]
    return data


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def conversation_entry(request):
    """Mother's entry point: get-or-create the active conversation."""
    if request.user.user_type != 'patient':
        return Response({'error': 'Only mothers start conversations here.'}, status=403)

    convo = (
        Conversation.objects
        .filter(mother=request.user, is_active=True)
        .order_by('-updated_at')
        .first()
    )

    if not convo:
        provider = None
        profile = getattr(request.user, 'profile', None)
        if profile and profile.assigned_provider:
            provider = profile.assigned_provider.user
        convo = Conversation.objects.create(
            mother=request.user,
            provider=provider,
            type='chatbot',
        )
        # Greet the mother
        Message.objects.create(
            conversation=convo,
            sender=None,
            sender_type='chatbot',
            content=(
                "Hello! I'm your Mimba Yangu Health Assistant. "
                "Ask me anything about nutrition, danger signs, ANC visits or labour. "
                "If you need a real provider, just say 'I need a doctor'."
            ),
        )

    return Response(_serialize_conversation(convo, include_messages=True))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def post_message(request):
    """Mother posts a message. Engine decides chatbot reply vs. escalation."""
    convo_id = request.data.get('conversation_id')
    text = (request.data.get('content') or '').strip()
    language = request.data.get('language', 'en')

    if not text:
        return Response({'error': 'Message content is required.'}, status=400)
    if not convo_id:
        return Response({'error': 'conversation_id is required.'}, status=400)

    try:
        convo = Conversation.objects.get(pk=convo_id, mother=request.user, is_active=True)
    except Conversation.DoesNotExist:
        return Response({'error': 'Conversation not found.'}, status=404)

    # Save the mother's message
    mother_msg = Message.objects.create(
        conversation=convo,
        sender=request.user,
        sender_type='mother',
        content=text,
    )

    # If already escalated to provider, do NOT run the bot — just deliver.
    if convo.type == 'provider':
        return Response({
            'message': _serialize_message(mother_msg),
            'conversation_type': convo.type,
            'bot_reply': None,
        }, status=201)

    # Run the chatbot pipeline
    result = process_message(text, language=language)

    if result['escalate']:
        # Bot still posts the holding reply, then we flip the conversation.
        bot_reply = Message.objects.create(
            conversation=convo,
            sender=None,
            sender_type='chatbot',
            content=result['bot_reply'],
            triggered_escalation=True,
        )
        # Switch type and notify provider
        convo.type = 'provider'
        convo.escalated_at = timezone.now()
        # Make sure a provider is attached
        if not convo.provider:
            profile = getattr(request.user, 'profile', None)
            if profile and profile.assigned_provider:
                convo.provider = profile.assigned_provider.user
        convo.save(update_fields=['type', 'escalated_at', 'provider', 'updated_at'])

        return Response({
            'message': _serialize_message(mother_msg),
            'bot_reply': _serialize_message(bot_reply),
            'conversation_type': convo.type,
            'escalated': True,
            'escalation_reason': result['reason'],
        }, status=201)

    # Plain chatbot reply
    bot_reply = Message.objects.create(
        conversation=convo,
        sender=None,
        sender_type='chatbot',
        content=result['bot_reply'],
    )
    convo.save(update_fields=['updated_at'])

    return Response({
        'message': _serialize_message(mother_msg),
        'bot_reply': _serialize_message(bot_reply),
        'conversation_type': convo.type,
        'escalated': False,
    }, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conversation_messages(request, conversation_id):
    """Fetch all messages in a conversation. Access restricted to the mother or assigned provider."""
    try:
        convo = Conversation.objects.get(pk=conversation_id)
    except Conversation.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if request.user != convo.mother and request.user != convo.provider:
        return Response({'error': 'Forbidden.'}, status=403)

    return Response(_serialize_conversation(convo, include_messages=True))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def provider_queue(request):
    """List all conversations that have been escalated to the logged-in provider."""
    if request.user.user_type != 'provider':
        return Response({'error': 'Forbidden.'}, status=403)

    queryset = Conversation.objects.filter(
        provider=request.user,
        type='provider',
        is_active=True,
    ).order_by('-escalated_at')

    return Response([_serialize_conversation(c) for c in queryset])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def provider_reply(request):
    """Provider posts a reply in an escalated conversation."""
    if request.user.user_type != 'provider':
        return Response({'error': 'Only providers can reply here.'}, status=403)

    convo_id = request.data.get('conversation_id')
    text = (request.data.get('content') or '').strip()
    if not convo_id or not text:
        return Response({'error': 'conversation_id and content are required.'}, status=400)

    try:
        convo = Conversation.objects.get(pk=convo_id, provider=request.user, is_active=True)
    except Conversation.DoesNotExist:
        return Response({'error': 'Conversation not found.'}, status=404)

    if convo.type != 'provider':
        convo.type = 'provider'
        if not convo.escalated_at:
            convo.escalated_at = timezone.now()
        convo.save(update_fields=['type', 'escalated_at', 'updated_at'])

    msg = Message.objects.create(
        conversation=convo,
        sender=request.user,
        sender_type='provider',
        content=text,
    )
    convo.save(update_fields=['updated_at'])

    return Response({'message': _serialize_message(msg)}, status=201)


# ── Legacy endpoint kept so the old mother-facing chat UI does not 500 ──
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bot_chat(request):
    """Legacy proxy: forwards to the new conversation flow."""
    text = (request.data.get('text') or '').strip()
    if not text:
        return Response({'error': 'No text provided'}, status=400)

    convo = (
        Conversation.objects
        .filter(mother=request.user, is_active=True)
        .order_by('-updated_at')
        .first()
    )
    if not convo:
        provider = None
        profile = getattr(request.user, 'profile', None)
        if profile and profile.assigned_provider:
            provider = profile.assigned_provider.user
        convo = Conversation.objects.create(mother=request.user, provider=provider, type='chatbot')

    Message.objects.create(conversation=convo, sender=request.user, sender_type='mother', content=text)
    result = process_message(text)
    if result['escalate']:
        convo.type = 'provider'
        convo.escalated_at = timezone.now()
        convo.save(update_fields=['type', 'escalated_at'])
    Message.objects.create(
        conversation=convo, sender=None, sender_type='chatbot',
        content=result['bot_reply'], triggered_escalation=result['escalate'],
    )
    return Response({
        'bot_message': result['bot_reply'],
        'risk_level': 'high' if result['escalate'] else 'low',
        'state': 'escalated' if result['escalate'] else 'initial',
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chat_history(request):
    """Legacy: return the active conversation history flattened."""
    convo = (
        Conversation.objects
        .filter(mother=request.user, is_active=True)
        .order_by('-updated_at')
        .first()
    )
    if not convo:
        return Response([])
    return Response([{
        'sender': 'bot' if m.sender_type in ('chatbot',) else ('patient' if m.sender_type == 'mother' else 'provider'),
        'text': m.content,
        'time': m.created_at,
    } for m in convo.messages_v2.all()])
