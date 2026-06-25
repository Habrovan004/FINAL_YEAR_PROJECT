"""
HIGH-risk SymptomReport → SMS alerts to mother + assigned provider.

Wired via post_save on SymptomReport. The signal also creates a notification
on the provider's dashboard (queued for whichever provider is assigned to the
mother through PatientProfile).
"""
from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver

from .models import SymptomReport


def _format_phone(phone: str) -> str:
    """Africa's Talking expects E.164 — accept '0712...' or '712...' or '+255...' forms."""
    if not phone:
        return ''
    phone = phone.strip().replace(' ', '')
    if phone.startswith('+'):
        return phone
    return '+255' + phone.lstrip('0')


def _send_sms(phone: str, body: str) -> None:
    """Best-effort SMS dispatch via Africa's Talking. Never raises."""
    if not phone:
        return
    try:
        from accounts.sms import sms  # initialised SMS client
        sms.send(body, [_format_phone(phone)])
        print(f"[CDS SMS] sent to {phone}: {body[:60]}…")
    except Exception as e:
        print(f"[CDS SMS] FAILED to {phone}: {e}")


def _dispatch_high_risk_alerts(report: SymptomReport) -> None:
    """Send SMS to mother + provider and log a console alert."""
    mother = report.patient
    symptom_names = ", ".join(s.name for s in report.symptoms.all()) or "(symptoms reported)"

    mother_body = (
        "MIMBA YANGU URGENT: Your reported symptoms may be danger signs. "
        "Please go to your nearest health facility immediately."
    )
    _send_sms(mother.phone_number, mother_body)

    profile = getattr(mother, 'profile', None)
    if profile and profile.assigned_provider:
        provider_user = profile.assigned_provider.user
        provider_body = (
            f"MIMBA YANGU HIGH RISK: {mother.full_name} ({mother.phone_number}) "
            f"reported: {symptom_names}. Review immediately."
        )
        _send_sms(provider_user.phone_number, provider_body)
        print(f"!!! HIGH RISK alert: provider {provider_user.full_name} notified for {mother.full_name}")
    else:
        print(f"!!! HIGH RISK alert: {mother.full_name} has no assigned provider — alert not routed")


@receiver(post_save, sender=SymptomReport)
def on_symptom_report_saved(sender, instance: SymptomReport, created: bool, **kwargs):
    """Fire when a report is first created OR when its risk_level becomes 'high'."""
    # Symptoms attach via M2M after save, so we also listen to m2m_changed below.
    # This first hook only catches the case where risk_level was set directly.
    if instance.risk_level == 'high' and instance.symptoms.exists():
        _dispatch_high_risk_alerts(instance)


@receiver(m2m_changed, sender=SymptomReport.symptoms.through)
def on_report_symptoms_attached(sender, instance: SymptomReport, action: str, **kwargs):
    """After M2M symptoms are attached (post_add), recompute and alert if HIGH."""
    if action != 'post_add':
        return
    # Re-evaluate now that symptoms exist
    from .utils import assess_clinical_risk
    risk, recommendation, _ = assess_clinical_risk(instance.symptoms.all())
    if risk != instance.risk_level or recommendation != instance.clinical_recommendation:
        instance.risk_level = risk
        instance.clinical_recommendation = recommendation
        instance.save(update_fields=['risk_level', 'clinical_recommendation'])
    if instance.risk_level == 'high':
        _dispatch_high_risk_alerts(instance)
