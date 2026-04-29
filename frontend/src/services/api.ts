import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'https://diobestia.onrender.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
  adapter: 'fetch',
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface Lesson {
  id: string;
  giorno: string;
  orario: string;
  tipo_attivita: string;
  descrizione?: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  user_nome?: string;
  user_cognome?: string;
  tipo: string;
  lezioni_rimanenti?: number;
  lezioni_fatte?: number;
  data_inizio: string;
  data_scadenza: string;
  attivo: boolean;
  scaduto: boolean;
  pagato: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  user_nome?: string;
  user_cognome?: string;
  lesson_id: string;
  lesson_info?: {
    giorno: string;
    orario: string;
    tipo_attivita: string;
  };
  data_lezione: string;
  abbonamento_scaduto: boolean;
  confermata: boolean;
  lezione_scalata: boolean;
  created_at: string;
  bonus_biglietti?: number;  // Bonus biglietti lotteria (es. prima prenotazione domenica)
}

export interface Notification {
  id: string;
  user_id: string;
  user_nome?: string;
  user_cognome?: string;
  tipo: string;
  messaggio: string;
  letta: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  nome: string;
  cognome: string;
  telefono?: string;
  soprannome?: string;
  role: string;
  push_token?: string;
  profile_image?: string;
  must_reset_password?: boolean;
  archived?: boolean;
  prova_attiva?: boolean;
  prova_inizio?: string;
  prova_scadenza?: string;
  ultimo_abb_tipo?: string;
  ultimo_abb_inizio?: string;
  ultimo_abb_scadenza?: string;
  ultimo_abb_pagato?: boolean;
}

export interface Reply {
  id: string;
  user_id: string;
  user_nome: string;
  user_cognome: string;
  user_profile_image?: string;
  content: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  sender_nome: string;
  sender_cognome: string;
  sender_profile_image?: string;
  content: string;
  created_at: string;
  replies: Reply[];
  is_admin_message: boolean;
}

export interface DailyStats {
  data: string;
  totale_prenotazioni: number;
  prenotazioni_per_lezione: { [key: string]: number };
  abbonamenti_scaduti: number;
  lezioni_scalate: number;
}

// API functions
export const apiService = {
  // Lessons
  getLessons: () => api.get<Lesson[]>('/lessons'),
  getLessonsByDay: (giorno: string) => api.get<Lesson[]>(`/lessons/day/${giorno}`),

  // Subscriptions
  getMySubscriptions: () => api.get<Subscription[]>('/subscriptions/me'),
  getAllSubscriptions: () => api.get<Subscription[]>('/subscriptions'),
  getExpiredSubscriptions: () => api.get<Subscription[]>('/subscriptions/expired'),
  createSubscription: (data: { user_id: string; tipo: string; data_inizio?: string; lezioni_rimanenti?: number; data_scadenza?: string; pagato?: boolean }) =>
    api.post<Subscription>('/subscriptions', data),
  updateSubscription: (id: string, data: { lezioni_rimanenti?: number; data_scadenza?: string; attivo?: boolean; pagato?: boolean }) =>
    api.put<Subscription>(`/subscriptions/${id}`, data),
  deleteSubscription: (id: string) => api.delete(`/subscriptions/${id}`),
  getUnpaidSubscriptions: () => api.get<Subscription[]>('/subscriptions/insoluti'),
  markSubscriptionPaid: (id: string) => api.put(`/subscriptions/${id}/segna-pagato`, {}),

  // Bookings
  getMyBookings: () => api.get<Booking[]>('/bookings/me'),
  getBookingsByDate: (date: string) => api.get<Booking[]>(`/bookings/day/${date}`),
  createBooking: (data: { lesson_id: string; data_lezione: string }) =>
    api.post<Booking>('/bookings', data),
  cancelBooking: (id: string) => api.delete(`/bookings/${id}`),
  getBookingHistory: () => api.get<{id: string; data: string; orario: string; tipo_attivita: string; coach: string}[]>('/bookings/history'),
  getLessonParticipants: (lessonId: string, date: string) => 
    api.get<{lesson_id: string; date: string; participants: {nome: string; booking_id?: string; user_id?: string; lezione_scalata?: boolean}[]; count: number}>(`/lessons/${lessonId}/participants/${date}`),

  // Admin: gestione manuale prenotazioni
  adminForceAddBooking: (data: { user_id: string; lesson_id: string; data_lezione: string; scala_lezione: boolean }) =>
    api.post<{ message: string; booking_id: string; scaled: { scalata: boolean; tipo: string | null; lezioni_rimanenti: number | null } }>('/admin/bookings/force-add', data),
  adminRemoveBooking: (bookingId: string, riaccredita: boolean) =>
    api.delete<{ message: string; was_scaled: boolean; credit: { riaccreditata: boolean; tipo: string | null; lezioni_rimanenti: number | null } }>(`/admin/bookings/${bookingId}/admin-remove?riaccredita=${riaccredita}`),

  // Livello Settimanale
  getUserLivello: () => api.get<{
    livello: number;
    nome: string;
    icona: string;
    descrizione: string;
    allenamenti_settimana_precedente: number;
    settimana_precedente: string;
    prossimo_livello: {livello: number; nome: string; icona: string; descrizione: string} | null;
    tutti_livelli: {livello: number; nome: string; icona: string; descrizione: string}[];
    settimana_corrente: string;
    allenamenti_fatti: number;
    allenamenti_prenotati: number;
    max_allenamenti: number;
  }>('/user/livello'),

  // Bacheca Medaglie
  getMyMedals: () => api.get<{
    totale: number;
    oro: number;
    argento: number;
    bronzo: number;
    medaglie: {
      settimana: string;
      posizione: number;
      medaglia: string;
      allenamenti: number;
      pari_merito: boolean;
    }[];
  }>('/medals/me'),

  // Subscriptions - extra
  getSubscriptionLessonsCount: (subId: string) => api.get<{lessons_count: number; data_inizio: string; data_scadenza: string}>(`/subscriptions/${subId}/lessons-count`),
  getSubscriptionLogIngressi: (subId: string) => api.get<{log_ingressi: {numero: number; giorno: string; data: string; orario: string; tipo_attivita: string; coach: string}[]; totale: number}>(`/subscriptions/${subId}/log-ingressi`),

  // Admin
  getAllUsers: () => api.get<User[]>('/admin/users'),
  getArchivedUsers: () => api.get<User[]>('/admin/users/archived'),
  archiveUser: (userId: string) => api.post(`/admin/users/${userId}/archive`),
  restoreUser: (userId: string) => api.post(`/admin/users/${userId}/restore`),
  deleteUser: (userId: string) => api.delete(`/admin/users/${userId}`),
  activateTrial: (userId: string) => api.post(`/admin/activate-trial/${userId}`),
  deactivateTrial: (userId: string) => api.post(`/admin/deactivate-trial/${userId}`),
  getNewRegistrations: () => api.get<{ nuovi_utenti: { nome: string; cognome: string; email: string; data_registrazione: string }[]; count: number }>('/admin/new-registrations'),
  markRegistrationsSeen: () => api.post('/admin/mark-registrations-seen'),
  updateUser: (userId: string, data: {nome?: string; cognome?: string; soprannome?: string; telefono?: string}) => 
    api.put(`/admin/users/${userId}`, data),
  getDailyStats: (date: string) => api.get<DailyStats>(`/admin/daily-stats/${date}`),
  getWeeklyStats: () => api.get<{presenze: number; lezioni_scalate: number; settimana: string}>('/admin/weekly-stats'),
  processEndOfDay: (date: string) => api.post(`/admin/process-day/${date}`),
  processStartedLessons: () => api.post<{
    message: string;
    data: string;
    processed_pacchetto: number;
    processed_tempo: number;
    skipped: number;
    totale_processate: number;
  }>('/admin/process-started-lessons'),
  confirmPresence: (bookingId: string) => api.post<{
    message: string;
    tipo_abbonamento: string;
    lezioni_rimanenti: number | null;
    already_processed?: boolean;
  }>(`/admin/bookings/${bookingId}/confirm-presence`),
  getWeeklyBookings: () => api.get('/admin/weekly-bookings'),
  setUserRole: (userId: string, role: string) => api.post(`/admin/users/${userId}/set-role?role=${role}`),
  resetUserPassword: (userId: string, newPassword: string) => api.post(`/admin/users/${userId}/reset-password`, { new_password: newPassword }),
  changePassword: (newPassword: string, confirmPassword: string) => api.post('/auth/change-password', { new_password: newPassword, confirm_password: confirmPassword }),
  forceProcessLessons: () => api.post<{message: string}>('/admin/force-process'),

  // Lottery
  getLotteryStatus: () => api.get('/lottery/status'),
  getLotteryWinners: () => api.get('/lottery/winners'),
  getCurrentPrize: () => api.get('/lottery/current-prize'),
  setMonthlyPrize: (premio_1: string, premio_2: string, premio_3: string) => api.post('/admin/lottery/set-prize', { premio_1, premio_2, premio_3 }),
  publishLottery: (mese: string) => api.post(`/admin/lottery/publish/${mese}`),
  reExtractLottery: (mese: string) => api.post(`/admin/lottery/re-extract/${mese}`),

  // Streak bonus settimanale
  getStreakStatus: () => api.get('/streak/status'),

  // Ruota della Fortuna
  getWheelStatus: () => api.get('/wheel/status'),
  spinWheel: () => api.post('/wheel/spin'),

  // Leaderboard settimanale
  getWeeklyLeaderboard: () => api.get<{
    leaderboard: {posizione: number; nome: string; nome_completo: string; allenamenti: number; is_me: boolean; pari_merito?: boolean}[];
    settimana: string;
    total_participants: number;
  }>('/leaderboard/weekly'),

  // Date bloccate
  getBlockedDates: () => api.get<{data: string; motivo: string}[]>('/blocked-dates'),
  blockDate: (data: string, motivo: string) => api.post('/admin/block-date', { data, motivo }),
  unblockDate: (data: string) => api.delete(`/admin/unblock-date/${data}`),

  // Annulla/Ripristina lezione singola
  cancelLesson: (lesson_id: string, data_lezione: string, motivo: string) => 
    api.post('/admin/cancel-lesson', { lesson_id, data_lezione, motivo }),
  restoreLesson: (lesson_id: string, data_lezione: string) => 
    api.delete(`/admin/cancel-lesson/${lesson_id}/${data_lezione}`),
  getCancelledLessons: () => api.get<any[]>('/cancelled-lessons'),

  getAdminDashboard: () => api.get<{
    stats: {total_users: number; active_subscriptions: number; bookings_today: number};
    today_lessons: {id: string; orario: string; tipo_attivita: string; coach: string; partecipanti: number}[];
    expiring_subscriptions: {user_nome: string; user_cognome: string; tipo: string; data_scadenza: string; lezioni_rimanenti: number | null}[];
    recent_users: {nome: string; cognome: string; created_at: string}[];
  }>('/admin/dashboard'),

  // Istruttore
  getIstruttoreLezioni: () => api.get<{
    settimana: string;
    giorni: {
      data: string;
      giorno: string;
      lezioni: {
        id: string;
        orario: string;
        tipo_attivita: string;
        coach: string;
        partecipanti: {nome: string; soprannome: string; lezione_scalata: boolean}[];
        totale_iscritti: number;
      }[];
    }[];
  }>('/istruttore/lezioni'),

  // Notifications
  getMyNotifications: () => api.get<Notification[]>('/notifications/me'),
  getAllNotifications: () => api.get<Notification[]>('/admin/notifications'),
  markNotificationRead: (id: string) => api.put(`/notifications/${id}/read`),

  // Chat/Messages
  getMessages: () => api.get<Message[]>('/messages'),
  getUnreadCount: (lastRead?: string) => api.get<{ unread_count: number }>(`/messages/unread-count${lastRead ? `?last_read=${lastRead}` : ''}`),
  createMessage: (content: string) => api.post<Message>('/messages', { content }),
  replyToMessage: (messageId: string, content: string) => api.post<Reply>(`/messages/${messageId}/reply`, { content }),
  deleteMessage: (messageId: string) => api.delete(`/messages/${messageId}`),

  // Consigli del Maestro
  getConsigli: () => api.get<{id: string; testo?: string; immagine_url?: string; immagine_base64?: string; spotify_url?: string; created_at: string}[]>('/consigli'),
  createConsiglio: (data: {testo?: string; immagine_url?: string; immagine_base64?: string; spotify_url?: string}) => api.post('/consigli', data),
  deleteConsiglio: (id: string) => api.delete(`/consigli/${id}`),

  // Consigli Musicali
  getConsigliMusicali: () => api.get<{id: string; titolo?: string; spotify_url: string; created_at: string}[]>('/consigli-musicali'),
  createConsiglioMusicale: (data: {titolo?: string; spotify_url: string}) => api.post('/consigli-musicali', data),
  deleteConsiglioMusicale: (id: string) => api.delete(`/consigli-musicali/${id}`),

  // Quiz con Categorie BONUS
  getQuizToday: () => api.get<{
    can_play: boolean;
    reason?: string;
    needs_category?: boolean;
    categorie?: { key: string; nome: string; emoji: string; colore: string }[];
    domanda_id: number | null;
    domanda: string | null;
    risposte: string[];
    gia_risposto: boolean;
    risposta_corretta: boolean | null;
    biglietti_vinti: number;
    risposta_data: number | null;
    wheel_result: number;
    bonus_type: 'raddoppia' | 'annulla' | 'standard' | null;
    potential_bonus?: number;
    categoria?: string | null;
    message: string;
  }>('/quiz/today'),
  selectQuizCategory: (categoria: string) => api.post<{
    success: boolean;
    categoria: string;
    domanda_id: number;
    domanda: string;
    risposte: string[];
    wheel_result: number;
    bonus_type: string;
    potential_bonus: number;
    message: string;
  }>('/quiz/select-category', { categoria }),
  submitQuizAnswer: (risposta_index: number) => api.post<{
    success: boolean;
    corretta: boolean;
    risposta_corretta_index: number;
    biglietti_vinti: number;
    bonus_type: string;
    wheel_result: number;
    categoria?: string;
    message: string;
  }>(`/quiz/answer?risposta_index=${risposta_index}`),

  // Init
  initAdmin: () => api.post('/init/admin'),

  // Nutrizione
  getNutritionPlan: () => api.get<any>('/nutrition/my-plan'),
  saveNutritionProfile: (data: any) => api.post<any>('/nutrition/profile', data),
  generateMealPlan: () => api.post<any>('/nutrition/generate-plan'),
  resetMealPlan: () => api.delete<any>('/nutrition/reset-plan'),
  adminResetUserPlan: (userId: string) => api.delete<any>(`/admin/nutrition/reset-plan/${userId}`),
  getAdminNutritionPlans: () => api.get<any>('/admin/nutrition/plans'),
  getAdminUserPlan: (userId: string) => api.get<any>(`/admin/nutrition/plan/${userId}`),

  // ========== SHOP / MERCHANDISE ==========
  getShopProducts: () => api.get<any[]>('/shop/products'),
  adminListShopProducts: () => api.get<any[]>('/admin/shop/products'),
  adminCreateShopProduct: (data: any) => api.post<any>('/admin/shop/products', data),
  adminUpdateShopProduct: (id: string, data: any) => api.put<any>(`/admin/shop/products/${id}`, data),
  adminDeleteShopProduct: (id: string) => api.delete<any>(`/admin/shop/products/${id}`),
  createShopOrder: (data: any) => api.post<any>('/shop/orders', data),
  getMyShopOrders: () => api.get<any[]>('/shop/orders/me'),
  adminListShopOrders: () => api.get<any[]>('/admin/shop/orders'),
  adminUpdateShopOrder: (id: string, data: any) => api.patch<any>(`/admin/shop/orders/${id}`, data),
  adminDeleteShopOrder: (id: string) => api.delete<any>(`/admin/shop/orders/${id}`),
  adminGetShopOrderWhatsappLink: (id: string) => api.post<{whatsapp_text: string}>(`/admin/shop/orders/${id}/whatsapp-link`),
};

export default api;
