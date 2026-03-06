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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';

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
  { id: 0, testo: "Ritenta!", emoji: "💨", color: "#666" },
  { id: 1, testo: "+1 Biglietto!", emoji: "🎟️", color: "#22c55e" },
  { id: 2, testo: "10 Flessioni!", emoji: "💪", color: "#f97316" },
  { id: 3, testo: "+2 Biglietti!", emoji: "🎟️", color: "#22c55e" },
  { id: 4, testo: "JACKPOT +5!", emoji: "🌟", color: "#FFD700" },
  { id: 5, testo: "BESTIA!", emoji: "😂", color: "#ec4899" },
  { id: 6, testo: "-1 Biglietto!", emoji: "💀", color: "#dc2626" },
  { id: 7, testo: "Coccodè!", emoji: "🐔", color: "#f59e0b" },
];

interface WheelStatus {
  can_spin: boolean;
  reason?: string;
  message: string;
  last_result?: string;
}

interface LotteryStatus {
  biglietti_utente: number;
  mese_corrente: string;
  ha_abbonamento_attivo: boolean;
  vincitore: {
    nome: string;
    cognome: string;
    soprannome?: string;
    biglietti: number;
    mese_riferimento: string;
    totale_partecipanti: number;
    totale_biglietti?: number;
    data_estrazione?: string;
    premio?: string;
    premio_descrizione?: string;
    premio_ritirato?: boolean;
    is_me: boolean;
  } | null;
  prossima_estrazione: string;
  secondi_a_estrazione: number;
  estrazione_fatta: boolean;
}

interface Winner {
  mese: string;
  mese_riferimento: string;
  nome: string;
  cognome: string;
  soprannome?: string;
  biglietti: number;
  totale_partecipanti: number;
  data_estrazione?: string;
}

interface Prize {
  premio: string | null;
  descrizione: string | null;
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
  const [newPrize, setNewPrize] = useState('');
  const [newPrizeDesc, setNewPrizeDesc] = useState('');
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
      }).start(() => {
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
    if (!newPrize.trim()) {
      Alert.alert('Errore', 'Inserisci il premio');
      return;
    }
    setSavingPrize(true);
    try {
      await apiService.setMonthlyPrize(newPrize, newPrizeDesc || undefined);
      Alert.alert('Successo', 'Premio impostato!');
      setShowSetPrize(false);
      setNewPrize('');
      setNewPrizeDesc('');
      loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore');
    } finally {
      setSavingPrize(false);
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

        {/* Premio del Mese */}
        <Animated.View style={[styles.prizeCard, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.prizeLabel}>🎰 PREMIO IN PALIO 🎰</Text>
          {prize?.premio ? (
            <>
              <Text style={styles.prizeName}>{prize.premio}</Text>
              {prize.descrizione && <Text style={styles.prizeDesc}>{prize.descrizione}</Text>}
            </>
          ) : (
            <Text style={styles.prizeEmpty}>Premio da annunciare...</Text>
          )}
          {isAdmin && (
            <TouchableOpacity style={styles.setPrizeBtn} onPress={() => setShowSetPrize(true)}>
              <Ionicons name="create" size={16} color={VEGAS_COLORS.gold} />
              <Text style={styles.setPrizeBtnText}>Imposta Premio</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

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
              {status?.biglietti_utente === 0 
                ? 'Allenati per guadagnare biglietti!' 
                : status?.biglietti_utente === 1 
                  ? '1 possibilità di vincere!'
                  : `${status?.biglietti_utente} possibilità di vincere!`}
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

        {/* ===== RUOTA DELLA FORTUNA ===== */}
        {!isAdmin && (
          <View style={styles.wheelSection}>
            <View style={styles.wheelHeader}>
              <Text style={styles.wheelTitle}>🎰 RUOTA DELLA FORTUNA 🎰</Text>
              <Text style={styles.wheelSubtitle}>
                {wheelStatus?.can_spin 
                  ? "Gira e tenta la fortuna!" 
                  : wheelStatus?.message || "Allenati per sbloccare!"}
              </Text>
            </View>

            {/* Ruota */}
            <View style={styles.wheelContainer}>
              <Animated.View 
                style={[
                  styles.wheel,
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
                {WHEEL_PRIZES.map((prize, index) => (
                  <View 
                    key={prize.id} 
                    style={[
                      styles.wheelSlice,
                      { 
                        transform: [{ rotate: `${index * 45}deg` }],
                        backgroundColor: prize.color + '40',
                      }
                    ]}
                  >
                    <Text style={styles.wheelSliceEmoji}>{prize.emoji}</Text>
                  </View>
                ))}
              </Animated.View>
              
              {/* Freccia indicatore */}
              <View style={styles.wheelPointer}>
                <Text style={styles.wheelPointerArrow}>▼</Text>
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
                    {wheelStatus?.can_spin ? "GIRA LA RUOTA!" : "TORNA DOPO IL PROSSIMO ALLENAMENTO!"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Premi disponibili */}
            <View style={styles.prizesPreview}>
              {WHEEL_PRIZES.map((p) => (
                <View key={p.id} style={styles.prizePreviewItem}>
                  <Text style={styles.prizePreviewEmoji}>{p.emoji}</Text>
                </View>
              ))}
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

        {/* Countdown */}
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>⏰ PROSSIMA ESTRAZIONE AUTOMATICA ⏰</Text>
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
          <Text style={styles.countdownInfo}>1° del mese • ore 12:00 • Solo abbonati attivi</Text>
        </View>

        {/* ===== SEZIONE VINCITORE DEL MESE - VISIBILE A TUTTI ===== */}
        {status?.vincitore && (
          <Animated.View style={[styles.winnerSection, { transform: [{ scale: pulseAnim }] }]}>
            {/* Cornice luminosa */}
            <View style={styles.winnerGlowBorder}>
              <View style={styles.winnerInner}>
                {/* Header vincitore */}
                <View style={styles.winnerHeader}>
                  <Text style={styles.trophyBig}>🏆</Text>
                  <Text style={styles.winnerMainLabel}>
                    {status.vincitore.is_me ? '🎉 SEI TU IL VINCITORE! 🎉' : 'VINCITORE DEL MESE'}
                  </Text>
                  <Text style={styles.trophyBig}>🏆</Text>
                </View>

                {/* Nome vincitore grande */}
                <Text style={styles.winnerBigName}>
                  {status.vincitore.soprannome || `${status.vincitore.nome} ${status.vincitore.cognome}`}
                </Text>
                
                {/* Se c'è soprannome mostra anche nome completo */}
                {status.vincitore.soprannome && (
                  <Text style={styles.winnerFullName}>
                    ({status.vincitore.nome} {status.vincitore.cognome})
                  </Text>
                )}

                {/* Mese di riferimento */}
                <Text style={styles.winnerPeriod}>
                  Estrazione: {formatMese(status.vincitore.mese_riferimento)}
                </Text>

                {/* Statistiche estrazione */}
                <View style={styles.winnerStatsRow}>
                  <View style={styles.winnerStatItem}>
                    <Text style={styles.statNumber}>{status.vincitore.biglietti}</Text>
                    <Text style={styles.statLabel}>biglietti</Text>
                  </View>
                  <View style={styles.winnerStatDivider} />
                  <View style={styles.winnerStatItem}>
                    <Text style={styles.statNumber}>{status.vincitore.totale_partecipanti}</Text>
                    <Text style={styles.statLabel}>partecipanti</Text>
                  </View>
                  <View style={styles.winnerStatDivider} />
                  <View style={styles.winnerStatItem}>
                    <Text style={styles.statNumber}>{status.vincitore.totale_biglietti || '-'}</Text>
                    <Text style={styles.statLabel}>biglietti totali</Text>
                  </View>
                </View>

                {/* Premio vinto */}
                {status.vincitore.premio && (
                  <View style={styles.prizeBadge}>
                    <Text style={styles.prizeBadgeLabel}>🎁 PREMIO</Text>
                    <Text style={styles.prizeBadgeText}>{status.vincitore.premio}</Text>
                    {status.vincitore.premio_descrizione && (
                      <Text style={styles.prizeBadgeDesc}>{status.vincitore.premio_descrizione}</Text>
                    )}
                    {status.vincitore.premio_ritirato && (
                      <Text style={styles.prizeCollected}>✅ Premio ritirato</Text>
                    )}
                  </View>
                )}

                {/* Messaggio per il vincitore */}
                {status.vincitore.is_me && !status.vincitore.premio_ritirato && (
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
        {!status?.vincitore && (
          <View style={styles.noWinnerCard}>
            <Text style={styles.noWinnerIcon}>🎰</Text>
            <Text style={styles.noWinnerTitle}>In attesa dell'estrazione</Text>
            <Text style={styles.noWinnerText}>
              L'estrazione automatica avverrà il 1° del mese alle 12:00.{'\n'}
              Solo gli abbonati attivi partecipano!
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
            {winners.slice(0, 5).map((winner, index) => (
              <View key={index} style={styles.hofItem}>
                <Text style={styles.hofMedal}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎖️'}
                </Text>
                <View style={styles.hofInfo}>
                  <Text style={styles.hofName}>{winner.nome} {winner.cognome}</Text>
                  <Text style={styles.hofMonth}>{formatMese(winner.mese_riferimento)}</Text>
                </View>
                <Text style={styles.hofTickets}>{winner.biglietti} 🎟️</Text>
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
                Ogni mese il Maestro mette in palio un gadget della palestra: magliette, borracce, asciugamani e altro!
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

      {/* Modal Imposta Premio (Admin) */}
      <Modal visible={showSetPrize} transparent animationType="fade" onRequestClose={() => setShowSetPrize(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎁 IMPOSTA PREMIO</Text>
              <TouchableOpacity onPress={() => setShowSetPrize(false)}>
                <Ionicons name="close-circle" size={28} color={VEGAS_COLORS.gold} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Premio del mese</Text>
            <TextInput
              style={styles.input}
              value={newPrize}
              onChangeText={setNewPrize}
              placeholder="Es: Maglietta DanoFitness"
              placeholderTextColor="#666"
            />

            <Text style={styles.inputLabel}>Descrizione (opzionale)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={newPrizeDesc}
              onChangeText={setNewPrizeDesc}
              placeholder="Es: Taglia a scelta!"
              placeholderTextColor="#666"
              multiline
            />

            <TouchableOpacity
              style={[styles.saveButton, savingPrize && styles.saveButtonDisabled]}
              onPress={handleSavePrize}
              disabled={savingPrize}
            >
              {savingPrize ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.saveButtonText}>SALVA PREMIO</Text>
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
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
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

  // ===== RUOTA DELLA FORTUNA =====
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
  wheelContainer: {
    width: 260,
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  wheel: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: VEGAS_COLORS.darkRed,
    borderWidth: 8,
    borderColor: VEGAS_COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  wheelSlice: {
    position: 'absolute',
    width: 120,
    height: 120,
    left: 60,
    top: 0,
    transformOrigin: 'bottom center',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 15,
  },
  wheelSliceEmoji: {
    fontSize: 28,
  },
  wheelPointer: {
    position: 'absolute',
    top: -5,
    zIndex: 10,
  },
  wheelPointerArrow: {
    fontSize: 36,
    color: VEGAS_COLORS.gold,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  spinButton: {
    flexDirection: 'row',
    backgroundColor: VEGAS_COLORS.gold,
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 40,
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
    backgroundColor: '#666',
    shadowOpacity: 0,
  },
  spinButtonEmoji: {
    fontSize: 24,
  },
  spinButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1,
  },
  prizesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  prizePreviewItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prizePreviewEmoji: {
    fontSize: 18,
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
});
