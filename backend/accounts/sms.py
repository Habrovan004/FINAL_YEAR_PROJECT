import africastalking
from decouple import config

# Initialize Africa's Talking
africastalking.initialize(
    username=config('AT_USERNAME'),
    api_key=config('AT_API_KEY')
)
sms = africastalking.SMS
