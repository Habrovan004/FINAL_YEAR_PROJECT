# Uzazi Safe Link (Mimba Yangu) — Project Summary

*Final Year Dissertation Project — Ardhi University*
*A Web-Based Telemedicine System for Maternal Health and Pre-Natal Care*

> **This file is the living, accurate description of what the app actually does right now.**
> It is rewritten from the real codebase (not carried over from old notes), and it will be
> updated every time a feature changes. Use it to check your proposal against reality —
> anywhere the proposal says something different, that's either a proposal update needed
> or a feature still to build.
>
> Last verified against the code: **2026-07-11**, branch `feature/chat-and-appointments`.

---

## 1. What the app is, in plain language

Uzazi Safe Link ("Mimba Yangu" — Swahili for "My Pregnancy") is a website (not a native
mobile app, though it's designed mobile-first) that helps a pregnant woman in Tanzania
track her pregnancy and stay in touch with a healthcare provider between clinic visits.
A provider (doctor/midwife/nurse) uses the same system to monitor the mothers assigned
to them, record clinical visits, and respond to concerns.

There are only **two kinds of user accounts**: **Mother** (called `patient` in the code)
and **Provider**. There is no separate "Partner" account and no "Hospital Manager"
account — those existed earlier in development but were deliberately removed on
2026-07-04 to simplify the system (see §9). If your proposal describes a partner role or
a hospital-manager dashboard, that no longer matches the running app.

---

## 2. A mother's journey through the app

1. **Register** — phone number, full name, password, date of birth. No OTP/SMS
   verification step exists anymore — the account is created and logged in immediately.
2. **Pick a hospital** — a one-time onboarding step (map + list of hospitals) that marks
   the account "onboarded" and determines which providers she can be matched with.
3. **Home** — pregnancy week/trimester summary, weekly baby-growth facts.
4. **Track** — logs mood (1–5), symptoms, weight, baby kicks once per day; a contraction
   timer tool.
5. **Timeline** — charts of her logged history over time (Recharts).
6. **Learn** — a bilingual tips library (6 categories: What to Do, What to Avoid, Warning
   Signs, Hormonal Changes, Birth Prep, Nutrition & Food), with bookmarking.
7. **Chat** — two tabs: an **AI Health Assistant** (Gemini-powered, always available) and
   **My Provider** (a direct message thread with her assigned provider — she can now
   start this herself; it used to only be startable by the provider).
8. **Appointments** — she can request an appointment; it goes in as `requested` and
   needs the provider to confirm, decline, or propose a new time (auto-confirm only
   happens when the *provider* books on her behalf). She can cancel a pending request.
9. **Emergency (SOS)** — one tap sends her GPS location and alerts her assigned provider
   and emergency contacts (via SMS).
10. **Profile / Settings / Preferences** — dark mode, language (EN/SW), text size
    (Small/Medium/Large), emergency contacts, hospital map.

## 3. A provider's journey through the app

1. **Register/Login** as `provider`, tied to a hospital and specialization
   (obstetrician/midwife/nurse).
2. **Provider Dashboard** — patient count, appointment attendance rate, medication
   adherence rate, today's appointments, and a combined critical-alerts feed (high-risk
   symptom reports, SOS triggers, high-risk ANC visits).
3. **Assigned patients** — a newly onboarded provider is auto-assigned any previously
   unassigned mothers at the same hospital, up to their workload capacity. The provider
   can open any assigned patient's detail panel, message them directly, or start an ANC
   visit for them.
4. **Appointment requests** — a dedicated section to confirm/decline/propose-a-new-time
   for mother-initiated requests, separate from appointments the provider books directly
   (which auto-confirm).
5. **ANC Visit form** — records vitals, labs, and obstetric exam data; the system
   auto-computes a WHO-aligned risk level (see §5) which the provider can manually
   override.
6. **Direct chat ("Direct" tab)** — lists every assigned patient (not just ones who've
   already messaged) and lets the provider reply to any thread.
7. **Completed appointments view**, dark mode / language / text-size controls scoped to
   the dashboard's own header.

---

## 4. Feature-by-feature status

| Feature | Status | Notes |
|---|---|---|
| Registration / login / logout | ✅ Working | Phone-number + password. No OTP step. |
| Password reset | ✅ Working | Phone number + new password, no OTP/code required — a deliberate simplification, not a bug. |
| JWT session handling | ✅ Working | Access token in memory only; refresh token in an httpOnly cookie; auto-refresh on app load. |
| Hospital selection / onboarding | ✅ Working | |
| Mood/symptom tracking | ✅ Working | One entry per day. |
| Timeline charts | ✅ Working | |
| Learn / tips library | ✅ Working | 24 seeded bilingual tips across 6 categories. |
| AI Health Assistant (Gemini chat) | ✅ Working | Requires a valid `GEMINI_API_KEY`; degrades gracefully with a clear message if the key/SDK is missing. |
| Rule-based danger-sign safety net | ✅ Working | Runs independently of the AI so a Gemini outage/hallucination can't hide a red-flag symptom. |
| Direct mother↔provider chat | ✅ Working | Mother-initiated (auto-resolves her assigned provider) and provider-initiated both work. |
| In-app notifications (bell icon) | ✅ Working | New — covers new chat messages and appointment status changes. |
| Appointment booking (mother) | ✅ Working | Goes in as `requested`, needs provider action. |
| Appointment booking (provider, on behalf of a patient) | ✅ Working | Auto-confirmed. |
| Appointment reminders (SMS) | ✅ Working (needs scheduler) | Sent by a management command; must be triggered periodically by cron/Task Scheduler — nothing runs it automatically on its own. |
| Emergency SOS | ✅ Working | Logs GPS + notifies provider + sends SMS to emergency contacts. |
| ANC clinical visit + WHO-aligned risk scoring | ✅ Working | Provider-only; risk level auto-computed, manually overridable. |
| Prescriptions & medication reminders | ⚠️ **Backend only — no screen for it** | The `Prescription`/`MedicationReminder` models, SMS reminder sending, and adherence-rate stat on the provider dashboard all work, but there is no page for a provider to *create* a prescription or for a mother to *view* one in the UI. This is the single biggest gap if your proposal promises medication management as a visible feature. |
| Video consultations | ⚠️ **Database table only — nothing built** | A `VideoConsultation` model exists (session tracking) but there is no video-calling functionality anywhere in the frontend. Treat this as "not implemented" unless you plan to build it. |
| Partner (linked support person) role | ❌ Removed | Existed earlier, deliberately removed 2026-07-04. |
| Hospital Manager role/dashboard | ❌ Removed | Its responsibilities (tip approval, provider/patient oversight) were folded into the Provider role and Django admin. |
| Bilingual support (EN/SW) | ✅ Working | UI via i18next; AI assistant detects/mirrors language per message; content models store parallel EN/SW fields. |
| Dark mode / text size | ✅ Working | App-wide toggle, persisted. |

---

## 5. Clinical risk engine (unchanged, still accurate)

`clinical/models.py::ANCVisit.evaluate_risk()` is a rule-based (not AI) expert system
aligned to WHO antenatal-care guidelines. It checks blood pressure, hemoglobin,
multiple pregnancy, maternal age, prior complications, urine protein/glucose, fetal
heart rate, and bilingual danger-sign keyword matches in free-text symptoms, producing
a `low`/`medium`/`high` risk level plus human-readable reasons and provider-facing
recommendations. A provider can override the computed level.

---

## 6. Notifications & scheduled jobs

Background work (SMS appointment reminders, medication reminders, marking missed
appointments) runs as idempotent Django management commands — there is **no Celery /
Redis / task queue**. Someone (or a deploy platform's cron feature) has to actually run
`python manage.py run_scheduled_tasks` every 15–30 minutes for reminders to go out; it
does not happen automatically just by the server running.

In-app notifications (the bell icon) are separate from SMS — they're a lightweight
`notifications` app added most recently, covering new chat messages and appointment
status changes.

---

## 7. Security & auth (unchanged, still accurate)

- JWT access token kept in memory only (never `localStorage`); refresh token in an
  httpOnly, SameSite cookie — protects against XSS token theft.
- Argon2 password hashing.
- Rate limiting on login and password-reset endpoints.
- Role-based permissions on the backend (e.g. only providers can write `ANCVisit`
  records).
- `AuditLog` records logins, failed logins, data changes, and now scheduled-task runs.
- Secrets via `.env` files, not committed to source.

---

## 8. Tech stack

**Backend:** Django 4.2 + Django REST Framework, JWT auth (SimpleJWT), PostgreSQL in
production / SQLite in dev, Google Gemini (`gemini-2.5-flash`) for the AI assistant,
Africa's Talking for SMS, Gmail SMTP for email.
**Frontend:** React 19 + TypeScript + Vite, Tailwind CSS, TanStack Query, Axios, Leaflet
(maps), Recharts (charts), i18next (EN/SW).
**Deployment:** frontend on Vercel (static build), backend on Render (`gunicorn` +
managed Postgres, `render.yaml`).

*(Full dependency versions are unchanged from the original stack table if you need them
for the dissertation — ask and this section can be expanded back out.)*

---

## 9. Things your proposal might say that are no longer true

If your proposal document predates recent changes, watch for these specific mismatches:

- **"OTP verification during registration/password reset"** — removed. Registration and
  password reset are now direct, no SMS/email code step. (`OTPCode` model still exists
  in the database schema but nothing currently calls it — it's dead code, not an active
  feature.)
- **"Partner role"** — removed entirely, including the invitation-code linking flow and
  the Partner Support page.
- **"Hospital Manager role / dashboard"** — removed entirely. Tip approval and
  provider/hospital oversight now happen via the Provider role and Django admin instead
  of a dedicated manager UI.
- **"Video consultation"** — if the proposal promises this as a working feature, it
  isn't — only a placeholder database table exists.
- **"Medication reminders"** — if the proposal implies mothers/providers can manage
  prescriptions *in the app*, that part isn't built; only the SMS-sending backend is.

---

*This document reflects the codebase as of 2026-07-11 (commit `3250889`). Update it
whenever a feature is added, removed, or changed — don't let it go stale like the
version it replaced.*
