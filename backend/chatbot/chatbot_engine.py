"""
DEPRECATED — keyword bot removed.

The Health Assistant now goes through Anthropic Claude in
``chatbot.ai_engine.process_message``. This module is kept only to make
accidental re-imports of the old keyword pipeline fail loudly.
"""


def process_message(*_args, **_kwargs):  # pragma: no cover
    raise RuntimeError(
        "chatbot.chatbot_engine has been removed. "
        "Use chatbot.ai_engine.process_message instead."
    )


def check_escalation(*_args, **_kwargs):  # pragma: no cover
    raise RuntimeError(
        "chatbot.chatbot_engine has been removed. "
        "Escalation is decided by the AI inside chatbot.ai_engine."
    )


def answer_question(*_args, **_kwargs):  # pragma: no cover
    raise RuntimeError(
        "chatbot.chatbot_engine has been removed. "
        "Use chatbot.ai_engine.process_message instead."
    )
