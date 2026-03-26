import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Animated,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Easing,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';
import { Audio } from 'expo-av';

// Colori Las Vegas
const VEGAS_COLORS = {
  background: '#1a0a0a',
  card: '#2d1515',
  gold: '#FFD700',
  red: '#dc2626',
  darkRed: '#7f1d1d',
  neonPink: '#ff1493',
  neonBlue: '#00bfff',
  text: '#ffffff',
  textSecondary: '#d4a574',
};

// Premi della ruota
const WHEEL_PRIZES = [
  { id: 0, testo: "Ritenta!", emoji: "💨", color: "#666", biglietti: 0, tipo: "comune" },
  { id: 1, testo: "+1 Biglietto!", emoji: "🎟️", color: "#22c55e", biglietti: 1, tipo: "comune" },
  { id: 2, testo: "10 Flessioni!", emoji: "💪", color: "#f97316", biglietti: 0, tipo: "comune" },
  { id: 3, testo: "+2 Biglietti!", emoji: "🎟️", color: "#22c55e", biglietti: 2, tipo: "media" },
  { id: 4, testo: "JACKPOT +5!", emoji: "🌟", color: "#FFD700", biglietti: 5, tipo: "raro" },
  { id: 5, testo: "BESTIA!", emoji: "😂", color: "#ec4899", biglietti: 0, tipo: "comune" },
  { id: 6, testo: "-1 Biglietto!", emoji: "💀", color: "#dc2626", biglietti: -1, tipo: "comune" },
  { id: 7, testo: "Il Maestro ti ruba 3!", emoji: "😈", color: "#7f1d1d", biglietti: -3, tipo: "rarissimo" },
];

interface WheelStatus {
  can_spin: boolean;
  reason?: string;
  message: string;
  last_result?: string;
}

interface Vincitore {
  posizione: number;
  nome: string;
  cognome: string;
  soprannome?: string;
  biglietti: number;
  premio?: string;
  is_me: boolean;
}

interface LotteryStatus {
  biglietti_utente: number;
  mese_corrente: string;
  ha_abbonamento_attivo: boolean;
  vincitori: Vincitore[];
  mese_riferimento?: string;
  totale_partecipanti: number;
  totale_biglietti?: number;
  data_estrazione?: string;
  premio_1?: string;
  premio_2?: string;
  premio_3?: string;
  is_me_winner: boolean;
  prossima_estrazione: string;
  secondi_a_estrazione: number;
  estrazione_fatta: boolean;
}

interface Winner {
  mese: string;
  mese_riferimento: string;
  vincitori: {
    posizione: number;
    nome: string;
    cognome: string;
    soprannome?: string;
    biglietti: number;
    premio?: string;
  }[];
  totale_partecipanti: number;
  data_estrazione?: string;
}

interface Prize {
  premio_1: string | null;
  premio_2: string | null;
  premio_3: string | null;
  mese: string;
}

export default function PremiScreen() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<LotteryStatus | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [prize, setPrize] = useState<Prize | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showRules, setShowRules] = useState(false);
  const [showSetPrize, setShowSetPrize] = useState(false);
  const [newPrize1, setNewPrize1] = useState('');
  const [newPrize2, setNewPrize2] = useState('');
  const [newPrize3, setNewPrize3] = useState('');
  const [savingPrize, setSavingPrize] = useState(false);

  // Ruota della Fortuna
  const [wheelStatus, setWheelStatus] = useState<WheelStatus | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState<any>(null);
  const [showWheelResult, setShowWheelResult] = useState(false);
  const wheelRotation = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0)).current;

  // Animazioni
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const ticketBounce = useRef(new Animated.Value(0)).current;

  // Suoni ruota
  const spinSound = useRef<Audio.Sound | null>(null);
  const winSound = useRef<Audio.Sound | null>(null);
  const loseSound = useRef<Audio.Sound | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Quiz con Categorie
  const [quiz, setQuiz] = useState<{
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
  } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectingCategory, setSelectingCategory] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    corretta: boolean;
    risposta_corretta_index: number;
    biglietti_vinti: number;
    bonus_type: string;
    wheel_result: number;
    message: string;
  } | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizTimer, setQuizTimer] = useState(10);
  const [quizTimerActive, setQuizTimerActive] = useState(false);
  const [quizTimerExpired, setQuizTimerExpired] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);

  // Carica suoni
  useEffect(() => {
    const loadSounds = async () => {
      try {
        // Configura audio
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        // Suono spin (tick tick) - usiamo un suono web gratuito
        const { sound: spin } = await Audio.Sound.createAsync(
          { uri: 'https://www.soundjay.com/misc/sounds/slot-machine-wheel-spin-1.mp3' },
          { shouldPlay: false, isLooping: true }
        );
        spinSound.current = spin;

        // Suono vittoria
        const { sound: win } = await Audio.Sound.createAsync(
          { uri: 'https://www.soundjay.com/misc/sounds/slot-machine-win-1.mp3' },
          { shouldPlay: false }
        );
        winSound.current = win;

        // Suono perdita/neutro
        const { sound: lose } = await Audio.Sound.createAsync(
          { uri: 'https://www.soundjay.com/button/sounds/button-10.mp3' },
          { shouldPlay: false }
        );
        loseSound.current = lose;
      } catch (error) {
        console.log('Errore caricamento suoni:', error);
      }
    };

    loadSounds();

    // Cleanup
    return () => {
      spinSound.current?.unloadAsync();
      winSound.current?.unloadAsync();
      loseSound.current?.unloadAsync();
    };
  }, []);

  // Funzioni per suoni
  const playSpinSound = async () => {
    if (!soundEnabled || !spinSound.current) return;
    try {
      await spinSound.current.setPositionAsync(0);
      await spinSound.current.playAsync();
    } catch (e) {
      console.log('Errore play spin:', e);
    }
  };

  const stopSpinSound = async () => {
    if (!spinSound.current) return;
    try {
      await spinSound.current.stopAsync();
    } catch (e) {
      console.log('Errore stop spin:', e);
    }
  };

  const playResultSound = async (isWin: boolean) => {
    if (!soundEnabled) return;
    try {
      const sound = isWin ? winSound.current : loseSound.current;
      if (sound) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      }
    } catch (e) {
      console.log('Errore play result:', e);
    }
  };

  useEffect(() => {
    // Pulse animation per il jackpot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (status?.biglietti_utente && status.biglietti_utente > 0) {
      Animated.sequence([
        Animated.timing(ticketBounce, { toValue: -10, duration: 200, useNativeDriver: true }),
        Animated.timing(ticketBounce, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [status?.biglietti_utente]);

  const loadData = async () => {
    try {
      const [statusRes, winnersRes, prizeRes] = await Promise.all([
        apiService.getLotteryStatus(),
        apiService.getLotteryWinners(),
        apiService.getCurrentPrize()
      ]);
      setStatus(statusRes.data);
      setWinners(winnersRes.data);
      setPrize(prizeRes.data);
      
      // Carica stato ruota (solo per clienti)
      if (!isAdmin) {
        try {
          const wheelRes = await apiService.getWheelStatus();
          setWheelStatus(wheelRes.data);
        } catch (e) {
          console.log('Wheel status not available');
        }
        
        // Carica quiz del giorno
        try {
          const quizRes = await apiService.getQuizToday();
          setQuiz(quizRes.data);
          if (quizRes.data.gia_risposto && quizRes.data.risposta_data !== null) {
            setSelectedAnswer(quizRes.data.risposta_data);
          }
        } catch (e) {
          console.log('Quiz not available');
        }
      }
    } catch (error) {
      console.error('Error loading lottery data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Countdown timer
  useEffect(() => {
    if (!status?.prossima_estrazione) return;

    const updateCountdown = () => {
      const now = new Date();
      const extraction = new Date(status.prossima_estrazione);
      const diff = Math.max(0, Math.floor((extraction.getTime() - now.getTime()) / 1000));

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setCountdown({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [status?.prossima_estrazione]);

  // Quiz countdown timer (15 secondi) - parte SOLO quando il cliente clicca "Inizia"
  useEffect(() => {
    if (!quizStarted || !quiz || !quiz.can_play || quiz.gia_risposto) {
      return;
    }
    if (quizTimerExpired) return;
    
    setQuizTimer(15);
    setQuizTimerActive(true);

    const interval = setInterval(() => {
      setQuizTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setQuizTimerActive(false);
          setQuizTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [quizStarted]);

  const startQuiz = () => {
    setQuizStarted(true);
    setQuizTimerExpired(false);
    setQuizTimer(15);
    setSelectedAnswer(null);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Funzione per girare la ruota con animazione suspense
  const spinWheel = async () => {
    if (isSpinning || !wheelStatus?.can_spin) return;
    
    setIsSpinning(true);
    setShowWheelResult(false);
    wheelRotation.setValue(0);
    
    // Avvia suono spin
    playSpinSound();
    
    try {
      // Chiamata API per ottenere il risultato
      const response = await apiService.spinWheel();
      const result = response.data;
      
      // Calcola rotazione finale (premio_id * 45° + giri extra per suspense)
      const prizeAngle = result.premio_id * 45;
      const extraSpins = 5 + Math.random() * 3; // 5-8 giri completi
      const finalRotation = (extraSpins * 360) + (360 - prizeAngle);
      
      // Animazione con suspense (rallenta alla fine)
      Animated.timing(wheelRotation, {
        toValue: finalRotation,
        duration: 5000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(async () => {
        // Ferma suono spin
        await stopSpinSound();
        
        // Suono risultato
        const isWin = result.premio.biglietti > 0;
        playResultSound(isWin);
        
        // Mostra risultato con animazione
        setWheelResult(result.premio);
        setShowWheelResult(true);
        
        // Animazione popup risultato
        resultScale.setValue(0);
        Animated.spring(resultScale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }).start();
        
        // Aggiorna stato
        setWheelStatus({ ...wheelStatus, can_spin: false, message: "Hai già girato! Torna dopo il prossimo allenamento!" });
        loadData(); // Ricarica per aggiornare biglietti
      });
      
    } catch (error: any) {
      await stopSpinSound();
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile girare la ruota');
      setIsSpinning(false);
    }
  };

  const closeWheelResult = () => {
    setShowWheelResult(false);
    setIsSpinning(false);
  };

  const formatMese = (meseStr: string) => {
    if (!meseStr) return '';
    const [year, month] = meseStr.split('-');
    const mesi = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    return `${mesi[parseInt(month)]} ${year}`;
  };

  const handleSavePrize = async () => {
    if (!newPrize1.trim() || !newPrize2.trim() || !newPrize3.trim()) {
      Alert.alert('Errore', 'Inserisci tutti e 3 i premi');
      return;
    }
    setSavingPrize(true);
    try {
      await apiService.setMonthlyPrize(newPrize1, newPrize2, newPrize3);
      Alert.alert('Successo', 'Premi impostati!');
      setShowSetPrize(false);
      setNewPrize1('');
      setNewPrize2('');
      setNewPrize3('');
      loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore');
    } finally {
      setSavingPrize(false);
    }
  };

  // Quiz Fitness - invia risposta
  const handleSelectCategory = async (categoria: string) => {
    setSelectingCategory(true);
    try {
      const response = await apiService.selectQuizCategory(categoria);
      setQuiz({
        ...quiz!,
        needs_category: false,
        domanda_id: response.data.domanda_id,
        domanda: response.data.domanda,
        risposte: response.data.risposte,
        categoria: response.data.categoria,
        wheel_result: response.data.wheel_result,
        bonus_type: response.data.bonus_type as any,
        potential_bonus: response.data.potential_bonus,
        message: response.data.message,
      });
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore nella selezione');
    } finally {
      setSelectingCategory(false);
    }
  };

  const handleQuizSubmit = async () => {
    if (selectedAnswer === null || !quiz || quiz.gia_risposto || quizTimerExpired) return;
    
    setQuizTimerActive(false); // Ferma il timer quando si conferma
    setSubmittingQuiz(true);
    try {
      const response = await apiService.submitQuizAnswer(selectedAnswer);
      setQuizResult(response.data);
      
      // Aggiorna lo stato del quiz
      setQuiz({
        ...quiz,
        gia_risposto: true,
        risposta_corretta: response.data.corretta,
        biglietti_vinti: response.data.biglietti_vinti,
        risposta_data: selectedAnswer
      });
      
      // Ricarica dati per aggiornare biglietti
      loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore nel quiz');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={VEGAS_COLORS.gold} />
          <Text style={styles.loadingText}>Caricamento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={VEGAS_COLORS.gold} />}
      >
        {/* Header Las Vegas */}
        <View style={styles.header}>
          <View style={styles.lightsRow}>
            {[...Array(7)].map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.light,
                  { backgroundColor: i % 2 === 0 ? VEGAS_COLORS.gold : VEGAS_COLORS.red },
                  { opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: i % 2 === 0 ? [0.4, 1] : [1, 0.4] }) }
                ]}
              />
            ))}
          </View>
          <Text style={styles.casinoTitle}>DANO FITNESS</Text>
          <Image source={require('../../assets/images/logo.jpg')} style={{ width: 60, height: 60, borderRadius: 30, marginVertical: 6 }} resizeMode="contain" />
          <Text style={styles.jackpotSubtitle}>★ LOTTERIA ★</Text>
          <View style={styles.lightsRow}>
            {[...Array(7)].map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.light,
                  { backgroundColor: i % 2 === 0 ? VEGAS_COLORS.red : VEGAS_COLORS.gold },
                  { opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: i % 2 === 0 ? [1, 0.4] : [0.4, 1] }) }
                ]}
              />
            ))}
          </View>
        </View>

        {/* Premi del Mese - 3 Premi (UNICA SEZIONE) */}
        <Animated.View style={[styles.prizeCard, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.prizeLabel}>🎰 PREMI IN PALIO 🎰</Text>
          {(prize?.premio_1 || prize?.premio_2 || prize?.premio_3) ? (
            <View style={{ width: '100%' }}>
              <View style={styles.prizeRow}>
                <Text style={styles.prizeMedal}>🥇</Text>
                <Text style={styles.prizeName}>{prize?.premio_1 || 'Da annunciare'}</Text>
              </View>
              <View style={styles.prizeRow}>
                <Text style={styles.prizeMedal}>🥈</Text>
                <Text style={styles.prizeName}>{prize?.premio_2 || 'Da annunciare'}</Text>
              </View>
              <View style={styles.prizeRow}>
                <Text style={styles.prizeMedal}>🥉</Text>
                <Text style={styles.prizeName}>{prize?.premio_3 || 'Da annunciare'}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.prizeEmpty}>Premi da annunciare...</Text>
          )}
          {isAdmin && (
            <TouchableOpacity style={styles.setPrizeBtn} onPress={() => setShowSetPrize(true)} data-testid="set-prize-btn">
              <Ionicons name="create" size={16} color={VEGAS_COLORS.gold} />
              <Text style={styles.setPrizeBtnText}>Imposta Premi</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Countdown Estrazione */}
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>⏰ PROSSIMA ESTRAZIONE ⏰</Text>
          <View style={styles.countdownRow}>
            <View style={styles.countdownSlot}>
              <Text style={styles.countdownNumber}>{countdown.days}</Text>
              <Text style={styles.countdownUnit}>GG</Text>
            </View>
            <Text style={styles.countdownColon}>:</Text>
            <View style={styles.countdownSlot}>
              <Text style={styles.countdownNumber}>{countdown.hours.toString().padStart(2, '0')}</Text>
              <Text style={styles.countdownUnit}>ORE</Text>
            </View>
            <Text style={styles.countdownColon}>:</Text>
            <View style={styles.countdownSlot}>
              <Text style={styles.countdownNumber}>{countdown.minutes.toString().padStart(2, '0')}</Text>
              <Text style={styles.countdownUnit}>MIN</Text>
            </View>
            <Text style={styles.countdownColon}>:</Text>
            <View style={styles.countdownSlot}>
              <Text style={styles.countdownNumber}>{countdown.seconds.toString().padStart(2, '0')}</Text>
              <Text style={styles.countdownUnit}>SEC</Text>
            </View>
          </View>
          <Text style={styles.countdownInfo}>1° del mese alle ore 12:00</Text>
        </View>

        {/* Avviso partecipazione - ben visibile */}
        <View style={styles.subscriptionWarningCard}>
          <Ionicons name="shield-checkmark" size={22} color={VEGAS_COLORS.gold} />
          <Text style={styles.subscriptionWarningText}>
            Partecipano all'estrazione SOLO gli utenti con abbonamento attivo!
          </Text>
        </View>

        {/* I Tuoi Biglietti - Solo per clienti, non per admin */}
        {!isAdmin && (
          <Animated.View style={[styles.ticketsCard, { transform: [{ translateY: ticketBounce }] }]}>
            <View style={styles.ticketsHeader}>
              <Text style={styles.ticketsEmoji}>🎟️</Text>
              <Text style={styles.ticketsTitle}>I TUOI BIGLIETTI</Text>
              <Text style={styles.ticketsEmoji}>🎟️</Text>
            </View>
            <Text style={styles.ticketsNumber}>{status?.biglietti_utente || 0}</Text>
            <Text style={styles.ticketsSubtitle}>
              {!status?.biglietti_utente || status.biglietti_utente === 0 
                ? 'Allenati per guadagnare biglietti!' 
                : status.biglietti_utente === 1 
                  ? '1 possibilità di vincere!'
                  : `${status.biglietti_utente} possibilità di vincere!`}
            </Text>
            <View style={styles.ticketsMini}>
              {[...Array(Math.min(status?.biglietti_utente || 0, 10))].map((_, i) => (
                <Text key={i} style={styles.ticketMini}>🎫</Text>
              ))}
              {(status?.biglietti_utente || 0) > 10 && (
                <Text style={styles.ticketMore}>+{(status?.biglietti_utente || 0) - 10}</Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* ===== RUOTA DELLA FORTUNA - STILE ROULETTE ===== */}
        {!isAdmin && (
          <View style={styles.wheelSection}>
            <View style={styles.wheelHeader}>
              <Text style={styles.wheelTitle}>🎰 RUOTA DELLA FORTUNA 🎰</Text>
              <Text style={styles.wheelSubtitle}>
                {wheelStatus?.can_spin 
                  ? "Gira e tenta la fortuna!" 
                  : wheelStatus?.message || "Allenati per sbloccare!"}
              </Text>
              {/* Toggle Suoni */}
              <TouchableOpacity 
                style={styles.soundToggle} 
                onPress={() => setSoundEnabled(!soundEnabled)}
              >
                <Ionicons 
                  name={soundEnabled ? "volume-high" : "volume-mute"} 
                  size={20} 
                  color={soundEnabled ? VEGAS_COLORS.gold : VEGAS_COLORS.textSecondary} 
                />
                <Text style={[styles.soundToggleText, !soundEnabled && styles.soundToggleTextOff]}>
                  {soundEnabled ? "ON" : "OFF"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ruota Roulette con Spicchi */}
            <View style={styles.rouletteContainer}>
              {/* Bordo esterno decorativo */}
              <View style={styles.rouletteOuterRing} />
              
              {/* Ruota principale con spicchi */}
              <Animated.View 
                style={[
                  styles.rouletteWheel,
                  { 
                    transform: [{ 
                      rotate: wheelRotation.interpolate({
                        inputRange: [0, 360],
                        outputRange: ['0deg', '360deg']
                      })
                    }] 
                  }
                ]}
              >
                {/* Spicchi colorati */}
                {WHEEL_PRIZES.map((prize, index) => {
                  const rotation = index * 45;
                  return (
                    <View 
                      key={prize.id} 
                      style={[
                        styles.sliceContainer,
                        { transform: [{ rotate: `${rotation}deg` }] }
                      ]}
                    >
                      {/* Triangolo/Spicchio */}
                      <View style={[styles.slice, { borderBottomColor: prize.color }]}>
                        <Text style={styles.sliceEmoji}>{prize.emoji}</Text>
                      </View>
                    </View>
                  );
                })}
                
                {/* Centro della ruota */}
                <View style={styles.rouletteCenter}>
                  <Text style={styles.rouletteCenterEmoji}>🎰</Text>
                </View>
              </Animated.View>
              
              {/* Freccia indicatore */}
              <View style={styles.roulettePointer}>
                <View style={styles.pointerTriangle} />
              </View>
            </View>

            {/* Pulsante Gira */}
            <TouchableOpacity
              style={[
                styles.spinButton,
                (!wheelStatus?.can_spin || isSpinning) && styles.spinButtonDisabled
              ]}
              onPress={spinWheel}
              disabled={!wheelStatus?.can_spin || isSpinning}
            >
              {isSpinning ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Text style={styles.spinButtonEmoji}>🎲</Text>
                  <Text style={styles.spinButtonText}>
                    {wheelStatus?.can_spin ? "GIRA LA RUOTA!" : "TORNA DOPO L'ALLENAMENTO"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* ELENCO PREMI POSSIBILI */}
            <View style={styles.prizesListContainer}>
              <Text style={styles.prizesListTitle}>🎁 PREMI POSSIBILI 🎁</Text>
              <View style={styles.prizesList}>
                {WHEEL_PRIZES.map((p) => (
                  <View 
                    key={p.id} 
                    style={[
                      styles.prizeListItem,
                      p.tipo === 'raro' && styles.prizeListItemRaro,
                      p.tipo === 'rarissimo' && styles.prizeListItemRarissimo,
                    ]}
                  >
                    <View style={[styles.prizeColorDot, { backgroundColor: p.color }]} />
                    <Text style={styles.prizeListEmoji}>{p.emoji}</Text>
                    <View style={styles.prizeListInfo}>
                      <Text style={styles.prizeListText}>{p.testo}</Text>
                      {p.tipo === 'raro' && <Text style={styles.prizeListRarity}>⭐ RARO</Text>}
                      {p.tipo === 'rarissimo' && <Text style={styles.prizeListRarityRarissimo}>💎 RARISSIMO</Text>}
                    </View>
                    <Text style={[
                      styles.prizeListBiglietti,
                      { color: p.biglietti > 0 ? '#22c55e' : p.biglietti < 0 ? '#dc2626' : '#888' }
                    ]}>
                      {p.biglietti > 0 ? `+${p.biglietti}` : p.biglietti < 0 ? p.biglietti : '-'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Modal Risultato Ruota */}
        <Modal
          visible={showWheelResult}
          transparent
          animationType="fade"
          onRequestClose={closeWheelResult}
        >
          <View style={styles.wheelResultOverlay}>
            <Animated.View style={[styles.wheelResultCard, { transform: [{ scale: resultScale }] }]}>
              <Text style={styles.wheelResultEmoji}>{wheelResult?.emoji}</Text>
              <Text style={styles.wheelResultTitle}>
                {wheelResult?.biglietti > 0 ? "HAI VINTO! 🎉" : 
                 wheelResult?.biglietti < 0 ? "OOPS! 😅" : "ECCO IL RISULTATO!"}
              </Text>
              <Text style={styles.wheelResultText}>{wheelResult?.testo}</Text>
              {wheelResult?.biglietti !== 0 && (
                <Text style={[
                  styles.wheelResultBiglietti,
                  { color: wheelResult?.biglietti > 0 ? '#22c55e' : '#dc2626' }
                ]}>
                  {wheelResult?.biglietti > 0 ? '+' : ''}{wheelResult?.biglietti} bigliett{wheelResult?.biglietti === 1 || wheelResult?.biglietti === -1 ? 'o' : 'i'}
                </Text>
              )}
              <TouchableOpacity style={styles.wheelResultButton} onPress={closeWheelResult}>
                <Text style={styles.wheelResultButtonText}>CHIUDI</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>

        {/* ===== QUIZ BONUS - Collegato alla Ruota! ===== */}
        {!isAdmin && quiz && (
          <View style={styles.quizSection}>
            <View style={styles.quizHeader}>
              <Text style={styles.quizIcon}>🧠</Text>
              <Text style={styles.quizTitle}>QUIZ BONUS</Text>
              <Text style={styles.quizIcon}>🎯</Text>
            </View>
            
            {/* Badge categoria selezionata */}
            {quiz.categoria && !quiz.needs_category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {quiz.categoria === 'gossip' ? '💅 GOSSIP' :
                   quiz.categoria === 'cultura' ? '📚 CULTURA GENERALE' :
                   quiz.categoria === 'cinema' ? '🎬 CINEMA & SERIE TV' :
                   quiz.categoria === 'musica' ? '🎵 MUSICA' : ''}
                </Text>
              </View>
            )}
            
            {/* Badge tipo bonus */}
            {quiz.bonus_type && quiz.can_play && (
              <View style={[
                styles.quizBonusBadge,
                quiz.bonus_type === 'raddoppia' && styles.quizBonusBadgeGold,
                quiz.bonus_type === 'annulla' && styles.quizBonusBadgeRed,
                quiz.bonus_type === 'standard' && styles.quizBonusBadgeGreen,
              ]}>
                <Text style={styles.quizBonusBadgeText}>
                  {quiz.bonus_type === 'raddoppia' && `🎰 Hai vinto +${quiz.wheel_result}! Rispondi per RADDOPPIARE!`}
                  {quiz.bonus_type === 'annulla' && `😱 Hai perso ${Math.abs(quiz.wheel_result)}... Rispondi per ANNULLARE!`}
                  {quiz.bonus_type === 'standard' && '🎰 Vinci 0 alla ruota → Rispondi per +1 biglietto!'}
                </Text>
              </View>
            )}
            
            <Text style={styles.quizSubtitle}>
              {quiz.can_play 
                ? quiz.message
                : quiz.reason === 'no_spin'
                  ? '🎰 Gira prima la ruota per sbloccare!'
                  : quiz.gia_risposto 
                    ? '✅ Hai già risposto oggi!'
                    : quiz.message}
            </Text>
            
            {/* Quiz Bloccato - Non ha girato la ruota */}
            {!quiz.can_play && quiz.reason === 'no_spin' && (
              <View style={styles.quizLockedCard}>
                <Text style={styles.quizLockedIcon}>🎰</Text>
                <Text style={styles.quizLockedTitle}>Prima gira la Ruota!</Text>
                <Text style={styles.quizLockedMessage}>
                  Il Quiz Bonus si sblocca dopo aver girato la ruota della fortuna
                </Text>
                <Text style={styles.quizLockedMotivation}>
                  Il bonus dipende dal risultato della ruota! 🎯
                </Text>
              </View>
            )}

            {/* Scelta Categoria */}
            {quiz.can_play && quiz.needs_category && quiz.categorie && (
              <View style={styles.categorySelectionCard}>
                <Text style={styles.categoryTitle}>SCEGLI L'ARGOMENTO!</Text>
                <Text style={styles.categorySubtitle}>Tocca una categoria per iniziare il quiz</Text>
                <View style={styles.categoryGrid}>
                  {quiz.categorie.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.categoryButton, { borderColor: cat.colore }]}
                      onPress={() => handleSelectCategory(cat.key)}
                      disabled={selectingCategory}
                      data-testid={`category-${cat.key}`}
                    >
                      <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                      <Text style={[styles.categoryName, { color: cat.colore }]}>{cat.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {selectingCategory && <ActivityIndicator color={VEGAS_COLORS.gold} style={{ marginTop: 12 }} />}
              </View>
            )}
            
            {/* Quiz Disponibile o Già Risposto */}
            {((quiz.can_play && !quiz.needs_category) || quiz.gia_risposto) && quiz.domanda && (
              <View style={styles.quizCard}>
                {/* Pulsante INIZIA - mostrato prima del click con REGOLE */}
                {quiz.can_play && !quiz.gia_risposto && !quizStarted && (
                  <View style={styles.quizStartContainer}>
                    <Text style={styles.quizRulesTitle}>REGOLE DEL QUIZ</Text>
                    <View style={styles.quizRulesList}>
                      <Text style={styles.quizRuleItem}>Hai 15 secondi per rispondere</Text>
                      <Text style={styles.quizRuleItem}>La domanda appare dopo aver premuto INIZIA</Text>
                      <Text style={styles.quizRuleItem}>Seleziona la risposta e conferma prima dello scadere</Text>
                      <Text style={styles.quizRuleItem}>Se il tempo scade, perdi il bonus!</Text>
                      {quiz.bonus_type === 'raddoppia' && (
                        <Text style={styles.quizRuleBonus}>Rispondi correttamente per RADDOPPIARE i biglietti vinti alla ruota!</Text>
                      )}
                      {quiz.bonus_type === 'annulla' && (
                        <Text style={styles.quizRuleBonus}>Rispondi correttamente per ANNULLARE la perdita della ruota!</Text>
                      )}
                      {quiz.bonus_type === 'standard' && (
                        <Text style={styles.quizRuleBonus}>Rispondi correttamente per vincere +1 biglietto!</Text>
                      )}
                    </View>
                    <TouchableOpacity style={styles.quizStartButton} onPress={startQuiz}>
                      <Text style={styles.quizStartButtonText}>INIZIA QUIZ</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Domanda + Timer + Risposte - mostrate dopo il click */}
                {(quizStarted || quiz.gia_risposto) && (
                  <>
                <Text style={styles.quizQuestion}>{quiz.domanda}</Text>
                
                {/* Timer countdown - GRANDE e EVIDENTE */}
                {quiz.can_play && !quiz.gia_risposto && quizStarted && (
                  <View style={styles.quizTimerContainer}>
                    <View style={[
                      styles.quizTimerCircle,
                      quizTimer <= 5 && styles.quizTimerCircleDanger,
                    ]}>
                      <Text style={[
                        styles.quizTimerBigNumber,
                        quizTimer <= 5 && styles.quizTimerBigNumberDanger,
                      ]}>
                        {quizTimerExpired ? '0' : quizTimer}
                      </Text>
                    </View>
                    <View style={styles.quizTimerBarBg}>
                      <View style={[
                        styles.quizTimerBarFill,
                        { width: `${(quizTimer / 15) * 100}%` },
                        quizTimer <= 5 && styles.quizTimerBarDanger,
                      ]} />
                    </View>
                    {quizTimerExpired && (
                      <Text style={styles.quizTimerExpiredLabel}>TEMPO SCADUTO!</Text>
                    )}
                  </View>
                )}
                
                <View style={styles.quizOptions}>
                  {quiz.risposte.map((risposta, index) => {
                    const isSelected = selectedAnswer === index;
                    const isCorrect = quizResult?.risposta_corretta_index === index || (quiz.gia_risposto && quiz.risposta_data === index && quiz.risposta_corretta);
                    const isWrong = quiz.gia_risposto && quiz.risposta_data === index && !quiz.risposta_corretta;
                    const showCorrect = quiz.gia_risposto && quizResult?.risposta_corretta_index === index;
                    
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.quizOption,
                          isSelected && !quiz.gia_risposto && styles.quizOptionSelected,
                          (isCorrect || showCorrect) && styles.quizOptionCorrect,
                          isWrong && styles.quizOptionWrong,
                          quizTimerExpired && !quiz.gia_risposto && styles.quizOptionDisabled,
                        ]}
                        onPress={() => !quiz.gia_risposto && quiz.can_play && !quizTimerExpired && setSelectedAnswer(index)}
                        disabled={quiz.gia_risposto || !quiz.can_play || quizTimerExpired}
                      >
                        <Text style={styles.quizOptionLetter}>
                          {String.fromCharCode(65 + index)}
                        </Text>
                        <Text style={[
                          styles.quizOptionText,
                          (isSelected || isCorrect || showCorrect) && styles.quizOptionTextSelected
                        ]}>
                          {risposta}
                        </Text>
                        {(isCorrect || showCorrect) && (
                          <Text style={styles.quizOptionIcon}>✓</Text>
                        )}
                        {isWrong && (
                          <Text style={styles.quizOptionIcon}>✗</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                
                {!quiz.gia_risposto && quiz.can_play && !quizTimerExpired ? (
                  <TouchableOpacity
                    style={[
                      styles.quizSubmitButton,
                      selectedAnswer === null && styles.quizSubmitButtonDisabled
                    ]}
                    onPress={handleQuizSubmit}
                    disabled={selectedAnswer === null || submittingQuiz}
                  >
                    {submittingQuiz ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.quizSubmitText}>
                        {quiz.bonus_type === 'raddoppia' ? '🎰 RADDOPPIA!' : 
                         quiz.bonus_type === 'annulla' ? '💪 SALVA!' : 
                         'CONFERMA'}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : !quiz.gia_risposto && quizTimerExpired ? (
                  <View style={[styles.quizResultBox, styles.quizResultWrong]}>
                    <Text style={styles.quizResultEmoji}>⏰</Text>
                    <Text style={styles.quizResultText}>Tempo scaduto!</Text>
                    <Text style={styles.quizMotivation}>
                      Troppo lento! Domani sarai piu veloce! 💪
                    </Text>
                  </View>
                ) : quiz.gia_risposto && (
                  <View style={[
                    styles.quizResultBox,
                    quiz.risposta_corretta ? styles.quizResultCorrect : styles.quizResultWrong
                  ]}>
                    <Text style={styles.quizResultEmoji}>
                      {quiz.risposta_corretta 
                        ? (quiz.bonus_type === 'raddoppia' ? '🎉🎰' : quiz.bonus_type === 'annulla' ? '💪✅' : '🎉')
                        : '😢'}
                    </Text>
                    <Text style={styles.quizResultText}>
                      {quiz.risposta_corretta 
                        ? `+${quiz.biglietti_vinti} biglietti!` 
                        : 'Risposta sbagliata...'}
                    </Text>
                    <Text style={styles.quizMotivation}>
                      {quiz.risposta_corretta 
                        ? (quiz.bonus_type === 'raddoppia' 
                            ? 'HAI RADDOPPIATO! Sei un campione! 🏆' 
                            : quiz.bonus_type === 'annulla'
                              ? 'SALVATO! La perdita è annullata! 💪'
                              : 'Ottimo! +1 biglietto conquistato! 🎯')
                        : (quiz.bonus_type === 'annulla'
                            ? 'La perdita resta... ma non mollare! 💪'
                            : 'Peccato! Riprova al prossimo giro! 🔄')}
                    </Text>
                  </View>
                )}
                  </>
                )}
              </View>
            )}
            
            <Text style={styles.quizInfo}>
              Si sblocca dopo la ruota • Bonus dipende dal risultato! 🎰
            </Text>
          </View>
        )}

        {/* ===== SEZIONE 3 VINCITORI DEL MESE - VISIBILE A TUTTI ===== */}
        {status?.vincitori && status.vincitori.length > 0 && (
          <Animated.View style={[styles.winnerSection, { transform: [{ scale: pulseAnim }] }]}>
            {/* Cornice luminosa */}
            <View style={styles.winnerGlowBorder}>
              <View style={styles.winnerInner}>
                {/* Header vincitori */}
                <View style={styles.winnerHeader}>
                  <Text style={styles.trophyBig}>🏆</Text>
                  <Text style={styles.winnerMainLabel}>
                    {status.is_me_winner ? '🎉 SEI TRA I VINCITORI! 🎉' : 'VINCITORI DEL MESE'}
                  </Text>
                  <Text style={styles.trophyBig}>🏆</Text>
                </View>

                {/* Messaggio del Maestro */}
                <View style={styles.maestroMessage}>
                  <Text style={styles.maestroText}>
                    Il Maestro è buono e vi vuole bene! 💪
                  </Text>
                </View>

                {/* Lista 3 vincitori con premio */}
                {status.vincitori.map((vincitore, index) => (
                  <View key={index} style={[
                    styles.vincitoreCard,
                    vincitore.is_me && styles.vincitoreCardMe,
                    index === 0 && styles.vincitoreCardFirst
                  ]}>
                    <View style={styles.vincitorePosition}>
                      <Text style={styles.vincitoreMedal}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </Text>
                      <Text style={styles.vincitorePos}>{vincitore.posizione}°</Text>
                    </View>
                    <View style={styles.vincitoreInfo}>
                      <Text style={[styles.vincitoreNome, vincitore.is_me && styles.vincitoreNomeMe]}>
                        {vincitore.soprannome || `${vincitore.nome} ${vincitore.cognome}`}
                        {vincitore.is_me && ' (TU!)'}
                      </Text>
                      <Text style={styles.vincitoreBiglietti}>
                        {vincitore.biglietti} biglietti
                      </Text>
                      {vincitore.premio && (
                        <Text style={styles.vincitorePremio}>
                          🎁 {vincitore.premio}
                        </Text>
                      )}
                    </View>
                    {vincitore.is_me && (
                      <View style={styles.vincitoreWinBadge}>
                        <Text style={styles.vincitoreWinText}>🎉</Text>
                      </View>
                    )}
                  </View>
                ))}

                {/* Mese di riferimento */}
                <Text style={styles.winnerPeriod}>
                  Estrazione: {formatMese(status.mese_riferimento || '')}
                </Text>

                {/* Statistiche estrazione */}
                <View style={styles.winnerStatsRow}>
                  <View style={styles.winnerStatItem}>
                    <Text style={styles.statNumber}>{status.totale_partecipanti}</Text>
                    <Text style={styles.statLabel}>partecipanti</Text>
                  </View>
                  <View style={styles.winnerStatDivider} />
                  <View style={styles.winnerStatItem}>
                    <Text style={styles.statNumber}>{status.totale_biglietti || '-'}</Text>
                    <Text style={styles.statLabel}>biglietti totali</Text>
                  </View>
                </View>

                {/* Messaggio per il vincitore */}
                {status.is_me_winner && (
                  <View style={styles.winnerMessageBox}>
                    <Text style={styles.winnerMessage}>🎁 Congratulazioni! Ritira il tuo premio dal Maestro! 🎁</Text>
                  </View>
                )}

                {/* Info estrazione casuale */}
                <Text style={styles.extractionNote}>
                  L'estrazione è stata effettuata in modo casuale tra tutti gli abbonati attivi
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Nessun vincitore ancora */}
        {(!status?.vincitori || status.vincitori.length === 0) && (
          <View style={styles.noWinnerCard}>
            <Text style={styles.noWinnerIcon}>🎁</Text>
            <Text style={styles.noWinnerTitle}>ESTRAZIONE IN ARRIVO</Text>
            <Text style={styles.noWinnerText}>
              L'estrazione automatica avverrà il 1° del mese alle 12:00.{'\n'}
              3 vincitori saranno estratti tra tutti gli abbonati attivi!
            </Text>
          </View>
        )}

        {/* Avviso abbonamento non attivo - SOLO per clienti, non admin */}
        {!isAdmin && status?.ha_abbonamento_attivo === false && (
          <View style={styles.expiredSubscriptionCard}>
            <View style={styles.expiredHeader}>
              <Ionicons name="alert-circle" size={28} color="#dc2626" />
              <Text style={styles.expiredTitle}>Abbonamento Scaduto</Text>
            </View>
            <Text style={styles.expiredMessage}>
              Riattiva il tuo abbonamento prima della fine del mese per partecipare all'estrazione dei premi del Maestro! 🎁
            </Text>
            <View style={styles.expiredTip}>
              <Ionicons name="call" size={16} color={VEGAS_COLORS.gold} />
              <Text style={styles.expiredTipText}>Contatta il Maestro per rinnovare</Text>
            </View>
          </View>
        )}

        {/* Regolamento - SOLO per clienti, non admin */}
        {!isAdmin && (
          <TouchableOpacity style={styles.rulesButton} onPress={() => setShowRules(true)}>
            <Ionicons name="help-circle" size={22} color={VEGAS_COLORS.gold} />
            <Text style={styles.rulesButtonText}>COME FUNZIONA?</Text>
          </TouchableOpacity>
        )}

        {/* Albo d'Oro */}
        {winners.length > 0 && (
          <View style={styles.hallOfFame}>
            <Text style={styles.hofTitle}>🏆 ALBO D'ORO 🏆</Text>
            {winners.slice(0, 5).map((winnerMonth, idx) => (
              <View key={idx} style={styles.hofMonthBlock}>
                <Text style={styles.hofMonthLabel}>{formatMese(winnerMonth.mese_riferimento)}</Text>
                {winnerMonth.vincitori.map((v, vIdx) => (
                  <View key={vIdx} style={styles.hofItem}>
                    <Text style={styles.hofMedal}>
                      {v.posizione === 1 ? '🥇' : v.posizione === 2 ? '🥈' : '🥉'}
                    </Text>
                    <View style={styles.hofInfo}>
                      <Text style={styles.hofName}>{v.soprannome || `${v.nome} ${v.cognome}`}</Text>
                      {v.premio && <Text style={styles.hofPrize}>🎁 {v.premio}</Text>}
                    </View>
                    <Text style={styles.hofTickets}>{v.biglietti} 🎟️</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Buona fortuna! 🍀</Text>
        </View>
      </ScrollView>

      {/* Modal Regolamento */}
      <Modal visible={showRules} transparent animationType="fade" onRequestClose={() => setShowRules(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎰 REGOLAMENTO 🎰</Text>
              <TouchableOpacity onPress={() => setShowRules(false)}>
                <Ionicons name="close-circle" size={28} color={VEGAS_COLORS.gold} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.rulesScroll}>
              <Text style={styles.ruleTitle}>🎟️ COME GUADAGNI BIGLIETTI?</Text>
              <Text style={styles.ruleText}>
                Ogni volta che completi un allenamento, ricevi automaticamente 1 biglietto per la lotteria del mese!
              </Text>

              <Text style={styles.ruleTitle}>📅 QUANDO C'È L'ESTRAZIONE?</Text>
              <Text style={styles.ruleText}>
                L'estrazione avviene AUTOMATICAMENTE il 1° di ogni mese alle ore 12:00. Non serve fare nulla!
              </Text>

              <Text style={styles.ruleTitle}>🎫 CHI PUÒ PARTECIPARE?</Text>
              <Text style={styles.ruleText}>
                Solo i clienti con ABBONAMENTO ATTIVO partecipano all'estrazione. Assicurati di avere un abbonamento valido!
              </Text>

              <Text style={styles.ruleTitle}>🎯 COME FUNZIONA L'ESTRAZIONE?</Text>
              <Text style={styles.ruleText}>
                L'estrazione è CASUALE! Più biglietti hai, più possibilità di essere estratto. Se hai 5 biglietti e qualcun altro ne ha 1, tu hai 5 volte più possibilità... ma la fortuna decide!
              </Text>

              <Text style={styles.ruleTitle}>🏆 COSA SI VINCE?</Text>
              <Text style={styles.ruleText}>
                Il Maestro è buono e vi vuole bene! 💪{'\n'}
                Ogni mese ci sono 3 VINCITORI con 3 PREMI DIVERSI (1°, 2° e 3° posto)! Il Maestro sceglie i premi ogni mese.
              </Text>

              <Text style={styles.ruleTitle}>📢 COME SAPRÒ SE HO VINTO?</Text>
              <Text style={styles.ruleText}>
                Il vincitore viene mostrato nell'app A TUTTI! Vedrai una sezione dedicata con il nome del vincitore. Se vinci TU, vedrai un messaggio speciale!
              </Text>

              <View style={styles.ruleTip}>
                <Text style={styles.ruleTipText}>
                  💡 CONSIGLIO: Allenati regolarmente e mantieni l'abbonamento attivo per partecipare e aumentare le tue possibilità!
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Imposta Premi (Admin) */}
      <Modal visible={showSetPrize} transparent animationType="fade" onRequestClose={() => setShowSetPrize(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎁 IMPOSTA 3 PREMI</Text>
              <TouchableOpacity onPress={() => setShowSetPrize(false)}>
                <Ionicons name="close-circle" size={28} color={VEGAS_COLORS.gold} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>🥇 1° Premio</Text>
            <TextInput
              style={styles.input}
              value={newPrize1}
              onChangeText={setNewPrize1}
              placeholder="Es: Scarpe Nike"
              placeholderTextColor="#666"
              data-testid="prize-1-input"
            />

            <Text style={styles.inputLabel}>🥈 2° Premio</Text>
            <TextInput
              style={styles.input}
              value={newPrize2}
              onChangeText={setNewPrize2}
              placeholder="Es: Maglietta DanoFitness"
              placeholderTextColor="#666"
              data-testid="prize-2-input"
            />

            <Text style={styles.inputLabel}>🥉 3° Premio</Text>
            <TextInput
              style={styles.input}
              value={newPrize3}
              onChangeText={setNewPrize3}
              placeholder="Es: Canotta DanoFitness"
              placeholderTextColor="#666"
              data-testid="prize-3-input"
            />

            <TouchableOpacity
              style={[styles.saveButton, savingPrize && styles.saveButtonDisabled]}
              onPress={handleSavePrize}
              disabled={savingPrize}
              data-testid="save-prizes-btn"
            >
              {savingPrize ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.saveButtonText}>SALVA PREMI</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VEGAS_COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: VEGAS_COLORS.gold,
    marginTop: 12,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },

  // Header Las Vegas
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
  },
  lightsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 6,
  },
  light: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  casinoTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: VEGAS_COLORS.gold,
    textShadowColor: VEGAS_COLORS.red,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 3,
  },
  jackpotSubtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: VEGAS_COLORS.red,
    letterSpacing: 5,
    marginTop: 4,
  },

  // Premio
  prizeCard: {
    backgroundColor: VEGAS_COLORS.darkRed,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: VEGAS_COLORS.gold,
  },
  prizeLabel: {
    fontSize: 14,
    color: VEGAS_COLORS.gold,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 12,
  },
  prizeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    flex: 1,
  },
  prizeDesc: {
    fontSize: 14,
    color: VEGAS_COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  prizeEmpty: {
    fontSize: 18,
    color: VEGAS_COLORS.textSecondary,
    fontStyle: 'italic',
  },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  prizeMedal: {
    fontSize: 22,
  },
  setPrizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  setPrizeBtnText: {
    color: VEGAS_COLORS.gold,
    fontSize: 12,
    fontWeight: '600',
  },

  // Biglietti
  ticketsCard: {
    backgroundColor: VEGAS_COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#444',
  },
  ticketsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ticketsEmoji: {
    fontSize: 24,
  },
  ticketsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    letterSpacing: 2,
  },
  ticketsNumber: {
    fontSize: 72,
    fontWeight: '900',
    color: VEGAS_COLORS.gold,
    marginVertical: 10,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  ticketsSubtitle: {
    fontSize: 14,
    color: VEGAS_COLORS.textSecondary,
    textAlign: 'center',
  },
  ticketsMini: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    gap: 4,
  },
  ticketMini: {
    fontSize: 20,
  },
  ticketMore: {
    fontSize: 14,
    color: VEGAS_COLORS.gold,
    alignSelf: 'center',
  },

  // Countdown
  countdownCard: {
    backgroundColor: '#000',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: VEGAS_COLORS.red,
  },
  countdownLabel: {
    fontSize: 12,
    color: VEGAS_COLORS.gold,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 16,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownSlot: {
    backgroundColor: VEGAS_COLORS.darkRed,
    borderRadius: 8,
    padding: 12,
    minWidth: 55,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VEGAS_COLORS.gold,
  },
  countdownNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
  },
  countdownUnit: {
    fontSize: 10,
    color: VEGAS_COLORS.textSecondary,
    marginTop: 2,
  },
  countdownColon: {
    fontSize: 28,
    fontWeight: 'bold',
    color: VEGAS_COLORS.red,
    marginHorizontal: 6,
  },
  countdownInfo: {
    fontSize: 12,
    color: VEGAS_COLORS.textSecondary,
    marginTop: 14,
  },
  subscriptionWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  subscriptionWarningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: VEGAS_COLORS.gold,
    lineHeight: 20,
  },

  // ===== NUOVA SEZIONE VINCITORE GRANDE =====
  winnerSection: {
    marginBottom: 20,
  },
  winnerGlowBorder: {
    borderRadius: 24,
    padding: 4,
    backgroundColor: VEGAS_COLORS.gold,
    shadowColor: VEGAS_COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  winnerInner: {
    backgroundColor: '#1a0505',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  winnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  trophyBig: {
    fontSize: 36,
  },
  winnerMainLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    letterSpacing: 2,
    marginHorizontal: 10,
    textAlign: 'center',
  },
  winnerBigName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: VEGAS_COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    marginBottom: 4,
  },
  winnerFullName: {
    fontSize: 14,
    color: VEGAS_COLORS.textSecondary,
    marginBottom: 8,
  },
  winnerPeriod: {
    fontSize: 14,
    color: VEGAS_COLORS.gold,
    marginBottom: 16,
  },
  winnerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  winnerStatItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  winnerStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: VEGAS_COLORS.gold,
    opacity: 0.3,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
  },
  statLabel: {
    fontSize: 11,
    color: VEGAS_COLORS.textSecondary,
    marginTop: 2,
  },
  prizeBadge: {
    backgroundColor: VEGAS_COLORS.darkRed,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: VEGAS_COLORS.gold,
    width: '100%',
    marginBottom: 12,
  },
  prizeBadgeLabel: {
    fontSize: 12,
    color: VEGAS_COLORS.gold,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 6,
  },
  prizeBadgeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  prizeBadgeDesc: {
    fontSize: 13,
    color: VEGAS_COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  prizeCollected: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: 'bold',
    marginTop: 8,
  },
  winnerMessageBox: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    width: '100%',
  },
  winnerMessage: {
    fontSize: 14,
    color: VEGAS_COLORS.gold,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  extractionNote: {
    fontSize: 11,
    color: VEGAS_COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Nessun vincitore
  noWinnerCard: {
    backgroundColor: VEGAS_COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#444',
  },
  noWinnerIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noWinnerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    marginBottom: 8,
  },
  noWinnerText: {
    fontSize: 14,
    color: VEGAS_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Avviso abbonamento scaduto
  warningCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: VEGAS_COLORS.gold,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: VEGAS_COLORS.gold,
    lineHeight: 18,
  },
  expiredSubscriptionCard: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#dc2626',
    alignItems: 'center',
  },
  expiredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  expiredTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  expiredMessage: {
    fontSize: 14,
    color: VEGAS_COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  expiredTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  expiredTipText: {
    fontSize: 13,
    color: VEGAS_COLORS.gold,
    fontWeight: '600',
  },

  // Vecchi stili vincitore (mantenuti per compatibilità)
  winnerCard: {
    backgroundColor: VEGAS_COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: VEGAS_COLORS.gold,
  },
  winnerCardIsMe: {
    backgroundColor: '#3d2c00',
    borderWidth: 4,
  },
  winnerStars: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  star: {
    fontSize: 24,
    marginHorizontal: 4,
  },
  winnerLabel: {
    fontSize: 14,
    color: VEGAS_COLORS.gold,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  winnerName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  winnerMonth: {
    fontSize: 14,
    color: VEGAS_COLORS.textSecondary,
    marginTop: 4,
  },
  winnerStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 20,
  },
  winnerStatBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  winnerStatNum: {
    fontSize: 24,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
  },
  winnerStatLabel: {
    fontSize: 11,
    color: VEGAS_COLORS.textSecondary,
  },
  winnerClaim: {
    fontSize: 14,
    color: VEGAS_COLORS.gold,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },

  // Regolamento Button
  rulesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VEGAS_COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: VEGAS_COLORS.gold,
  },
  rulesButtonText: {
    color: VEGAS_COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Hall of Fame
  hallOfFame: {
    backgroundColor: VEGAS_COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  hofTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 2,
  },
  hofItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  hofMedal: {
    fontSize: 24,
    marginRight: 12,
  },
  hofInfo: {
    flex: 1,
  },
  hofName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  hofMonth: {
    fontSize: 11,
    color: VEGAS_COLORS.textSecondary,
  },
  hofTickets: {
    fontSize: 14,
    color: VEGAS_COLORS.textSecondary,
  },
  hofMonthBlock: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.2)',
    paddingBottom: 12,
  },
  hofMonthLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    marginBottom: 8,
    letterSpacing: 1,
  },
  hofPrize: {
    fontSize: 11,
    color: VEGAS_COLORS.gold,
    marginTop: 2,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 16,
    color: VEGAS_COLORS.textSecondary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: VEGAS_COLORS.card,
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 2,
    borderColor: VEGAS_COLORS.gold,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
  },
  rulesScroll: {
    maxHeight: 400,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    marginTop: 16,
    marginBottom: 8,
  },
  ruleText: {
    fontSize: 14,
    color: '#FFF',
    lineHeight: 22,
  },
  ruleTip: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  ruleTipText: {
    fontSize: 14,
    color: VEGAS_COLORS.gold,
    lineHeight: 20,
  },

  // Input Modal
  inputLabel: {
    fontSize: 14,
    color: VEGAS_COLORS.gold,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1a0a0a',
    borderRadius: 10,
    padding: 14,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: VEGAS_COLORS.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // ===== RUOTA DELLA FORTUNA - STILE ROULETTE CON SPICCHI =====
  wheelSection: {
    backgroundColor: VEGAS_COLORS.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: VEGAS_COLORS.gold,
    alignItems: 'center',
  },
  wheelHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  wheelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    letterSpacing: 2,
  },
  wheelSubtitle: {
    fontSize: 13,
    color: VEGAS_COLORS.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  soundToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 10,
    gap: 6,
  },
  soundToggleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
  },
  soundToggleTextOff: {
    color: VEGAS_COLORS.textSecondary,
  },
  
  // Roulette Container
  rouletteContainer: {
    width: 280,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  rouletteOuterRing: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 12,
    borderColor: VEGAS_COLORS.gold,
    backgroundColor: 'transparent',
    shadowColor: VEGAS_COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  rouletteWheel: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#333',
  },
  
  // Spicchi
  sliceContainer: {
    position: 'absolute',
    width: 250,
    height: 250,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  slice: {
    width: 0,
    height: 0,
    borderLeftWidth: 52,
    borderRightWidth: 52,
    borderBottomWidth: 110,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 5,
  },
  sliceEmoji: {
    fontSize: 26,
    position: 'absolute',
    top: 35,
  },
  
  rouletteCenter: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: VEGAS_COLORS.darkRed,
    borderWidth: 4,
    borderColor: VEGAS_COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    zIndex: 10,
  },
  rouletteCenterEmoji: {
    fontSize: 30,
  },
  
  roulettePointer: {
    position: 'absolute',
    top: 0,
    zIndex: 20,
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderTopWidth: 28,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: VEGAS_COLORS.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  
  spinButton: {
    flexDirection: 'row',
    backgroundColor: VEGAS_COLORS.gold,
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: VEGAS_COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  spinButtonDisabled: {
    backgroundColor: '#555',
    shadowOpacity: 0,
  },
  spinButtonEmoji: {
    fontSize: 24,
  },
  spinButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
  },
  
  // Lista Premi
  prizesListContainer: {
    width: '100%',
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    padding: 16,
  },
  prizesListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
  },
  prizesList: {
    gap: 6,
  },
  prizeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 0,
  },
  prizeListItemRaro: {
    backgroundColor: 'rgba(255,215,0,0.15)',
  },
  prizeListItemRarissimo: {
    backgroundColor: 'rgba(220,38,38,0.15)',
  },
  prizeColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  prizeListEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  prizeListInfo: {
    flex: 1,
  },
  prizeListText: {
    fontSize: 13,
    color: VEGAS_COLORS.text,
    fontWeight: '500',
  },
  prizeListRarity: {
    fontSize: 10,
    color: VEGAS_COLORS.gold,
    fontWeight: 'bold',
    marginTop: 2,
  },
  prizeListRarityRarissimo: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: 'bold',
    marginTop: 2,
  },
  prizeListBiglietti: {
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'right',
  },

  // Modal Risultato Ruota
  wheelResultOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  wheelResultCard: {
    backgroundColor: VEGAS_COLORS.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 4,
    borderColor: VEGAS_COLORS.gold,
    width: '90%',
    maxWidth: 340,
  },
  wheelResultEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  wheelResultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    marginBottom: 12,
    textAlign: 'center',
  },
  wheelResultText: {
    fontSize: 20,
    color: VEGAS_COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  wheelResultBiglietti: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  wheelResultButton: {
    backgroundColor: VEGAS_COLORS.gold,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  wheelResultButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  // Stili per 3 vincitori
  maestroMessage: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: VEGAS_COLORS.gold,
  },
  maestroText: {
    fontSize: 14,
    color: VEGAS_COLORS.gold,
    textAlign: 'center',
    fontWeight: '600',
  },
  vincitoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  vincitoreCardMe: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: VEGAS_COLORS.gold,
    borderWidth: 2,
  },
  vincitoreCardFirst: {
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  vincitorePosition: {
    alignItems: 'center',
    marginRight: 12,
    width: 50,
  },
  vincitoreMedal: {
    fontSize: 32,
  },
  vincitorePos: {
    fontSize: 12,
    color: VEGAS_COLORS.textSecondary,
    marginTop: 2,
  },
  vincitoreInfo: {
    flex: 1,
  },
  vincitoreNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: VEGAS_COLORS.text,
  },
  vincitoreNomeMe: {
    color: VEGAS_COLORS.gold,
  },
  vincitoreBiglietti: {
    fontSize: 12,
    color: VEGAS_COLORS.textSecondary,
    marginTop: 2,
  },
  vincitorePremio: {
    fontSize: 13,
    color: VEGAS_COLORS.gold,
    marginTop: 3,
    fontWeight: '600',
  },
  vincitoreWinBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: VEGAS_COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vincitoreWinText: {
    fontSize: 18,
  },
  // Stili per premio in palio (prima dell'estrazione)
  maestroMessagePreview: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
    borderWidth: 2,
    borderColor: VEGAS_COLORS.gold,
  },
  maestroTextPreview: {
    fontSize: 16,
    color: VEGAS_COLORS.gold,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  premioInPalio: {
    backgroundColor: VEGAS_COLORS.darkRed,
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    alignItems: 'center',
  },
  premioInPalioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  premioInPalioMedal: {
    fontSize: 20,
  },
  premioInPalioText: {
    fontSize: 18,
    color: VEGAS_COLORS.gold,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  premioInPalioSub: {
    fontSize: 14,
    color: VEGAS_COLORS.text,
    marginTop: 6,
    textAlign: 'center',
  },
  // Banner premio in header countdown
  premioHeaderBanner: {
    backgroundColor: VEGAS_COLORS.darkRed,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: VEGAS_COLORS.gold,
    alignItems: 'center',
  },
  premioHeaderText: {
    fontSize: 14,
    color: VEGAS_COLORS.gold,
    fontWeight: 'bold',
  },
  premioHeaderPrize: {
    fontSize: 20,
    color: VEGAS_COLORS.text,
    fontWeight: 'bold',
    marginTop: 6,
  },
  premioHeaderWinners: {
    fontSize: 13,
    color: VEGAS_COLORS.gold,
    marginTop: 6,
    textAlign: 'center',
  },
  // Quiz Fitness Styles
  quizSection: {
    backgroundColor: VEGAS_COLORS.card,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  quizIcon: {
    fontSize: 24,
  },
  quizTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ECDC4',
    textAlign: 'center',
  },
  quizSubtitle: {
    fontSize: 13,
    color: VEGAS_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  quizCard: {
    backgroundColor: 'rgba(78,205,196,0.1)',
    borderRadius: 16,
    padding: 16,
  },
  quizQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: VEGAS_COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  quizTimerContainer: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  quizTimerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(78,205,196,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizTimerCircleDanger: {
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255,107,107,0.15)',
  },
  quizTimerBigNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
  quizTimerBigNumberDanger: {
    color: '#FF6B6B',
  },
  quizTimerBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  quizTimerBarFill: {
    height: '100%',
    backgroundColor: '#4ECDC4',
    borderRadius: 4,
  },
  quizTimerBarDanger: {
    backgroundColor: '#FF6B6B',
  },
  quizTimerExpiredLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
    letterSpacing: 1,
  },
  quizOptionDisabled: {
    opacity: 0.4,
  },
  quizStartContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 14,
  },
  quizRulesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    letterSpacing: 1,
  },
  quizRulesList: {
    width: '100%',
    gap: 6,
    paddingHorizontal: 8,
  },
  quizRuleItem: {
    fontSize: 13,
    color: VEGAS_COLORS.textSecondary,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(78,205,196,0.3)',
  },
  quizRuleBonus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    textAlign: 'center',
    marginTop: 6,
  },
  quizStartInfo: {
    fontSize: 14,
    color: VEGAS_COLORS.textSecondary,
    textAlign: 'center',
  },
  quizStartButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 30,
  },
  quizStartButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  quizOptions: {
    gap: 10,
  },
  quizOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quizOptionSelected: {
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(78,205,196,0.2)',
  },
  quizOptionCorrect: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76,175,80,0.2)',
  },
  quizOptionWrong: {
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255,107,107,0.2)',
  },
  quizOptionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: 'bold',
    color: VEGAS_COLORS.textSecondary,
    marginRight: 12,
  },
  quizOptionText: {
    flex: 1,
    fontSize: 14,
    color: VEGAS_COLORS.text,
  },
  quizOptionTextSelected: {
    fontWeight: '600',
  },
  quizOptionIcon: {
    fontSize: 18,
    marginLeft: 8,
  },
  quizSubmitButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  quizSubmitButtonDisabled: {
    backgroundColor: 'rgba(78,205,196,0.3)',
  },
  quizSubmitText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  quizResultBox: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  quizResultCorrect: {
    backgroundColor: 'rgba(76,175,80,0.2)',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  quizResultWrong: {
    backgroundColor: 'rgba(255,107,107,0.2)',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  quizResultEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  quizResultText: {
    fontSize: 14,
    fontWeight: '600',
    color: VEGAS_COLORS.text,
    textAlign: 'center',
  },
  quizMotivation: {
    fontSize: 12,
    color: VEGAS_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  quizInfo: {
    fontSize: 11,
    color: VEGAS_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  // Quiz Locked Styles
  quizLockedCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(78,205,196,0.3)',
    borderStyle: 'dashed',
  },
  quizLockedIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  quizLockedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: VEGAS_COLORS.textSecondary,
    marginBottom: 8,
  },
  quizLockedMessage: {
    fontSize: 14,
    color: VEGAS_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  quizLockedMotivation: {
    fontSize: 13,
    color: '#4ECDC4',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Quiz Bonus Badge styles
  quizBonusBadge: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  quizBonusBadgeGold: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  quizBonusBadgeRed: {
    backgroundColor: 'rgba(255,107,107,0.2)',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  quizBonusBadgeGreen: {
    backgroundColor: 'rgba(78,205,196,0.2)',
    borderWidth: 2,
    borderColor: '#4ECDC4',
  },
  quizBonusBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: VEGAS_COLORS.text,
    textAlign: 'center',
  },
  // Category Selection styles
  categorySelectionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    marginBottom: 4,
    letterSpacing: 2,
  },
  categorySubtitle: {
    fontSize: 13,
    color: VEGAS_COLORS.textSecondary,
    marginBottom: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  categoryButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '46%',
    borderWidth: 2,
    minHeight: 90,
  },
  categoryEmoji: {
    fontSize: 30,
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 8,
    alignSelf: 'center',
  },
  categoryBadgeText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: VEGAS_COLORS.gold,
    letterSpacing: 1,
  },
});
