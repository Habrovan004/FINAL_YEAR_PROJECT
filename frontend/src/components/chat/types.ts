// Shared between the mother's direct-chat tab (ChatPage.tsx) and the
// provider's direct-chat tab (ProviderChatQueue.tsx) — both talk to the same
// `chat.ChatRoom`/`chat.Message` backend and render the same message shapes.

export interface VisitCardData {
  id: number
  visit_date: string
  gestational_age_weeks: number
  blood_pressure_systolic: number
  blood_pressure_diastolic: number
  weight_kg: number
  hemoglobin_g_dl: number | null
  risk_level: 'low' | 'medium' | 'high'
  complications: string
  next_appointment_date: string | null
}

export interface DirectMessage {
  id: number
  sender: number | null
  sender_name: string
  message_type: 'text' | 'system' | 'visit_card' | 'deleted'
  text: string
  visit_card: VisitCardData | null
  is_read: boolean
  read_at: string | null
  is_own: boolean
  created_at: string
  // client-only optimistic-send bookkeeping — absent on server-fetched messages
  clientId?: string
  pending?: boolean
  failed?: boolean
}

export interface ChatRoomRow {
  id: number
  patient?: number
  patient_name?: string
  provider_name?: string
  provider_hospital?: string | null
  last_message: { text: string; sender_id: number; created_at: string } | null
  unread_count: number
}
