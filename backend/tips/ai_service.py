import os
import json

# Handle optional openai import
try:
    import openai
except ImportError:
    openai = None

# Configure OpenAI API key from environment variables
if openai:
    openai.api_key = os.getenv("OPENAI_API_KEY")

def generate_maternal_tip(category_name: str, trimester: str) -> dict:
    """
    Generates a maternal health tip using AI, including English and Swahili versions.
    Returns a dictionary with 'title', 'description', 'title_sw', 'description_sw'.
    """
    if not openai or not openai.api_key:
        if not openai:
            print("Warning: 'openai' library not installed. Using mock AI response.")
        else:
            print("Warning: OPENAI_API_KEY not set. Using mock AI response.")
        return _mock_ai_response(category_name, trimester)

    prompt = f"""
    Generate a concise maternal health tip for a pregnant woman in her {trimester} trimester, focusing on the category "{category_name}".
    The tip should be:
    - Written in simple, easy-to-understand language.
    - Relevant to Tanzanian mothers, referencing locally available foods or common practices where applicable.
    - Aligned with general antenatal care guidelines.
    - Encouraging and supportive in tone.

    Provide a title and a description in English, and then translate both the title and description into Swahili.
    The output should be a JSON object with the following structure:
    {{
        "title": "English Title",
        "description": "English Description",
        "title_sw": "Swahili Title",
        "description_sw": "Swahili Description"
    }}
    """

    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant specialized in maternal health, providing culturally relevant advice for Tanzanian mothers."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,
            response_format={"type": "json_object"}
        )
        ai_output = response.choices[0].message.content
        return json.loads(ai_output)
    except Exception as e:
        print(f"Error calling AI service: {e}. Falling back to mock response.")
        return _mock_ai_response(category_name, trimester)

def _mock_ai_response(category_name: str, trimester: str) -> dict:
    """Provides a mock AI response for testing or when AI service is unavailable."""
    return {
        "title": f"Maternal Tip: {category_name} in {trimester} Trimester",
        "description": f"Focus on healthy living during your {trimester} trimester. Ensure you eat local nutritious foods and stay hydrated.",
        "title_sw": f"Kidokezo cha Uzazi: {category_name} katika Muhula wa {trimester}",
        "description_sw": f"Zingatia kuishi kwa afya katika muhula wako wa {trimester}. Hakikisha unakula vyakula vya asili vyenye virutubisho na kunywa maji ya kutosha."
    }
