import africastalking
from decouple import config

africastalking.initialize(
    username=config('AT_USERNAME'),
    api_key=config('AT_API_KEY')
)
sms = africastalking.SMS

def send_sos_sms(provider_phone, patient_name, lat, lng):
    # Ensure phone number is in international format without leading zero
    # Africa's Talking expects numbers like +255712...
    formatted_phone = f"+255{provider_phone.lstrip('0')}"
    
    message = (
        f"URGENT SOS: {patient_name} needs help. "
        f"Location: https://maps.google.com/?q={lat},{lng}"
    )
    try:
        # The send method expects a list of recipients
        response = sms.send(message, [formatted_phone])
        print(f"SMS sent successfully: {response}")
    except Exception as e:
        print(f"SMS failed: {e}")
