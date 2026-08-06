from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone

from chatbot.escalation import notify_provider_of_escalation
from chatbot.models import Conversation, Message


class Command(BaseCommand):
    help = 'Seed a test escalated chatbot conversation for provider-dashboard verification.'

    def add_arguments(self, parser):
        parser.add_argument('--mother-id', type=int, help='Patient user ID to use')
        parser.add_argument('--mother-phone', type=str, help='Patient phone number to use')
        parser.add_argument('--provider-id', type=int, help='Provider user ID to use')
        parser.add_argument('--provider-phone', type=str, help='Provider phone number to use')
        parser.add_argument(
            '--message',
            type=str,
            default='I have severe headache, blurred vision, and swelling of my hands.',
            help='Mother message to store in the escalated conversation.',
        )

    def handle(self, *args, **options):
        User = get_user_model()

        mother = self._resolve_user(
            User,
            user_type='patient',
            user_id=options.get('mother_id'),
            phone=options.get('mother_phone'),
        )
        if mother is None:
            mother = User.objects.filter(user_type='patient', profile__assigned_provider__isnull=False).first()
        if mother is None:
            raise CommandError('No patient with an assigned provider was found.')

        provider = self._resolve_user(
            User,
            user_type='provider',
            user_id=options.get('provider_id'),
            phone=options.get('provider_phone'),
        )
        if provider is None:
            assigned = getattr(getattr(mother, 'profile', None), 'assigned_provider', None)
            provider = assigned.user if assigned else None
        if provider is None:
            raise CommandError('No provider could be resolved for the selected mother.')

        convo = Conversation.objects.create(
            mother=mother,
            provider=provider,
            type='provider',
            escalated_at=timezone.now(),
        )

        Message.objects.create(
            conversation=convo,
            sender=mother,
            sender_type='mother',
            content=options['message'],
        )

        Message.objects.create(
            conversation=convo,
            sender=None,
            sender_type='chatbot',
            content=(
                'Please go to the nearest facility now. A nurse has been notified and '
                'the SOS button is available in the app.'
            ),
            triggered_escalation=True,
        )

        notify_provider_of_escalation(convo, mother)

        self.stdout.write(self.style.SUCCESS(
            f'Seeded escalated conversation #{convo.id} for mother={mother.full_name} provider={provider.full_name}'
        ))

    def _resolve_user(self, User, *, user_type: str, user_id: int | None, phone: str | None):
        qs = User.objects.filter(user_type=user_type)
        if user_id is not None:
            return qs.filter(pk=user_id).first()
        if phone:
            return qs.filter(phone_number=phone).first()
        return None