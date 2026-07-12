---
name: verify
description: How to launch and drive Uzazi Safe Link (Django + React) for runtime verification
---

## Launch (see memory `run-project` for full detail)
1. `cd backend && python manage.py runserver` (background) → http://127.0.0.1:8000
2. `cd frontend && npm run dev` (background) → http://localhost:5173
3. Smoke: `curl http://127.0.0.1:8000/admin/` (302), `curl http://localhost:5173/` (200)

## Demo/test credentials
- Patient: phone `+255700000001`, password `Demo1234`
- Patient 2: phone `+255700000002`, password `Demo1234`
- Provider: phone `+255700111222`, password `Provider123!`

## API-level verification (curl)
No browser automation tool (Playwright/computer-use) is available in this
environment as of 2026-07 — GUI changes cannot be screenshotted or clicked
through directly. For API/data-layer changes, exercise the real endpoint:

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"phone_number": "+255700000001", "password": "Demo1234"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access'])")

curl -s http://127.0.0.1:8000/api/patients/profile/ -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH http://127.0.0.1:8000/api/patients/profile/ \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"language":"sw"}'
```

## GUI-level verification
Cannot be done from this tool set — no browser control available. For
frontend behavioral changes (e.g. i18n language switching, client-side
state), the best available evidence is: `npx tsc --noEmit -p frontend`
passing (type-correctness of the wiring) plus a manual walkthrough
description for the user to confirm visually in their own browser. Ask
the user for a follow-up screenshot rather than claiming a visual PASS
you didn't observe.
