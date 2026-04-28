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

// Colors - Tactical Obsidian & Kinetic Orange (Functional/CrossFit theme)
export const COLORS = {
  primary: '#FF4500',         // Kinetic Orange - main accent
  primaryDark: '#CC3800',     // Darker orange (hover/pressed)
  primaryLight: '#FF6B3D',    // Lighter orange (highlights)
  secondary: '#00E676',       // Neon Green - streaks / success / HP bars
  secondaryDark: '#00B359',
  accent: '#00B0FF',          // Electric Blue - info / links
  background: '#0A0A0A',      // Obsidian - main BG
  surface: '#121212',          // Cards
  surfaceElevated: '#1C1C1E', // Elevated cards
  surfaceHover: '#2A2A2C',
  card: '#121212',             // Alias for backwards compat
  cardLight: '#1C1C1E',        // Alias
  text: '#FFFFFF',
  textSecondary: '#A0A0A5',
  textMuted: '#6B6B70',
  success: '#00E676',
  warning: '#FFAB00',
  error: '#FF3B30',
  danger: '#FF3B30',
  border: '#2C2C2E',
  borderStrong: '#3A3A3C',
  overlay: 'rgba(10,10,10,0.75)',
  glowOrange: 'rgba(255,69,0,0.35)',
  glowGreen: 'rgba(0,230,118,0.3)',
};

// Fitness images (from design guidelines - Pexels/Unsplash)
export const FITNESS_IMAGES = {
  hero: 'https://images.pexels.com/photos/6389507/pexels-photo-6389507.jpeg',
  abstractGym: 'https://images.unsplash.com/photo-1770513649465-2c60c8039806',
  circuit: 'https://images.pexels.com/photos/9958668/pexels-photo-9958668.jpeg',
  functional: 'https://images.unsplash.com/photo-1578762560042-46ad127c95ea',
  pilates: 'https://images.pexels.com/photos/35553893/pexels-photo-35553893.jpeg',
  yoga: 'https://images.unsplash.com/photo-1590915202637-31dbc5528371',
};
