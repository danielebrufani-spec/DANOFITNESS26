import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
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
  data_inizio: string;
  data_scadenza: string;
  attivo: boolean;
  scaduto: boolean;
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
  role: string;
  push_token?: string;
  profile_image?: string;
}

export interface DailyStats {
  data: string;
  totale_prenotazioni: number;
  prenotazioni_per_lezione: { [key: string]: number };
  abbonamenti_scaduti: number;
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
  createSubscription: (data: { user_id: string; tipo: string; data_inizio?: string; lezioni_rimanenti?: number }) =>
    api.post<Subscription>('/subscriptions', data),
  updateSubscription: (id: string, data: { lezioni_rimanenti?: number; data_scadenza?: string; attivo?: boolean }) =>
    api.put<Subscription>(`/subscriptions/${id}`, data),
  deleteSubscription: (id: string) => api.delete(`/subscriptions/${id}`),

  // Bookings
  getMyBookings: () => api.get<Booking[]>('/bookings/me'),
  getBookingsByDate: (date: string) => api.get<Booking[]>(`/bookings/day/${date}`),
  createBooking: (data: { lesson_id: string; data_lezione: string }) =>
    api.post<Booking>('/bookings', data),
  cancelBooking: (id: string) => api.delete(`/bookings/${id}`),

  // Admin
  getAllUsers: () => api.get<User[]>('/admin/users'),
  deleteUser: (userId: string) => api.delete(`/admin/users/${userId}`),
  getDailyStats: (date: string) => api.get<DailyStats>(`/admin/daily-stats/${date}`),
  processEndOfDay: (date: string) => api.post(`/admin/process-day/${date}`),
  getWeeklyBookings: () => api.get('/admin/weekly-bookings'),
  getProcessingLogs: () => api.get('/admin/processing-logs'),

  // Notifications
  getMyNotifications: () => api.get<Notification[]>('/notifications/me'),
  getAllNotifications: () => api.get<Notification[]>('/admin/notifications'),
  markNotificationRead: (id: string) => api.put(`/notifications/${id}/read`),

  // Push Notifications
  getVapidPublicKey: () => api.get<{ publicKey: string }>('/push/vapid-public-key'),
  subscribePush: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) => 
    api.post('/push/subscribe', subscription),
  unsubscribePush: () => api.delete('/push/unsubscribe'),

  // Push token
  updatePushToken: (push_token: string) => api.put('/auth/push-token', { push_token }),

  // Profile Image
  updateProfileImage: (image: string) => api.put('/auth/profile-image', { profile_image: image }),

  // Init
  initAdmin: () => api.post('/init/admin'),
};

export default api;
