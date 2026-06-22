import africastalking
from decouple import config

# Initialize Africa's Talking
africastalking.initialize(
    username=config('AT_USERNAME'),
    api_key=config('AT_API_KEY')
)
sms = africastalking.SMS

def send_otp_sms(phone_number, otp_code):
    # Ensure phone number is in international format without leading zero
    # Africa's Talking expects numbers like +255712...
    formatted_phone = f"+255{phone_number.lstrip('0')}"
    
    message = f"Your Mimba Yangu verification code is: {otp_code}"
    
    try:
        response = sms.send(message, [formatted_phone])
        print(f"OTP SMS sent successfully to {formatted_phone}: {response}")
    except Exception as e:
        print(f"OTP SMS failed to {formatted_phone}: {e}")
