from django.apps import AppConfig


class TrackingConfig(AppConfig):
    name = 'tracking'

    def ready(self):
        # Import signal handlers so they get registered at startup.
        from . import signals  # noqa: F401
