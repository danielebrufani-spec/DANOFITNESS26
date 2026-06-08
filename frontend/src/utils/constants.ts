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

// Colors - Tropical Pop Italian Riviera Summer 2026 (Light Theme)
// Primary: Azzurro Mare · Secondary: Fucsia POP · Accent: Banana Yellow
export const COLORS = {
  primary: '#0099DD',          // Azzurro Mare - main accent
  primaryDark: '#007BB8',      // Deeper sea blue
  primaryLight: '#4DD0E1',     // Cyan/turquoise
  secondary: '#FF1493',        // Fucsia POP - pop accent / streak
  secondaryDark: '#C71585',
  accent: '#FFEA00',           // Banana Yellow - highlights / sun rays
  accentLime: '#39FF14',       // Lime Green - success / pop
  background: '#F0F9FF',       // Sky tint white - main BG
  surface: '#FFFFFF',          // Pure white cards
  surfaceElevated: '#FFFFFF',  // Elevated cards (with shadow)
  surfaceHover: '#E0F2FE',     // Light sky hover
  card: '#FFFFFF',
  cardLight: '#F0F9FF',
  text: '#0C2333',             // Deep navy text (high contrast on white)
  textSecondary: '#597A8E',    // Medium slate
  textMuted: '#94A3B8',        // Soft slate for hints
  success: '#00E676',
  warning: '#FF9E00',          // Sunset orange for warnings
  error: '#FF1493',            // Fucsia for errors (attention-getting)
  danger: '#FF1493',
  border: '#BAE6FD',           // Light sky blue border
  borderStrong: '#7DD3FC',
  overlay: 'rgba(12,35,51,0.55)',
  glowOrange: 'rgba(255,158,0,0.35)',
  glowGreen: 'rgba(0,230,118,0.3)',
  // Summer-specific tokens
  gradientPrimaryFrom: '#0099DD',
  gradientPrimaryTo: '#00D4FF',
  gradientSunsetFrom: '#FF1493',
  gradientSunsetTo: '#FF9E00',
  sand: '#FEF3C7',             // Beach sand
  coral: '#FF6B6B',            // Coral accent
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
