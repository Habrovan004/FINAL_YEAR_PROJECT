from rest_framework.throttling import UserRateThrottle


class ChatMessageSendThrottle(UserRateThrottle):
    """Limits how fast one user can *send* direct-chat messages. Polling
    (GET) is never throttled by this — only POST counts against the limit,
    so 6-second-interval polling can't accidentally eat into a mother's or
    provider's send budget.
    """
    scope = 'chat_message_send'

    def allow_request(self, request, view):
        if request.method != 'POST':
            return True
        return super().allow_request(request, view)
