"""
DEPRECATED — keyword bot removed.

The Health Assistant now goes through Google Gemini in
``chatbot.ai_engine.process_message``. This module is kept only to make
accidental re-imports of the old keyword pipeline fail loudly.
"""


def process_message(*_args, **_kwargs):  # pragma: no cover
    raise RuntimeError(
        "chatbot.chatbot_engine has been removed. "
        "Use chatbot.ai_engine.process_message instead."
    )
