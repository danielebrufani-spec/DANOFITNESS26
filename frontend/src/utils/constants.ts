// Day names in Italian
export const GIORNI = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];

export const GIORNI_DISPLAY: { [key: string]: string } = {
  'lunedi': 'Lunedì',
  'martedi': 'Martedì',
  'mercoledi': 'Mercoledì',
  'giovedi': 'Giovedì',
  'venerdi': 'Venerdì',
  'sabato': 'Sabato',
  'domenica': 'Domenica',
};

// Activity type display names and icons
export const ATTIVITA_INFO: { [key: string]: { nome: string; icona: string; colore: string } } = {
  'circuito': {
    nome: 'Circuito',
    icona: 'refresh',
    colore: '#FF6B6B'
  },
  'funzionale': {
    nome: 'Workout Funzionale',
    icona: 'fitness-center',
    colore: '#4ECDC4'
  },
  'pilates': {
    nome: 'Pilates',
    icona: 'self-improvement',
    colore: '#9B59B6'
  },
  'yoga': {
    nome: 'Yoga',
    icona: 'spa',
    colore: '#3498DB'
  },
};

// Subscription type display
export const ABBONAMENTO_INFO: { [key: string]: { nome: string; prezzo: string } } = {
  'lezioni_8': {
    nome: '8 Lezioni',
    prezzo: '55 €'
  },
  'lezioni_16': {
    nome: '16 Lezioni',
    prezzo: '95 €'
  },
  'mensile': {
    nome: 'Mensile',
    prezzo: '65 €'
  },
  'trimestrale': {
    nome: 'Trimestrale',
    prezzo: '175 €'
  },
};

// Format date for display
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Format datetime for display
export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get current day name in Italian
export const getCurrentDayName = (): string => {
  const dayIndex = new Date().getDay();
  return GIORNI[dayIndex];
};

// Get today's date in YYYY-MM-DD format (in local timezone, NOT UTC)
export const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get date string for a given date (in local timezone, NOT UTC)
export const getDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get day name from date
export const getDayNameFromDate = (dateString: string): string => {
  const date = new Date(dateString);
  const dayIndex = date.getDay();
  return GIORNI[dayIndex];
};

// Colors
export const COLORS = {
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  secondary: '#1A1A2E',
  background: '#0F0F1A',
  card: '#1A1A2E',
  cardLight: '#252540',
  text: '#FFFFFF',
  textSecondary: '#A0A0B0',
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',
  border: '#2A2A40',
};
