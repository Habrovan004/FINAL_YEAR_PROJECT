import africastalking
from decouple import config

africastalking.initialize(
    username=config('AT_USERNAME'),
    api_key=config('AT_API_KEY')
)
sms = africastalking.SMS

def send_sos_sms(provider_phone, patient_name, lat, lng):
    """Send the SOS SMS and report whether Africa's Talking actually accepted it.

    Africa's Talking's `.send()` call is synchronous and returns a per-recipient
    status ('Success' means accepted for delivery, not confirmed-delivered-to-phone
    — that requires a delivery-report webhook we don't have configured). This is
    the best signal available without one, so callers should treat the return
    value as "submitted successfully", not "confirmed delivered".
    """
    # Africa's Talking expects +255712... — numbers are stored either in local
    # format (0712...) or already in international format (+255712...); only
    # the former needs the prefix substitution, or "+255" + "+255712..."
    # becomes an invalid double-prefixed number that AT rejects outright.
    provider_phone = provider_phone.strip()
    formatted_phone = provider_phone if provider_phone.startswith('+') else f"+255{provider_phone.lstrip('0')}"

    message = (
        f"URGENT SOS: {patient_name} needs help. "
        f"Location: https://maps.google.com/?q={lat},{lng}"
    )
    try:
        # The send method expects a list of recipients
        response = sms.send(message, [formatted_phone])
        print(f"SMS sent successfully: {response}")
        recipients = response.get('SMSMessageData', {}).get('Recipients', [])
        return bool(recipients) and recipients[0].get('status') == 'Success'
    except Exception as e:
        print(f"SMS failed: {e}")
        return False
