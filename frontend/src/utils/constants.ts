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

// Activity type display names and icons - Functional/CrossFit palette
export const ATTIVITA_INFO: { [key: string]: { nome: string; icona: string; colore: string; image?: string } } = {
  'circuito': {
    nome: 'Circuito',
    icona: 'refresh',
    colore: '#FF4500',
    image: 'https://images.pexels.com/photos/9958668/pexels-photo-9958668.jpeg'
  },
  'funzionale': {
    nome: 'Workout Funzionale',
    icona: 'fitness-center',
    colore: '#FF6B00',
    image: 'https://images.unsplash.com/photo-1578762560042-46ad127c95ea'
  },
  'pilates': {
    nome: 'Pilates',
    icona: 'self-improvement',
    colore: '#00E676',
    image: 'https://images.pexels.com/photos/35553893/pexels-photo-35553893.jpeg'
  },
  'yoga': {
    nome: 'Yoga',
    icona: 'spa',
    colore: '#00B0FF',
    image: 'https://images.unsplash.com/photo-1590915202637-31dbc5528371'
  },
};

// Subscription type display
export const ABBONAMENTO_INFO: { [key: string]: { nome: string; prezzo: string } } = {
  'lezione_singola': {
    nome: 'Lezione Singola',
    prezzo: '10 €'
  },
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
  'prova_7gg': {
    nome: 'Prova 7 Giorni',
    prezzo: 'Gratis'
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

// Colors - "Night Beach" Tropical Dark Theme — Mare Notturno + Neon Estate
export const COLORS = {
  primary: '#00C8FF',          // Turquoise neon - main accent
  primaryDark: '#0099CC',
  primaryLight: '#7DF9FF',     // Light cyan
  secondary: '#FF1493',        // Fucsia neon
  secondaryDark: '#C71585',
  accent: '#FFEA00',           // Banana / lemon yellow neon
  accentLime: '#39FF14',       // Neon lime
  background: '#0D1B2A',       // Deep night sea
  surface: '#1A2B3D',          // Card slightly lighter navy
  surfaceElevated: '#243447',  // Elevated cards
  surfaceHover: '#2F4358',
  card: '#1A2B3D',
  cardLight: '#243447',
  text: '#FFFFFF',
  textSecondary: '#B8C6D9',    // Soft light slate
  textMuted: '#7E8FA5',
  success: '#39FF14',          // Neon lime
  warning: '#FF9E00',
  error: '#FF4D6D',
  danger: '#FF4D6D',
  border: '#2F4358',
  borderStrong: '#456381',
  overlay: 'rgba(0,0,0,0.75)',
  glowOrange: 'rgba(255,158,0,0.4)',
  glowGreen: 'rgba(57,255,20,0.35)',
  // Summer-specific tokens (kept for compatibility)
  gradientPrimaryFrom: '#00C8FF',
  gradientPrimaryTo: '#7DF9FF',
  gradientSunsetFrom: '#FF1493',
  gradientSunsetTo: '#FF9E00',
  sand: '#FEF3C7',
  coral: '#FF6B6B',
};

// Fitness images (from design guidelines - Pexels/Unsplash) - Summer Tropical
export const FITNESS_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&q=80', // pool/beach summer vibes
  abstractGym: 'https://images.unsplash.com/photo-1770513649465-2c60c8039806',
  circuit: 'https://images.pexels.com/photos/9958668/pexels-photo-9958668.jpeg',
  functional: 'https://images.unsplash.com/photo-1578762560042-46ad127c95ea',
  pilates: 'https://images.pexels.com/photos/35553893/pexels-photo-35553893.jpeg',
  yoga: 'https://images.unsplash.com/photo-1590915202637-31dbc5528371',
};
