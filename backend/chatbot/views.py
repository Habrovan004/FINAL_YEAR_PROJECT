"""
Health Assistant chat endpoints.

Workflow:
  1. Mother opens chat → GET /api/chatbot/conversation/
  2. Mother sends message → POST /api/chatbot/message/
     - AI engine generates a reply with full conversation context.
     - If the AI flags a real medical emergency (escalate=true), the
       conversation flips to `provider` and the assigned provider sees it
       in their queue.
  3. Provider views queue → GET /api/chatbot/provider/queue/
  4. Either party fetches history → GET /api/chatbot/conversation/<id>/messages/

There are NO keyword-based or canned responses in the production path. When
the AI service is unavailable, the engine returns a clearly-marked
"service unavailable" message instead of fake answers.
"""
import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Conversation, Message
from .ai_engine import process_message

logger = logging.getLogger(__name__)


def _serialize_message(m: Message) -> dict:
    sender_name = "Health Assistant"
    if m.sender_type in ('mother', 'provider') and m.sender:
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
    # The message that triggered escalation (if any) — preferred for the queue preview;
    # falls back to the latest mother message so the provider always has context.
    preview_msg = (
        c.messages_v2.filter(triggered_escalation=True).order_by('-created_at').first()
        or c.messages_v2.filter(sender_type='mother').order_by('-created_at').first()
        or c.messages_v2.order_by('-created_at').first()
    )

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
        'last_message': preview_msg.content if preview_msg else '',
        'last_message_sender': preview_msg.sender_type if preview_msg else None,
    }
    if include_messages:
        data['messages'] = [_serialize_message(m) for m in c.messages_v2.all()]
    return data


def _greeting(language: str) -> str:
    if (language or '').lower().startswith('sw'):
        return (
            "Habari! Mimi ni Msaidizi wa Afya wa Mimba Yangu. "
            "Niambie unavyojisikia au uniulize chochote kuhusu lishe, "
            "ujauzito, kujifungua, au malezi ya mtoto mchanga. "
            "Naelewa Kiswahili na Kiingereza."
        )
    return (
        "Hi! I'm your Mimba Yangu Health Assistant. "
        "Tell me how you're feeling, or ask me anything about nutrition, "
        "pregnancy, labour, or newborn care. "
        "I understand both English and Swahili — just write in whichever you prefer."
    )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def conversation_entry(request):
    """Mother's entry point: get-or-create the active conversation."""
    if request.user.user_type != 'patient':
        return Response({'error': 'Only mothers start conversations here.'}, status=403)

    language = (
        request.query_params.get('language')
        or request.data.get('language')
        or getattr(getattr(request.user, 'profile', None), 'language', 'en')
        or 'en'
    )

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
        Message.objects.create(
            conversation=convo,
            sender=None,
            sender_type='chatbot',
            content=_greeting(language),
        )

    return Response(_serialize_conversation(convo, include_messages=True))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def post_message(request):
    """Mother posts a message. AI generates the reply; high-risk cases escalate."""
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

    logger.debug(
        "Mother message | user=%s convo=%s lang_hint=%s text=%r",
        request.user.id, convo.id, language, text[:160],
    )

    # Snapshot history BEFORE we add the new message so the AI sees only what
    # came before.
    history_qs = list(convo.messages_v2.all())

    # Save the mother's message
    mother_msg = Message.objects.create(
        conversation=convo,
        sender=request.user,
        sender_type='mother',
        content=text,
    )

    # If already escalated to provider, do NOT run the bot — just deliver.
    if convo.type == 'provider':
        convo.save(update_fields=['updated_at'])
        return Response({
            'message': _serialize_message(mother_msg),
            'conversation_type': convo.type,
            'bot_reply': None,
        }, status=201)

    # Run the AI engine with full context
    result = process_message(text, history=history_qs, language_hint=language)
    ai_available = result.get('ai_available', True)

    if result['escalate']:
        bot_reply = Message.objects.create(
            conversation=convo,
            sender=None,
            sender_type='chatbot',
            content=result['bot_reply'],
            triggered_escalation=True,
        )
        convo.type = 'provider'
        convo.escalated_at = timezone.now()
        if not convo.provider:
            profile = getattr(request.user, 'profile', None)
            if profile and profile.assigned_provider:
                convo.provider = profile.assigned_provider.user
        convo.save(update_fields=['type', 'escalated_at', 'provider', 'updated_at'])

        logger.info(
            "Escalation | convo=%s mother=%s reason=%s",
            convo.id, request.user.id, result.get('reason'),
        )

        return Response({
            'message': _serialize_message(mother_msg),
            'bot_reply': _serialize_message(bot_reply),
            'conversation_type': convo.type,
            'escalated': True,
            'escalation_reason': result['reason'],
            'ai_available': ai_available,
        }, status=201)

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
        'ai_available': ai_available,
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
    """Legacy proxy that now goes through the AI engine."""
    text = (request.data.get('text') or '').strip()
    language = request.data.get('language', 'en')
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

    history_qs = list(convo.messages_v2.all())
    Message.objects.create(conversation=convo, sender=request.user, sender_type='mother', content=text)
    result = process_message(text, history=history_qs, language_hint=language)
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
        'sender': 'bot' if m.sender_type == 'chatbot' else ('patient' if m.sender_type == 'mother' else 'provider'),
        'text': m.content,
        'time': m.created_at,
    } for m in convo.messages_v2.all()])
