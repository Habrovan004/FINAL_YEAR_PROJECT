# Uzazi Safe Link (Mimba Yangu) — Project Summary

*Final Year Dissertation Project — Ardhi University*
*A Web-Based Telemedicine System for Maternal Health and Pre-Natal Care*

> **This file is the living, accurate description of what the app actually does right now.**
> It is rewritten from the real codebase (not carried over from old notes), and it will be
> updated every time a feature changes. Use it to check your proposal against reality —
> anywhere the proposal says something different, that's either a proposal update needed
> or a feature still to build.
>
> Last verified against the code: **2026-07-16**, branch `fix/sos-screen-accuracy` (commit `639adae`).

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
9. **Emergency (SOS)** — a 1.5-second long-press sends her GPS location, opens the phone
   dialer to the national emergency number, and alerts her assigned provider by SMS. The
   confirmation screen then honestly reflects what actually happened instead of always
   showing the same success card: **green** if Africa's Talking confirmed the SMS was
   accepted, **amber "still trying — call directly"** if the alert was logged but the SMS
   wasn't confirmed sent, or a separate **"could not confirm — call directly"** state if
   the trigger request itself failed (with an offline queue that retries automatically
   when connectivity returns). Whichever state she's in, the screen surfaces her saved
   primary emergency contact and her assigned provider's phone as the most prominent
   call options — ahead of the generic national numbers (112 ambulance / 999 police,
   labeled "Backup numbers"), since those aren't reliably tied to dispatch outside Dar es
   Salaam. Closing the confirmation screen only dismisses it locally — it never cancels
   the alert or the SMS, and the screen says so explicitly.
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
| Password reset | ✅ Working | Phone number + new password, no OTP/code required — a deliberate simplification, not a bug. The old OTP scaffolding (`OTPCode` model, `VerifyOTP` screen, unused email/SMS senders) was fully deleted 2026-07-11, not just unused. |
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
| Emergency SOS | ✅ Working | Logs GPS, opens the dialer, and SMS-notifies the assigned provider (not emergency contacts — those are surfaced as tap-to-call options, not auto-texted). The confirmation screen shows the *real* SMS delivery outcome (sent / unsent / request-failed) and prioritizes the mother's saved contact + provider phone over the generic 112/999 numbers. |
| ANC clinical visit + WHO-aligned risk scoring | ✅ Working | Provider-only; risk level auto-computed, manually overridable. |
| Prescriptions & medication reminders | ⚠️ **Backend only — no screen for it** | The `Prescription`/`MedicationReminder` models, SMS reminder sending, and adherence-rate stat on the provider dashboard all work, but there is no page for a provider to *create* a prescription or for a mother to *view* one in the UI. This is the single biggest gap if your proposal promises medication management as a visible feature. |
| Video consultations | ❌ **Not implemented** | The scaffolded `VideoConsultation` model (and its unused serializer/admin registration) was deleted 2026-07-12 as dead code — there was never a view, URL, or frontend screen behind it. Nothing video-related exists in the codebase now. |
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
**Frontend:** React 19 + TypeScript + Vite, Tailwind CSS, Axios (no TanStack Query — it
was added early on, never actually used, and removed 2026-07-12), Leaflet (maps),
Recharts (charts), i18next (EN/SW).
**Deployment:** frontend on Vercel (static build), backend on Render free tier
(`gunicorn` + managed Postgres, `render.yaml`). The frontend API client retries once on
a network-level failure to ride out Render's free-tier cold start (the instance spins
down after inactivity), and `ALLOWED_HOSTS` picks up Render's injected
`RENDER_EXTERNAL_HOSTNAME` automatically so it can't drift out of sync with the deployed
service.

*(Full dependency versions are unchanged from the original stack table if you need them
for the dissertation — ask and this section can be expanded back out.)*

---

## 9. Things your proposal might say that are no longer true

If your proposal document predates recent changes, watch for these specific mismatches:

- **"OTP verification during registration/password reset"** — removed. Registration and
  password reset are now direct, no SMS/email code step. The `OTPCode` model, the
  `VerifyOTP` screen, and the unused OTP-sending helpers are gone from the codebase
  entirely (deleted 2026-07-11), not just unused.
- **"Partner role"** — removed entirely, including the invitation-code linking flow and
  the Partner Support page.
- **"Hospital Manager role / dashboard"** — removed entirely. Tip approval and
  provider/hospital oversight now happen via the Provider role and Django admin instead
  of a dedicated manager UI.
- **"Admin role / audit-log & backup dashboard"** — the `admin` user type was dropped
  long ago, which silently made the entire `maintenance` app (audit log viewer, backup
  trigger, account recovery) unreachable by any account. That dead code was deleted
  2026-07-12; `AuditLog` itself is still written by scheduled tasks and appointment
  actions, just with no dedicated viewer UI.
- **"Video consultation"** — not implemented. Even the placeholder `VideoConsultation`
  database table was removed as dead code (2026-07-12) — treat this as nonexistent, not
  "partially built."
- **"Medication reminders"** — if the proposal implies mothers/providers can manage
  prescriptions *in the app*, that part isn't built; only the SMS-sending backend is.
- **"SOS alerts the mother's emergency contacts automatically"** — it doesn't; the SMS
  goes to the assigned provider only. Emergency contacts are shown as prominent tap-to-call
  buttons on the confirmation screen, not auto-notified.

---

*This document reflects the codebase as of 2026-07-16 (commit `639adae`, plus
uncommitted deployment-robustness fixes on `fix/sos-screen-accuracy` — see §8). Update
it whenever a feature is added, removed, or changed — don't let it go stale like the
version it replaced.*
