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
  'interval_step': {
    nome: 'Interval Step',
    icona: 'fitness-center',
    colore: '#FF1493',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a'
  },
  'yoga': {
    nome: 'Yoga',
    icona: 'spa',
    colore: '#00B0FF',
    image: 'https://images.unsplash.com/photo-1590915202637-31dbc5528371'
  },
  'acquapower': {
    nome: 'AcquaPower',
    icona: 'pool',
    colore: '#00C8FF',
    image: 'https://images.unsplash.com/photo-1560089000-7433a4ebbd64'
  },
  'acquagag': {
    nome: 'AcquaGag',
    icona: 'pool',
    colore: '#00E5FF',
    image: 'https://images.unsplash.com/photo-1560089000-7433a4ebbd64'
  },
  'acquagym': {
    nome: 'Acquagym',
    icona: 'pool',
    colore: '#00C8FF',
    image: 'https://images.unsplash.com/photo-1560089000-7433a4ebbd64'
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
  primary: '#FF3B30',          // Electric Blaze red - main accent (Winter Kinetic)
  primaryDark: '#D02018',
  primaryLight: '#FF6B60',
  secondary: '#00E5FF',        // Frost cyan
  secondaryDark: '#00B2CC',
  accent: '#FFD700',           // Electric gold
  accentLime: '#39FF14',       // Neon lime
  background: '#0A0A0C',       // Pitch black obsidian
  surface: '#121216',          // Tactical card
  surfaceElevated: '#1A1A24',  // Elevated cards
  surfaceHover: '#222230',
  card: '#121216',
  cardLight: '#1A1A24',
  text: '#FFFFFF',
  textSecondary: '#A0A0B2',
  textMuted: '#68687A',
  success: '#39FF14',          // Neon lime
  warning: '#FF9500',
  error: '#FF2D55',
  danger: '#FF2D55',
  border: '#262633',
  borderStrong: '#3A3A4D',
  overlay: 'rgba(0,0,0,0.85)',
  glowOrange: 'rgba(255,149,0,0.4)',
  glowGreen: 'rgba(57,255,20,0.35)',
  // Gradient tokens (kept for compatibility)
  gradientPrimaryFrom: '#FF3B30',
  gradientPrimaryTo: '#FF9500',
  gradientSunsetFrom: '#00E5FF',
  gradientSunsetTo: '#007AFF',
  sand: '#FEF3C7',
  coral: '#FF6B6B',
};

// Fitness images (from design guidelines - Pexels/Unsplash) - Summer Tropical
export const FITNESS_IMAGES = {
  hero: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/569b8b5c6f8e52c11cdb54ed8923599b4c91a6edba944941438509a0769354ed.jpeg', // dark athlete battle ropes red neon
  abstractGym: 'https://images.unsplash.com/photo-1770513649465-2c60c8039806?w=1200&q=80',
  circuit: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/a813fe6e19528594636702c4b388b7b704175585fe8a0d2b970f7ae81c9eac14.jpeg',
  functional: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/c66580fd4f60ea5c75958c1fabba752e03db728845de2e2f42609f9d0a8702ff.jpeg',
  pilates: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/f3f0724e88253d09ae08065c7f69e671c64a84072bc0c54c2d74b5c6f14c86d8.jpeg',
  yoga: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/f3f0724e88253d09ae08065c7f69e671c64a84072bc0c54c2d74b5c6f14c86d8.jpeg',
};

// Locandine corsi (generate su misura - Winter Kinetic 2026/27)
export const COURSE_IMAGES: Record<string, string> = {
  circuito: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/a813fe6e19528594636702c4b388b7b704175585fe8a0d2b970f7ae81c9eac14.jpeg',
  funzionale: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/c66580fd4f60ea5c75958c1fabba752e03db728845de2e2f42609f9d0a8702ff.jpeg',
  pilates: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/f3f0724e88253d09ae08065c7f69e671c64a84072bc0c54c2d74b5c6f14c86d8.jpeg',
  interval_step: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/5af00642d72b4b49ab350ddf4be7f5f09f99930e2feb0bd5532f213993c2c114.jpeg',
};

// Grafiche brand (generate su misura)
export const BRAND_IMAGES = {
  goldenTicket: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/0cea0f9026411c2cb6232a128e8a964c4db824543a10cab082f9edad3ba0d00e.jpeg',
  premiOroBg: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/7caf78ea70d0eb93e9bb78814f1fae0bcdb65f610945273fd924645f61c4af4f.jpeg',
  loginBg: 'https://static.prod-images.emergentagent.com/jobs/120068e1-741e-430e-86ee-0f10594d3f2d/images/f2070f041f16e056ad58b04d45654a7c646b8b45ed597eb6fc3e06d73702f09e.jpeg',
};
