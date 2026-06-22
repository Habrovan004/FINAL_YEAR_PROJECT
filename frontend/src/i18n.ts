import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "continue": "Continue",
      "back": "Back",
      "step": "STEP",
      "of": "of",
      "setup_account": "Set up your account",
      "details_or": "Details — or",
      "login_here": "Login here",
      "full_name": "Full Name",
      "dob": "Date of Birth",
      "phone_number": "Phone Number",
      "password": "Password",
      "pregnant_q": "Are you currently pregnant?",
      "pregnant_sub": "Choose what fits you best — change later.",
      "yes_pregnant": "Yes, I am pregnant",
      "planning_preg": "Planning pregnancy",
      "not_now": "Not right now",
      "timing_title": "Pregnancy timing",
      "timing_sub": "We'll calculate your week automatically.",
      "last_period": "Last Period",
      "due_date": "Due Date",
      "preferences_title": "Your preferences",
      "preferences_sub": "Personalize your app experience.",
      "notifications": "Notifications",
      "notif_sub": "Get weekly pregnancy tips and reminders.",
      "audio_guidance": "Audio Guidance",
      "audio_sub": "Learn through voice-based guidance.",
      "accessibility": "Accessibility",
      "font_size": "Font Size",
      "font_sub": "Choose a comfortable reading size.",
      "small": "Small",
      "medium": "Medium",
      "large": "Large",
      "all_set": "You're all set!",
      "welcome_msg": "Mimba Yangu is now personalized just for your journey.",
      "ready_to_verify": "Ready to verify",
      "verify_to_finish": "Confirm your phone number to save your profile and finish setup.",
      "saving": "Saving...",
      "error_saving": "There was a problem saving your preferences. Please try again."
    }
  },
  sw: {
    translation: {
      "continue": "Endelea",
      "back": "Rudi",
      "step": "Hatua",
      "of": "ya",
      "setup_account": "Fungua akaunti yako",
      "details_or": "Maelezo — au",
      "login_here": "Ingia hapa",
      "full_name": "Jina Kamili",
      "dob": "Tarehe ya Kuzaliwa",
      "phone_number": "Namba ya Simu",
      "password": "Nenosiri",
      "pregnant_q": "Je, kwa sasa una ujauzito?",
      "pregnant_sub": "Chagua inayokufaa — unaweza kubadili baadaye.",
      "yes_pregnant": "Ndiyo, nina ujauzito",
      "planning_preg": "Napanga kupata ujauzito",
      "not_now": "Sio kwa sasa",
      "timing_title": "Muda wa ujauzito",
      "timing_sub": "Tutakutafutia wiki yako moja kwa moja.",
      "last_period": "Hedhi ya Mwisho",
      "due_date": "Tarehe ya Uzazi",
      "preferences_title": "Mapendeleo yako",
      "preferences_sub": "Binafsisha matumizi yako ya app.",
      "notifications": "Taarifa (Notifications)",
      "notif_sub": "Pokea ushauri wa ujauzito na vikumbusho.",
      "audio_guidance": "Maelekezo ya Sauti",
      "audio_sub": "Jifunze kupitia sauti badala ya kusoma.",
      "accessibility": "Upatikanaji",
      "font_size": "Ukubwa wa Maandishi",
      "font_sub": "Chagua ukubwa wa maandishi unaokufaa.",
      "small": "Ndogo",
      "medium": "Kati",
      "large": "Kubwa",
      "all_set": "Umekamilisha!",
      "welcome_msg": "Mimba Yangu sasa imeboreshwa kwa ajili ya safari yako.",
      "ready_to_verify": "Tayari kuthibitisha",
      "verify_to_finish": "Thibitisha namba yako ya simu ili kuhifadhi wasifu wako na kukamilisha usanidi.",
      "saving": "Inahifadhi...",
      "error_saving": "Kuna tatizo la kuhifadhi mapendeleo yako. Jaribu tena."
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
