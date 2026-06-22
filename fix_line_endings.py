import pathlib

files_to_fix = [
    'backend/chatbot/chatbot_engine.py',
    'backend/chatbot/views.py',
    'frontend/src/pages/Onboarding/OnboardingFlow.tsx',
    'frontend/src/pages/Onboarding/VerifyOTP.tsx',
    'frontend/src/pages/Track/TrackPage.tsx',
    'frontend/src/pages/Home/HomePage.tsx',
]

for f in files_to_fix:
    path = pathlib.Path(f)
    if path.exists():
        content = path.read_text(encoding='utf-8')
        path.write_text(content.replace('\r\n', '\n'), encoding='utf-8', newline='\n')
        print(f"Fixed line endings in: {f}")
    else:
        print(f"File not found: {f}")
