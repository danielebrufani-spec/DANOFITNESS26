import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';
import { COLORS, ABBONAMENTO_INFO, FITNESS_IMAGES } from '../../src/utils/constants';
import { StreakBanner } from '../../src/components/StreakBanner';
import { KPIBanner } from '../../src/components/KPIBanner';
import { FONTS, glow } from '../../src/theme';
import { CountUp } from '../../src/components/CountUp';

const FRASI_DIVERTENTI = [
  "Il mio sport preferito? Correre... verso il frigorifero! 🏃",
  "Sudo solo quando apro il forno 🍕",
  "La mia unica maratona? Guardare serie TV 📺",
  "Addominali? Li ho, sono solo in modalità invisibile 💪",
  "Il divano mi ama, è lui che mi trattiene 🛋️",
  "Faccio yoga ogni mattina: mi stiracchio nel letto 🧘",
  "La mia palestra? Le scale quando l'ascensore è rotto 🏋️",
  "Sono a dieta... di informazioni sul cibo 📱",
  "Sollevo pesi... la forchetta conta? 🍴",
  "Il mio cardio? Rincorrere il bus 🚌",
  "Muscoli? Ce li ho, sono sotto protezione grasso 😂",
  "La bilancia mi odia, è reciproco ⚖️",
  "Faccio squat... per raccogliere le patatine cadute 🥔",
  "Il mio personal trainer è il senso di colpa 🎯",
  "Sport estremo: alzarsi dal letto il lunedì 😴",
  "La mia corsetta mattutina? Verso il caffè ☕",
  "Sudo talmente tanto che potrei irrigare un campo 💦",
  "Il mio fisico da spiaggia? Sì, da balena spiaggiata 🐋",
  "Faccio crossfit: cross per arrivare al frigo, fit niente 🏠",
  "La mia dieta: mangio solo nei giorni che finiscono per 'ì' 📅",
  "Amo correre... lontano dalle responsabilità 🏃‍♂️",
  "Il mio six-pack è in frigorifero 🍺",
  "Stretching preferito: allungarmi per il telecomando 📺",
  "Sono in forma: la forma è tonda 🔵",
  "La mia palestra è aperta 24/7: è la mia testa con i pensieri 🧠",
  "Oggi mi alleno... a procrastinare l'allenamento 😅",
  "Il mio sport? Saltare alle conclusioni 🤸",
  "Faccio burpees... burp dopo mangiato 🍔",
  "La mia resistenza? 5 minuti senza guardare il telefono 📵",
  "Plank? Preferisco il divano, è più comodo 🛋️",
];

// Contenuti Benessere - Ricette Fitness
const RICETTE_FITNESS = [
  {
    titolo: "Overnight Oats Proteici",
    emoji: "🥣",
    ingredienti: "80g fiocchi d'avena, 200ml latte, 1 cucchiaio miele, 30g proteine in polvere, frutta fresca",
    preparazione: "Mescola tutto in un barattolo e lascia in frigo tutta la notte. Al mattino aggiungi la frutta!",
    calorie: "~350 kcal",
    tip: "Perfetto pre-workout, ti dà energia per 3-4 ore"
  },
  {
    titolo: "Pollo alla Griglia con Verdure",
    emoji: "🍗",
    ingredienti: "150g petto di pollo, zucchine, peperoni, olio EVO, limone, erbe aromatiche",
    preparazione: "Griglia il pollo 6 min per lato. Cuoci le verdure alla piastra. Condisci con limone e erbe.",
    calorie: "~280 kcal",
    tip: "Alto contenuto proteico, ideale post-allenamento"
  },
  {
    titolo: "Smoothie Verde Energizzante",
    emoji: "🥤",
    ingredienti: "1 banana, spinaci freschi, 1 cucchiaio burro d'arachidi, latte di mandorla, ghiaccio",
    preparazione: "Frulla tutto per 1 minuto. Aggiungi ghiaccio a piacere.",
    calorie: "~250 kcal",
    tip: "Ricco di ferro e potassio, combatte la stanchezza"
  },
  {
    titolo: "Bowl di Quinoa e Salmone",
    emoji: "🍣",
    ingredienti: "80g quinoa, 100g salmone, avocado, edamame, salsa di soia, semi di sesamo",
    preparazione: "Cuoci la quinoa. Griglia il salmone. Assembla con avocado ed edamame. Condisci.",
    calorie: "~420 kcal",
    tip: "Omega-3 per il recupero muscolare"
  },
  {
    titolo: "Pancake Proteici alla Banana",
    emoji: "🥞",
    ingredienti: "1 banana matura, 2 uova, 30g avena, cannella, mirtilli",
    preparazione: "Schiaccia la banana, mescola con uova e avena. Cuoci in padella antiaderente 2 min per lato.",
    calorie: "~300 kcal",
    tip: "Senza zuccheri aggiunti, dolcezza naturale"
  },
  {
    titolo: "Insalata di Tonno e Fagioli",
    emoji: "🥗",
    ingredienti: "160g tonno al naturale, fagioli cannellini, cipolla rossa, pomodorini, prezzemolo",
    preparazione: "Scola tonno e fagioli. Mescola con verdure tritate. Condisci con olio e limone.",
    calorie: "~320 kcal",
    tip: "Pronta in 5 minuti, perfetta per il pranzo"
  },
  {
    titolo: "Yogurt Greco con Granola",
    emoji: "🍯",
    ingredienti: "200g yogurt greco 0%, 40g granola, miele, noci, frutti di bosco",
    preparazione: "Versa lo yogurt in una ciotola. Aggiungi granola, frutta e un filo di miele.",
    calorie: "~280 kcal",
    tip: "Spuntino perfetto, 20g di proteine"
  },
  {
    titolo: "Wrap di Tacchino",
    emoji: "🌯",
    ingredienti: "1 tortilla integrale, 80g tacchino, hummus, lattuga, pomodoro, cetriolo",
    preparazione: "Spalma l'hummus sulla tortilla. Aggiungi tacchino e verdure. Arrotola stretto.",
    calorie: "~290 kcal",
    tip: "Pratico da portare in palestra"
  },
  {
    titolo: "Zuppa di Lenticchie",
    emoji: "🍲",
    ingredienti: "200g lenticchie, carota, sedano, cipolla, pomodoro, curcuma",
    preparazione: "Soffriggi le verdure. Aggiungi lenticchie e acqua. Cuoci 30 min con curcuma.",
    calorie: "~250 kcal",
    tip: "Proteine vegetali e fibre, sazia a lungo"
  },
  {
    titolo: "Energy Balls al Cacao",
    emoji: "🍫",
    ingredienti: "100g datteri, 50g mandorle, 2 cucchiai cacao, cocco rapé",
    preparazione: "Frulla datteri e mandorle. Aggiungi cacao. Forma palline e rotola nel cocco.",
    calorie: "~80 kcal cad.",
    tip: "Snack naturale, energia immediata"
  },
  {
    titolo: "Frittata di Albumi e Verdure",
    emoji: "🍳",
    ingredienti: "4 albumi, spinaci, pomodorini, feta light, erbe aromatiche",
    preparazione: "Sbatti gli albumi con le erbe. Cuoci in padella con verdure. Aggiungi feta a fine cottura.",
    calorie: "~180 kcal",
    tip: "Proteine pure senza grassi"
  },
  {
    titolo: "Buddha Bowl Mediterranea",
    emoji: "🥙",
    ingredienti: "Ceci, cetrioli, pomodori, olive, feta, hummus, olio EVO",
    preparazione: "Disponi tutti gli ingredienti in una bowl. Condisci con olio e limone.",
    calorie: "~380 kcal",
    tip: "Pasto completo vegetariano"
  },
  {
    titolo: "Riso Integrale con Gamberi",
    emoji: "🍤",
    ingredienti: "80g riso integrale, 150g gamberi, aglio, prezzemolo, peperoncino, olio EVO",
    preparazione: "Cuoci il riso. Saltai gamberi con aglio e peperoncino 3 min. Unisci e aggiungi prezzemolo.",
    calorie: "~350 kcal",
    tip: "Leggero ma saziante, ricco di proteine magre"
  },
  {
    titolo: "Avocado Toast con Uovo",
    emoji: "🥑",
    ingredienti: "2 fette pane integrale, 1 avocado maturo, 2 uova, sale, pepe, semi di sesamo",
    preparazione: "Tosta il pane. Schiaccia l'avocado e spalma. Cuoci le uova in camicia e appoggia sopra.",
    calorie: "~400 kcal",
    tip: "Grassi buoni + proteine = colazione perfetta"
  },
  {
    titolo: "Poke Bowl Hawaiana",
    emoji: "🐟",
    ingredienti: "100g tonno fresco, riso, avocado, cetriolo, carote, edamame, salsa ponzu",
    preparazione: "Taglia il tonno a cubetti. Disponi riso e verdure nella bowl. Aggiungi tonno e condisci.",
    calorie: "~380 kcal",
    tip: "Proteine nobili e carboidrati a lento rilascio"
  },
  {
    titolo: "Burger di Ceci",
    emoji: "🍔",
    ingredienti: "240g ceci, cipolla, aglio, cumino, prezzemolo, pangrattato, 1 uovo",
    preparazione: "Frulla i ceci con gli ingredienti. Forma burger e cuoci in padella 4 min per lato.",
    calorie: "~250 kcal",
    tip: "Alternativa vegetale ricca di fibre"
  },
  {
    titolo: "Insalata di Pollo e Mango",
    emoji: "🥭",
    ingredienti: "120g petto di pollo, mango, rucola, noci, lime, olio EVO",
    preparazione: "Griglia il pollo e taglialo a strisce. Mescola con rucola e mango. Condisci con lime.",
    calorie: "~320 kcal",
    tip: "Fresca e proteica, perfetta d'estate"
  },
  {
    titolo: "Pasta Integrale al Pesto di Rucola",
    emoji: "🍝",
    ingredienti: "80g pasta integrale, rucola, pinoli, parmigiano, aglio, olio EVO",
    preparazione: "Frulla rucola, pinoli, aglio e olio. Cuoci la pasta al dente e condisci con il pesto.",
    calorie: "~380 kcal",
    tip: "Carboidrati complessi per energia duratura"
  },
  {
    titolo: "Crema di Zucca e Zenzero",
    emoji: "🎃",
    ingredienti: "300g zucca, cipolla, zenzero fresco, brodo vegetale, semi di zucca",
    preparazione: "Cuoci zucca e cipolla nel brodo 20 min. Frulla con zenzero. Servi con semi tostati.",
    calorie: "~150 kcal",
    tip: "Antiossidante e anti-infiammatoria"
  },
  {
    titolo: "Tacchino al Curry con Riso Basmati",
    emoji: "🍛",
    ingredienti: "150g tacchino, curry, latte di cocco light, riso basmati, piselli",
    preparazione: "Rosola il tacchino. Aggiungi curry e latte di cocco. Cuoci 15 min. Servi con riso.",
    calorie: "~400 kcal",
    tip: "Speziato e proteico, accelera il metabolismo"
  },
  {
    titolo: "Tartare di Manzo Light",
    emoji: "🥩",
    ingredienti: "150g filetto di manzo, capperi, cipollotto, senape, olio EVO, tuorlo d'uovo",
    preparazione: "Taglia il manzo a coltello finemente. Condisci con capperi, cipollotto e senape. Aggiungi tuorlo.",
    calorie: "~280 kcal",
    tip: "Ferro e proteine nobili per i muscoli"
  },
  {
    titolo: "Muffin Proteici ai Mirtilli",
    emoji: "🧁",
    ingredienti: "100g farina d'avena, 2 uova, 30g proteine, mirtilli, stevia, lievito",
    preparazione: "Mescola tutti gli ingredienti. Versa negli stampini. Cuoci in forno 20 min a 180°C.",
    calorie: "~120 kcal cad.",
    tip: "Dolce senza sensi di colpa"
  },
  {
    titolo: "Insalatona Greca",
    emoji: "🇬🇷",
    ingredienti: "Pomodori, cetrioli, cipolla rossa, olive kalamata, feta, origano, olio EVO",
    preparazione: "Taglia le verdure a pezzi grossi. Aggiungi feta a cubetti e olive. Condisci con origano e olio.",
    calorie: "~280 kcal",
    tip: "Classica mediterranea, fresca e nutriente"
  },
  {
    titolo: "Filetto di Orata al Forno",
    emoji: "🐠",
    ingredienti: "200g orata, pomodorini, olive, capperi, prezzemolo, vino bianco",
    preparazione: "Disponi l'orata in teglia. Aggiungi pomodorini e olive. Sfuma con vino e inforna 20 min a 200°C.",
    calorie: "~220 kcal",
    tip: "Omega-3 e proteine, leggerissimo"
  },
  {
    titolo: "Hummus Fatto in Casa",
    emoji: "🧆",
    ingredienti: "400g ceci, tahina, limone, aglio, cumino, olio EVO, paprika",
    preparazione: "Frulla ceci con tahina, succo di limone, aglio e cumino. Servi con filo d'olio e paprika.",
    calorie: "~150 kcal (porz.)",
    tip: "Snack perfetto con verdure crude"
  },
  {
    titolo: "Shakshuka Proteica",
    emoji: "🍅",
    ingredienti: "400g pomodori pelati, 4 uova, cipolla, peperoni, cumino, prezzemolo",
    preparazione: "Soffriggi cipolla e peperoni. Aggiungi pomodori e cumino. Crea buche e rompi le uova. Copri 10 min.",
    calorie: "~250 kcal",
    tip: "Colazione salata ricca di proteine"
  },
  {
    titolo: "Vellutata di Broccoli",
    emoji: "🥦",
    ingredienti: "400g broccoli, patata, cipolla, brodo vegetale, parmigiano, noce moscata",
    preparazione: "Cuoci broccoli e patata nel brodo 20 min. Frulla e aggiungi parmigiano e noce moscata.",
    calorie: "~180 kcal",
    tip: "Detox e ricca di vitamina C"
  },
  {
    titolo: "Polpette di Tacchino al Sugo",
    emoji: "🧆",
    ingredienti: "200g macinato di tacchino, pangrattato, uovo, passata di pomodoro, basilico",
    preparazione: "Impasta tacchino con pangrattato e uovo. Forma polpette e cuoci nel sugo 20 min.",
    calorie: "~300 kcal",
    tip: "Comfort food leggero e proteico"
  },
  {
    titolo: "Porridge Proteico alla Mela",
    emoji: "🍎",
    ingredienti: "50g avena, latte, 1 mela, cannella, noci, miele",
    preparazione: "Cuoci l'avena nel latte 5 min. Aggiungi mela grattugiata, cannella, noci e miele.",
    calorie: "~320 kcal",
    tip: "Colazione invernale che scalda e sazia"
  },
  {
    titolo: "Carpaccio di Zucchine",
    emoji: "🥒",
    ingredienti: "2 zucchine, rucola, scaglie di parmigiano, pinoli, limone, olio EVO",
    preparazione: "Affetta le zucchine sottilissime con la mandolina. Disponi su rucola. Condisci con limone e parmigiano.",
    calorie: "~180 kcal",
    tip: "Antipasto light e rinfrescante"
  },
];

// Funzione per ottenere la ricetta del giorno
const getRicettaDelGiorno = () => {
  const oggi = new Date();
  const inizioAnno = new Date(oggi.getFullYear(), 0, 0);
  const diff = oggi.getTime() - inizioAnno.getTime();
  const giornoAnno = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  // Una ricetta diversa ogni giorno, cicla ogni 30 giorni
  const indice = giornoAnno % RICETTE_FITNESS.length;
  return RICETTE_FITNESS[indice];
};

interface DashboardData {
  stats: { total_users: number; active_subscriptions: number; bookings_today: number };
  today_lessons: { id: string; orario: string; tipo_attivita: string; coach: string; partecipanti: number }[];
  expiring_subscriptions: { user_nome: string; user_cognome: string; tipo: string; data_scadenza: string; lezioni_rimanenti: number | null }[];
  recent_users: { nome: string; cognome: string; created_at: string }[];
}

interface ExpiredSub {
  id: string;
  user_id: string;
  user_nome?: string;
  user_cognome?: string;
  tipo: string;
  data_scadenza: string;
}

export default function HomeScreen() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newRegistrations, setNewRegistrations] = useState<{nome: string; cognome: string}[]>([]);
  const [showNewUsersAlert, setShowNewUsersAlert] = useState(false);
  // Shop new orders notification (admin only)
  const [newShopOrders, setNewShopOrders] = useState<any[]>([]);
  const [showShopOrdersAlert, setShowShopOrdersAlert] = useState(false);
  
  // Spinning logo animation - starts immediately
  const spinValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, []);
  
  const spinInterpolate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  // Client state
  const [currentQuote, setCurrentQuote] = useState(0);
  const [notifications, setNotifications] = useState<{id: string; type: string; message: string; icon: string; color: string}[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
  
  // Admin state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [expiredSubs, setExpiredSubs] = useState<ExpiredSub[]>([]);
  const [selectedUser, setSelectedUser] = useState<ExpiredSub | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [renewPagato, setRenewPagato] = useState(true);
  const [weeklyStats, setWeeklyStats] = useState({ presenze: 0, lezioni_scalate: 0, settimana: '' });
  const [hasMealPlan, setHasMealPlan] = useState(false);
  const [cancelledLessons, setCancelledLessons] = useState<any[]>([]);

  // Funzione per caricare notifiche cliente
  const loadClientNotifications = async () => {
    const notifs: {id: string; type: string; message: string; icon: string; color: string}[] = [];
    
    try {
      // 1. Controlla abbonamento
      const subRes = await apiService.getMySubscriptions();
      const activeSub = subRes.data.find((s: any) => s.attivo && !s.scaduto);
      
      if (activeSub) {
        const isLezioni = activeSub.tipo?.includes('lezioni');
        
        if (isLezioni && activeSub.lezioni_rimanenti !== null && activeSub.lezioni_rimanenti <= 2) {
          notifs.push({
            id: 'sub_expiring_lessons',
            type: 'warning',
            message: `⚠️ Solo ${activeSub.lezioni_rimanenti} ${activeSub.lezioni_rimanenti === 1 ? 'lezione' : 'lezioni'} rimaste! Contatta Daniele per rinnovare.`,
            icon: 'alert-circle',
            color: '#f59e0b'
          });
        } else if (!isLezioni && activeSub.data_scadenza) {
          const scadenza = new Date(activeSub.data_scadenza);
          const oggi = new Date();
          const diffDays = Math.ceil((scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 3 && diffDays > 0) {
            notifs.push({
              id: 'sub_expiring_days',
              type: 'warning',
              message: `⚠️ Abbonamento in scadenza tra ${diffDays} ${diffDays === 1 ? 'giorno' : 'giorni'}! Contatta Daniele.`,
              icon: 'alert-circle',
              color: '#f59e0b'
            });
          }
        }
      }

      // 2. Controlla prenotazioni di domani
      const bookingsRes = await apiService.getMyBookings();
      const domani = new Date();
      domani.setDate(domani.getDate() + 1);
      const domaniStr = domani.toISOString().split('T')[0];
      
      const bookingsDomani = bookingsRes.data.filter((b: any) => b.data_lezione === domaniStr);
      if (bookingsDomani.length > 0) {
        const lezione = bookingsDomani[0].lesson_info;
        notifs.push({
          id: 'booking_tomorrow',
          type: 'info',
          message: `💪 Domani hai ${lezione?.tipo_attivita || 'allenamento'} alle ${lezione?.orario || ''}!`,
          icon: 'fitness',
          color: '#22c55e'
        });
      }

      // 3. Controlla se è il giorno dell'estrazione (1° del mese)
      const todayDate = new Date();
      if (todayDate.getDate() === 1) {
        notifs.push({
          id: 'lottery_day',
          type: 'info',
          message: `🎰 OGGI estrazione lotteria alle 12:00! Controlla se hai vinto!`,
          icon: 'gift',
          color: '#FFD700'
        });
      }

      // 4. Controlla se hai vinto la lotteria
      try {
        const lotteryRes = await apiService.getLotteryStatus();
        if (lotteryRes.data.vincitore?.is_me) {
          notifs.push({
            id: 'lottery_winner',
            type: 'success',
            message: `🏆 SEI IL VINCITORE DELLA LOTTERIA! Ritira il premio dal Maestro!`,
            icon: 'trophy',
            color: '#FFD700'
          });
        }
      } catch (e) {}

      // 5. Controlla se puoi girare la ruota
      try {
        const wheelRes = await apiService.getWheelStatus();
        if (wheelRes.data.can_spin) {
          notifs.push({
            id: 'wheel_available',
            type: 'info',
            message: `🎡 Hai un giro alla Ruota della Fortuna! Vai nella sezione Premi!`,
            icon: 'sync',
            color: '#ec4899'
          });
        }
      } catch (e) {}

      // 6. Controlla date bloccate (lezioni sospese)
      try {
        const blockedRes = await apiService.getBlockedDates();
        if (blockedRes.data && blockedRes.data.length > 0) {
          for (const blocked of blockedRes.data) {
            const blockedDate = new Date(blocked.data);
            const oggi = new Date();
            const diffDays = Math.ceil((blockedDate.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 7) {
              const giornoSettimana = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][blockedDate.getDay()];
              notifs.push({
                id: `blocked_${blocked.data}`,
                type: 'warning',
                message: `⚠️ ${giornoSettimana} ${blockedDate.getDate()}/${blockedDate.getMonth() + 1}: ${blocked.motivo}`,
                icon: 'alert-circle',
                color: '#f59e0b'
              });
            }
          }
        }
      } catch (e) {}
      
    } catch (error) {
      console.log('Error loading notifications:', error);
    }
    
    setNotifications(notifs);
  };

  const loadData = async (showLoading = true) => {
    try {
      // Don't show loading spinner if we already have data
      if (showLoading && !dashboard) {
        setLoading(true);
      }
      if (isAdmin) {
        const res = await apiService.getAdminDashboard();
        setDashboard(res.data);
        // Carica abbonamenti scaduti
        const expiredRes = await apiService.getExpiredSubscriptions();
        setExpiredSubs(expiredRes.data as any);
        // Carica stats settimanali
        try {
          const weeklyRes = await apiService.getWeeklyStats();
          setWeeklyStats(weeklyRes.data);
        } catch (e) {}
        // Carica notifiche nuovi ordini shop (admin)
        try {
          const ordersNotif = await apiService.adminPendingOrderNotifications();
          if (ordersNotif.data.count > 0) {
            setNewShopOrders(ordersNotif.data.orders);
            setShowShopOrdersAlert(true);
          }
        } catch (e) { /* silenzioso se shop non ancora caricato */ }
      } else {
        // Carica notifiche per cliente
        await loadClientNotifications();
        // Check piano alimentare
        try {
          const nutritionRes = await apiService.getNutritionPlan();
          // Banner scompare SOLO quando l'utente ha COMPLETATO il piano
          setHasMealPlan(!!nutritionRes.data.plan);
        } catch (e) {
          setHasMealPlan(false);
        }
      }
      // Carica lezioni annullate per tutti
      try {
        const cancelledRes = await apiService.getCancelledLessons();
        setCancelledLessons(cancelledRes.data);
      } catch { setCancelledLessons([]); }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const assignSubscription = async (tipo: string) => {
    if (!selectedUser) return;
    try {
      await apiService.createSubscription({
        user_id: selectedUser.user_id,
        tipo: tipo,
        pagato: renewPagato,
      });
      const pagatoLabel = renewPagato ? '' : ' (DA SALDARE)';
      Alert.alert('Successo', `Abbonamento ${tipo} assegnato!${pagatoLabel}`);
      setShowModal(false);
      setSelectedUser(null);
      setRenewPagato(true);
      loadData();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile assegnare abbonamento');
    }
  };

  // Archivia cliente dalla home (abbonamenti scaduti)
  const archiveClient = async () => {
    if (!selectedUser) return;
    
    if (Platform.OS === 'web') {
      if (window.confirm(`Vuoi archiviare ${selectedUser.user_nome} ${selectedUser.user_cognome}? Il cliente sarà spostato nella sezione "Archiviati".`)) {
        try {
          await apiService.archiveUser(selectedUser.user_id);
          alert('Cliente archiviato con successo');
          setShowModal(false);
          setSelectedUser(null);
          loadData();
        } catch (error) {
          alert('Errore durante l\'archiviazione');
        }
      }
    } else {
      Alert.alert(
        'Archivia Cliente',
        `Vuoi archiviare ${selectedUser.user_nome} ${selectedUser.user_cognome}?\n\nIl cliente non verrà eliminato ma spostato nella sezione "Archiviati" nel pannello Admin.`,
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Archivia',
            style: 'destructive',
            onPress: async () => {
              try {
                await apiService.archiveUser(selectedUser.user_id);
                Alert.alert('Archiviato', 'Cliente archiviato con successo');
                setShowModal(false);
                setSelectedUser(null);
                loadData();
              } catch (error) {
                Alert.alert('Errore', 'Impossibile archiviare il cliente');
              }
            }
          }
        ]
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [isAdmin])
  );

  // Check nuovi iscritti per admin
  useEffect(() => {
    if (isAdmin) {
      apiService.getNewRegistrations().then(res => {
        if (res.data.count > 0) {
          setNewRegistrations(res.data.nuovi_utenti);
          setShowNewUsersAlert(true);
        }
      }).catch(() => {});
    }
  }, [isAdmin]);

  // Rotazione frasi divertenti ogni 5 secondi
  useEffect(() => {
    if (isAdmin) return;
    const interval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % FRASI_DIVERTENTI.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const dismissNotification = (id: string) => {
    setDismissedNotifications(prev => [...prev, id]);
  };

  const handleDismissNewUsers = async () => {
    setShowNewUsersAlert(false);
    try {
      await apiService.markRegistrationsSeen();
    } catch {}
  };

  const visibleNotifications = notifications.filter(n => !dismissedNotifications.includes(n.id));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Animated.Image 
            source={require('../../assets/images/logo.jpg')} 
            style={[styles.loadingLogo, { transform: [{ rotate: spinInterpolate }] }]}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    );
  }

  // ==================== ADMIN HOME ====================
  if (isAdmin && dashboard) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header Admin */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Ciao Admin,</Text>
              <Text style={styles.userName}>{user?.nome}</Text>
            </View>
            <Image source={require('../../assets/images/logo.jpg')} style={styles.logoImage} resizeMode="contain" />
          </View>

          {/* AVVISI LEZIONI ANNULLATE (dinamico) */}
          {cancelledLessons.filter((c: any) => {
            const now = new Date();
            const today = now.toLocaleDateString('sv-SE', {timeZone: 'Europe/Rome'});
            const romeHour = parseInt(now.toLocaleString('en-US', {timeZone: 'Europe/Rome', hour: 'numeric', hour12: false}));
            const romeMin = parseInt(now.toLocaleString('en-US', {timeZone: 'Europe/Rome', minute: 'numeric'}));
            const nowMinutes = romeHour * 60 + romeMin;
            const [h, m] = (c.orario || '00:00').split(':').map(Number);
            const lessonMinutes = h * 60 + m;
            // Mostra se: data futura, oppure oggi ma lezione non ancora passata
            if (c.data_lezione > today) return true;
            if (c.data_lezione === today && lessonMinutes > nowMinutes) return true;
            return false;
          }).map((c: any, idx: number) => (
            <View key={idx} style={{ backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 2, borderColor: '#EF4444', overflow: 'hidden' }}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#EF4444' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EF444430', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="close-circle" size={28} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#EF4444', letterSpacing: 0.5 }}>LEZIONE ANNULLATA</Text>
                  <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600', marginTop: 2 }}>Ore {c.orario} — {c.tipo_attivita || 'Lezione'} ({new Date(c.data_lezione + 'T00:00').toLocaleDateString('it-IT', {weekday: 'long', day: 'numeric', month: 'long'})})</Text>
                </View>
              </View>
              <Text style={{ fontSize: 15, color: '#fff', lineHeight: 22, marginBottom: 10 }}>{c.motivo}</Text>
              <View style={{ backgroundColor: '#ffffff10', borderRadius: 10, padding: 10 }}>
                <Text style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
                  Ci scusiamo per il disagio! Le prenotazioni non verranno scalate dal vostro abbonamento.
                </Text>
              </View>
            </View>
          ))}

          {/* Stats Cards - Tactical KPI grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardPrimary]}>
              <Ionicons name="people" size={22} color={COLORS.primary} />
              <CountUp to={dashboard.stats.total_users} style={styles.statNumberKinetic} />
              <Text style={styles.statLabelKinetic} numberOfLines={1}>CLIENTI</Text>
            </View>
            <View style={[styles.statCard, styles.statCardSuccess]}>
              <Ionicons name="card" size={22} color={COLORS.success} />
              <CountUp to={dashboard.stats.active_subscriptions} style={styles.statNumberKinetic} />
              <Text style={styles.statLabelKinetic} numberOfLines={1}>ABB. ATTIVI</Text>
            </View>
            <View style={[styles.statCard, styles.statCardAccent]}>
              <Ionicons name="calendar" size={22} color={COLORS.accent} />
              <CountUp to={dashboard.stats.bookings_today} style={styles.statNumberKinetic} />
              <Text style={styles.statLabelKinetic} numberOfLines={1}>OGGI</Text>
            </View>
          </View>

          {/* Lezioni Settimanali */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Lezioni settimanali {weeklyStats.settimana ? `(${weeklyStats.settimana})` : ''}
            </Text>
            <View style={styles.weeklySummary}>
              <View style={styles.weeklySummaryItem}>
                <Text style={styles.weeklySummaryNumber}>{weeklyStats.presenze}</Text>
                <Text style={styles.weeklySummaryLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>Presenze</Text>
              </View>
              <View style={styles.weeklySummaryDivider} />
              <View style={styles.weeklySummaryItem}>
                <Text style={styles.weeklySummaryNumber}>{weeklyStats.lezioni_scalate}</Text>
                <Text style={styles.weeklySummaryLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>Lezioni Scalate</Text>
              </View>
            </View>
          </View>

          {/* Abbonamenti Scaduti */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Abbonamenti Scaduti</Text>
            {expiredSubs.length > 0 ? (
              expiredSubs.map((sub, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.expiredCard}
                  onPress={() => { setSelectedUser(sub); setShowModal(true); }}
                >
                  <View style={styles.expiredInfo}>
                    <Ionicons name="alert-circle" size={20} color={COLORS.error} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expiredName}>
                        {sub.user_nome || 'Cliente'} {sub.user_cognome || ''}
                      </Text>
                      <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                        {ABBONAMENTO_INFO[sub.tipo]?.nome || sub.tipo}
                        {' · Scaduto: '}
                        {new Date(sub.data_scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noData}>Nessun abbonamento scaduto</Text>
            )}
          </View>

          {/* Modal Assegna Abbonamento */}
          <Modal
            visible={showModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Nuovo Abbonamento</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedUser?.user_nome} {selectedUser?.user_cognome}
                </Text>

                {/* Toggle Pagato / Da Saldare */}
                <View style={styles.paymentToggle}>
                  <TouchableOpacity
                    style={[styles.paymentBtn, renewPagato && styles.paymentBtnPaid]}
                    onPress={() => setRenewPagato(true)}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={renewPagato ? '#fff' : COLORS.success} />
                    <Text style={[styles.paymentBtnText, renewPagato && styles.paymentBtnTextActive]}>Pagato</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paymentBtn, !renewPagato && styles.paymentBtnUnpaid]}
                    onPress={() => setRenewPagato(false)}
                  >
                    <Ionicons name="alert-circle" size={18} color={!renewPagato ? '#fff' : '#f59e0b'} />
                    <Text style={[styles.paymentBtnText, !renewPagato && styles.paymentBtnTextActive]}>Da Saldare</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalOptions}>
                  <TouchableOpacity 
                    style={styles.modalOption}
                    onPress={() => assignSubscription('lezione_singola')}
                  >
                    <Text style={styles.modalOptionText}>Lezione Singola</Text>
                    <Text style={styles.modalOptionPrice}>10 €</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.modalOption}
                    onPress={() => assignSubscription('lezioni_8')}
                  >
                    <Text style={styles.modalOptionText}>8 Lezioni</Text>
                    <Text style={styles.modalOptionPrice}>55 €</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.modalOption}
                    onPress={() => assignSubscription('lezioni_16')}
                  >
                    <Text style={styles.modalOptionText}>16 Lezioni</Text>
                    <Text style={styles.modalOptionPrice}>95 €</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.modalOption}
                    onPress={() => assignSubscription('mensile')}
                  >
                    <Text style={styles.modalOptionText}>Mensile</Text>
                    <Text style={styles.modalOptionPrice}>65 €</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.modalOption}
                    onPress={() => assignSubscription('trimestrale')}
                  >
                    <Text style={styles.modalOptionText}>Trimestrale</Text>
                    <Text style={styles.modalOptionPrice}>175 €</Text>
                  </TouchableOpacity>
                </View>

                {/* Separatore */}
                <View style={styles.modalDivider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>oppure</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Opzione Archivia Cliente */}
                <TouchableOpacity 
                  style={styles.archiveOption}
                  onPress={archiveClient}
                >
                  <View style={styles.archiveOptionContent}>
                    <Ionicons name="archive-outline" size={22} color="#6366f1" />
                    <View style={styles.archiveOptionText}>
                      <Text style={styles.archiveOptionTitle}>Archivia Cliente</Text>
                      <Text style={styles.archiveOptionDesc}>Sposta in "Clienti Archiviati"</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#6366f1" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalCancel}
                  onPress={() => { setShowModal(false); setRenewPagato(true); }}
                >
                  <Text style={styles.modalCancelText}>Annulla</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>

        {/* Modal Alert Nuovi Iscritti - Admin */}
        <Modal visible={showNewUsersAlert} transparent animationType="fade" onRequestClose={handleDismissNewUsers}>
          <View style={styles.newUserOverlay}>
            <View style={styles.newUserModal}>
              <TouchableOpacity style={styles.newUserDismissBtn} onPress={handleDismissNewUsers} data-testid="dismiss-new-users">
                <Text style={styles.newUserDismissText}>OK, VISTO!</Text>
              </TouchableOpacity>
              <View style={styles.newUserHeader}>
                <Ionicons name="person-add" size={28} color="#4CAF50" />
                <Text style={styles.newUserTitle}>
                  {newRegistrations.length === 1 ? 'NUOVO ISCRITTO!' : `${newRegistrations.length} NUOVI ISCRITTI!`}
                </Text>
              </View>
              <ScrollView style={styles.newUserList} showsVerticalScrollIndicator={true}>
                {newRegistrations.map((u, i) => (
                  <View key={i} style={styles.newUserItem}>
                    <Ionicons name="person-circle" size={20} color={COLORS.primary} />
                    <Text style={styles.newUserName}>{u.nome} {u.cognome}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modal Alert Nuovi Ordini Shop - Admin */}
        <Modal
          visible={showShopOrdersAlert}
          transparent
          animationType="fade"
          onRequestClose={async () => {
            setShowShopOrdersAlert(false);
            try { await apiService.adminMarkOrdersNotified(); } catch {}
          }}
        >
          <View style={styles.newUserOverlay}>
            <View style={[styles.newUserModal, { borderTopColor: COLORS.primary }]}>
              <TouchableOpacity
                style={[styles.newUserDismissBtn, { backgroundColor: COLORS.primary }]}
                onPress={async () => {
                  setShowShopOrdersAlert(false);
                  try { await apiService.adminMarkOrdersNotified(); } catch {}
                }}
                data-testid="dismiss-new-shop-orders"
              >
                <Text style={styles.newUserDismissText}>OK, GESTIRÒ TUTTO!</Text>
              </TouchableOpacity>
              <View style={styles.newUserHeader}>
                <Ionicons name="bag-handle" size={28} color={COLORS.primary} />
                <Text style={styles.newUserTitle}>
                  {newShopOrders.length === 1 ? 'NUOVO ORDINE!' : `${newShopOrders.length} NUOVI ORDINI!`}
                </Text>
              </View>
              <ScrollView style={styles.newUserList} showsVerticalScrollIndicator={true}>
                {newShopOrders.map((o) => (
                  <View key={o.id} style={[styles.newUserItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="cart" size={18} color={COLORS.primary} />
                      <Text style={[styles.newUserName, { fontWeight: 'bold' }]}>{o.product_nome}</Text>
                    </View>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 26 }}>
                      👤 {o.user_nome} {o.user_cognome}
                      {o.taglia ? ` · Taglia ${o.taglia}` : ''}
                      {o.colore ? ` · ${o.colore}` : ''}
                    </Text>
                    <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: 'bold', marginLeft: 26, marginTop: 2 }}>
                      € {o.totale?.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                Vai nel tab Shop per gestirli 🛍️
              </Text>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ==================== CLIENT HOME ====================
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* HERO - Functional training image + greeting */}
        <View style={styles.heroCard}>
          <Image source={{ uri: FITNESS_IMAGES.hero }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroKicker}>TRAIN HARD • STAY STRONG</Text>
            <Text style={styles.heroGreeting}>CIAO, {user?.nome?.toUpperCase()}</Text>
            <View style={styles.heroAccentBar} />
            <Text style={styles.heroQuote}>"No excuses. Just results."</Text>
          </View>
        </View>

        {/* AVVISI LEZIONI ANNULLATE (dinamico) */}
        {cancelledLessons.filter((c: any) => {
          const now = new Date();
          const today = now.toLocaleDateString('sv-SE', {timeZone: 'Europe/Rome'});
          const romeHour = parseInt(now.toLocaleString('en-US', {timeZone: 'Europe/Rome', hour: 'numeric', hour12: false}));
          const romeMin = parseInt(now.toLocaleString('en-US', {timeZone: 'Europe/Rome', minute: 'numeric'}));
          const nowMinutes = romeHour * 60 + romeMin;
          const [h, m] = (c.orario || '00:00').split(':').map(Number);
          const lessonMinutes = h * 60 + m;
          if (c.data_lezione > today) return true;
          if (c.data_lezione === today && lessonMinutes > nowMinutes) return true;
          return false;
        }).map((c: any, idx: number) => (
          <View key={idx} style={{ backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 2, borderColor: '#EF4444', overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#EF4444' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EF444430', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close-circle" size={28} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#EF4444', letterSpacing: 0.5 }}>LEZIONE ANNULLATA</Text>
                <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600', marginTop: 2 }}>Ore {c.orario} — {c.tipo_attivita || 'Lezione'} ({new Date(c.data_lezione + 'T00:00').toLocaleDateString('it-IT', {weekday: 'long', day: 'numeric', month: 'long'})})</Text>
              </View>
            </View>
            <Text style={{ fontSize: 15, color: '#fff', lineHeight: 22, marginBottom: 10 }}>{c.motivo}</Text>
            <View style={{ backgroundColor: '#ffffff10', borderRadius: 10, padding: 10 }}>
              <Text style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
                Ci scusiamo per il disagio! Le prenotazioni non verranno scalate dal vostro abbonamento.
              </Text>
            </View>
          </View>
        ))}

        {/* BANNER PIANO ALIMENTARE - Sempre visibile fino a completamento */}
        {!isAdmin && !hasMealPlan && (
          <TouchableOpacity 
            style={styles.mealPlanBanner}
            onPress={() => router.push('/(tabs)/alimentazione')}
            data-testid="nutrition-banner"
          >
            <View style={styles.mealPlanBannerIcon}>
              <Ionicons name="nutrition" size={28} color="#fff" />
            </View>
            <View style={styles.mealPlanBannerContent}>
              <Text style={styles.mealPlanBannerTitle}>Crea il Tuo Piano Alimentare!</Text>
              <Text style={styles.mealPlanBannerText}>
                Piano personalizzato generato con IA, gratis per te
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FF6B6B" />
          </TouchableOpacity>
        )}

        {/* BANDA KPI - Streak + Biglietti + Abbonamento */}
        {!isAdmin && <KPIBanner />}

        {/* BANNER STREAK SETTIMANALE - Bonus biglietti lotteria per allenamenti consecutivi */}
        {!isAdmin && <StreakBanner />}

        {/* NOTIFICHE IN-APP */}
        {visibleNotifications.length > 0 && (
          <View style={styles.notificationsContainer}>
            {visibleNotifications.map((notif) => (
              <View 
                key={notif.id} 
                style={[styles.notificationBanner, { borderLeftColor: notif.color }]}
              >
                <Ionicons name={notif.icon as any} size={22} color={notif.color} />
                <Text style={styles.notificationText}>{notif.message}</Text>
                <TouchableOpacity 
                  onPress={() => dismissNotification(notif.id)}
                  style={styles.notificationClose}
                >
                  <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Frase Divertente */}
        <View style={styles.quoteContainer}>
          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>
              {FRASI_DIVERTENTI[currentQuote]}
            </Text>
          </View>
          <View style={styles.quoteDecorBottom}>
            <View style={styles.quoteDots}>
              {[0, 1, 2].map((i) => (
                <View 
                  key={i} 
                  style={[
                    styles.quoteDot,
                    (currentQuote % 3) === i && styles.quoteDotActive
                  ]} 
                />
              ))}
            </View>
          </View>
        </View>

        {/* Ricetta del Giorno */}
        {(() => {
          const ricetta = getRicettaDelGiorno();
          return (
            <View style={styles.benessereSection}>
              <View style={styles.benessereTitleRow}>
                <Text style={styles.benessereTitleEmoji}>🥗</Text>
                <Text style={styles.benessereTitle}>Ricetta del Giorno</Text>
              </View>
              
              <View style={styles.ricettaCard}>
                <View style={styles.ricettaHeader}>
                  <Text style={styles.ricettaEmoji}>{ricetta.emoji}</Text>
                  <View style={styles.ricettaTitleContainer}>
                    <Text style={styles.ricettaTitolo}>{ricetta.titolo}</Text>
                    <View style={styles.ricettaCalorieBadge}>
                      <Text style={styles.ricettaCalorie}>{ricetta.calorie}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.ricettaDivider} />
                
                <Text style={styles.ricettaSectionLabel}>📝 Ingredienti</Text>
                <Text style={styles.ricettaIngredienti}>{ricetta.ingredienti}</Text>
                
                <Text style={styles.ricettaSectionLabel}>👨‍🍳 Preparazione</Text>
                <Text style={styles.ricettaPreparazione}>{ricetta.preparazione}</Text>
                
                <View style={styles.ricettaTipBox}>
                  <Ionicons name="bulb-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.ricettaTip}>{ricetta.tip}</Text>
                </View>
              </View>
            </View>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingLogo: { width: 120, height: 120, borderRadius: 60 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  
  // Notifiche In-App
  notificationsContainer: {
    marginBottom: 16,
    gap: 10,
  },
  notificationBanner: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  notificationClose: {
    padding: 4,
  },
  
  // Star Wars Card
  // Hero Card (Functional / CrossFit)
  heroCard: {
    height: 210,
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroImage: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,10,10,0.55)',
  },
  heroContent: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    padding: 22,
    justifyContent: 'flex-end',
  },
  heroKicker: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 3,
    marginBottom: 6,
  },
  heroGreeting: {
    fontFamily: FONTS.headline,
    fontSize: 42,
    color: '#fff',
    letterSpacing: 2,
    lineHeight: 44,
  },
  heroAccentBar: {
    width: 48,
    height: 4,
    backgroundColor: COLORS.primary,
    marginVertical: 10,
    borderRadius: 2,
  },
  heroQuote: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },

  starWarsCard: {
    backgroundColor: '#0a0a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFE81F33',
  },
  starWarsGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    backgroundColor: '#FFE81F',
    opacity: 0.08,
    borderRadius: 75,
  },
  starWarsContent: {
    zIndex: 1,
  },
  starWarsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  starWarsGreeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFE81F',
    textShadowColor: '#FFE81F55',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  starWarsLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFE81F44',
  },
  starWarsQuote: {
    fontSize: 14,
    color: '#b8b8b8',
    fontStyle: 'italic',
    letterSpacing: 1,
    textAlign: 'center',
  },
  starWarsStars: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  star: {
    position: 'absolute',
    width: 3,
    height: 3,
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
    opacity: 0.6,
  },

  // Header (legacy)
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting: { fontSize: 14, color: COLORS.textSecondary },
  userName: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  logoImage: { width: 90, height: 90, borderRadius: 45 },

  // Stats Grid (Admin)
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  statCardPrimary: { borderColor: COLORS.primary, borderLeftWidth: 3 },
  statCardSuccess: { borderColor: COLORS.success, borderLeftWidth: 3 },
  statCardAccent: { borderColor: COLORS.accent, borderLeftWidth: 3 },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginTop: 4 },
  statNumberKinetic: {
    fontFamily: FONTS.headline,
    fontSize: 34,
    color: COLORS.text,
    letterSpacing: 1,
    lineHeight: 36,
  },
  statLabel: { fontSize: 11, color: '#FFF', opacity: 0.95, marginTop: 4, textAlign: 'center', flexShrink: 0 },
  statLabelKinetic: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Weekly Summary
  weeklySummary: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  weeklySummaryItem: { flex: 1, alignItems: 'center' },
  weeklySummaryNumber: { fontSize: 36, fontWeight: 'bold', color: COLORS.primary },
  weeklySummaryLabel: { fontSize: 12, color: COLORS.text, marginTop: 4, fontWeight: '500' },
  weeklySummaryDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 12 },

  // Quote Card (Client)
  quoteContainer: { marginBottom: 20 },
  quoteDecorTop: { alignItems: 'center', marginBottom: -15, zIndex: 1 },
  quoteIcon: { fontSize: 28, backgroundColor: COLORS.background, paddingHorizontal: 8 },
  quoteCard: { 
    backgroundColor: COLORS.card, 
    borderRadius: 16, 
    padding: 20, 
    paddingTop: 24,
    borderWidth: 2, 
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  quoteText: { fontSize: 15, color: COLORS.text, lineHeight: 24, textAlign: 'center', fontStyle: 'italic' },
  quoteDecorBottom: { alignItems: 'center', marginTop: 10 },
  quoteDots: { flexDirection: 'row', gap: 6 },
  quoteDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  quoteDotActive: { backgroundColor: COLORS.primary, width: 20 },

  // Sections
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  seeAll: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },

  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, height: 40, color: COLORS.text, fontSize: 14 },

  // Lezioni (Admin)
  lessonRow: { backgroundColor: COLORS.card, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  lessonColor: { width: 4, height: 36, borderRadius: 2, marginRight: 12 },
  lessonInfo: { flex: 1 },
  lessonTime: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  lessonType: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  participantsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4 },
  participantsNumber: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },

  // Expiring (Admin)
  expiringCard: { backgroundColor: COLORS.card, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderLeftWidth: 3, borderLeftColor: COLORS.error },
  expiringInfo: { flex: 1 },
  expiringName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  expiringType: { fontSize: 12, color: COLORS.textSecondary },
  expiringDate: { alignItems: 'flex-end' },
  expiringDateText: { fontSize: 13, fontWeight: '600', color: COLORS.error },
  expiringLessons: { fontSize: 11, color: COLORS.textSecondary },

  // Expired Subscriptions (Admin)
  expiredCard: { 
    backgroundColor: COLORS.card, 
    borderRadius: 10, 
    padding: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },
  expiredInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  expiredName: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  // Banner Piano Alimentare
  mealPlanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B18',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FF6B6B50',
    gap: 12,
  },
  mealPlanBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealPlanBannerContent: { flex: 1 },
  mealPlanBannerTitle: { fontSize: 15, fontWeight: 'bold', color: '#FF6B6B' },
  mealPlanBannerText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: COLORS.primary, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  paymentToggle: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  paymentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.card },
  paymentBtnPaid: { borderColor: COLORS.success, backgroundColor: COLORS.success },
  paymentBtnUnpaid: { borderColor: '#f59e0b', backgroundColor: '#f59e0b' },
  paymentBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  paymentBtnTextActive: { color: '#fff' },
  modalOptions: { gap: 10 },
  modalOption: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalOptionText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  modalOptionPrice: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
  modalCancel: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, color: COLORS.textSecondary },

  // Modal Divider e Archivia
  modalDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  archiveOption: {
    backgroundColor: '#6366f110',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#6366f130',
  },
  archiveOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  archiveOptionText: {
    gap: 2,
  },
  archiveOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  archiveOptionDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  // Recent Users (Admin)
  userRow: { backgroundColor: COLORS.card, borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 10 },
  userInfo: { flex: 1 },
  userNameText: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  userDate: { fontSize: 12, color: COLORS.textSecondary },

  // Bookings (Client)
  bookingCardWrapper: { marginBottom: 8 },
  bookingCard: { backgroundColor: COLORS.card, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center' },
  bookingColor: { width: 4, height: 36, borderRadius: 2, marginRight: 12 },
  bookingInfo: { flex: 1 },
  bookingDate: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  bookingActivity: { fontSize: 13, color: COLORS.primary, marginTop: 2 },
  bookingClassButton: { padding: 8 },
  participantsDropdown: { backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 12, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  participantsCount: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  participantName: { fontSize: 13, color: COLORS.text, marginBottom: 4 },
  noParticipantsText: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' },
  emptyBookings: { alignItems: 'center', paddingVertical: 30, backgroundColor: COLORS.card, borderRadius: 12 },
  bookNowButton: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 12 },
  bookNowText: { color: '#FFF', fontWeight: '600' },

  noData: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 16 },

  // Actions
  actionsGrid: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 16, alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13, fontWeight: '500', color: COLORS.text },

  // Benessere Section
  benessereSection: {
    marginTop: 8,
  },
  benessereTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  benessereTitleEmoji: {
    fontSize: 24,
  },
  benessereTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },

  // Ricetta Card
  ricettaCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  ricettaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  ricettaEmoji: {
    fontSize: 40,
  },
  ricettaTitleContainer: {
    flex: 1,
  },
  ricettaTitolo: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 6,
  },
  ricettaCalorieBadge: {
    backgroundColor: '#4CAF5020',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  ricettaCalorie: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  ricettaDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  ricettaSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 6,
    marginTop: 8,
  },
  ricettaIngredienti: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  ricettaPreparazione: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  ricettaTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
    gap: 8,
  },
  ricettaTip: {
    fontSize: 12,
    color: COLORS.primary,
    flex: 1,
    fontWeight: '500',
  },
  // New User Alert Modal
  newUserOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  newUserModal: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    borderWidth: 2,
    borderColor: '#4CAF5040',
  },
  newUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  newUserTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    flex: 1,
  },
  newUserList: {
    gap: 10,
    marginBottom: 10,
    flexGrow: 0,
  },
  newUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  newUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  newUserDismissBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  newUserDismissText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 1,
  },
});
