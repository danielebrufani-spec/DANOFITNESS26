import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';

// Colori tema competizione
const COLORS = {
  background: '#0f0f1a',
  card: '#1a1a2e',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  text: '#ffffff',
  textSecondary: '#888',
  accent: '#8B5CF6',
};

// Dediche divertenti per il vincitore
const DEDICHE_VINCITORE = [
  (nome: string, count: number) => `${nome} è una MACCHINA! ${count} allenamenti e non sente fatica... o forse sì ma non lo ammette! 💪😂`,
  (nome: string, count: number) => `Tutti applaudite ${nome}! Ha fatto ${count} allenamenti mentre voi eravate sul divano! 🛋️➡️🏋️`,
  (nome: string, count: number) => `${nome} ha praticamente VISSUTO in palestra questa settimana! ${count} sessioni di puro sudore! 🔥`,
  (nome: string, count: number) => `Il Maestro vuole adottare ${nome}! ${count} allenamenti = Leggenda vivente! 🦸‍♂️`,
  (nome: string, count: number) => `${nome} non conosce la parola "riposo"! ${count} volte in palestra... il divano piange! 😭💪`,
  (nome: string, count: number) => `ATTENZIONE: ${nome} con ${count} allenamenti sta cercando di diventare un Avenger! 🦸`,
  (nome: string, count: number) => `${nome} ha bruciato più calorie di un vulcano questa settimana! ${count} sessioni infuocate! 🌋`,
  (nome: string, count: number) => `Il frigorifero di ${nome} trema di paura... ${count} allenamenti = può mangiare TUTTO! 🍕💪`,
  (nome: string, count: number) => `${nome} è tipo Rocky ma meglio! ${count} allenamenti e ancora in piedi! 🥊`,
  (nome: string, count: number) => `NASA sta studiando ${nome}: ${count} allenamenti e energie INFINITE! 🚀`,
];

// Frasi motivazionali per chi non è in classifica
const FRASI_MOTIVAZIONE = [
  "La classifica si aggiorna ogni settimana... il tuo momento sta arrivando! 💪",
  "Non sei ancora in Top 5? Perfetto, hai tutto da guadagnare! 🚀",
  "I campioni di domani si allenano oggi! Cosa aspetti? 🏆",
  "La gloria è a un allenamento di distanza! 🔥",
  "Anche Rocky ha iniziato da zero... e guardalo ora! 🥊",
];

interface LeaderboardEntry {
  posizione: number;
  nome: string;
  nome_completo: string;
  allenamenti: number;
  is_me: boolean;
}

export default function ClassificaScreen() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [settimana, setSettimana] = useState('');
  const [dedicaIndex, setDedicaIndex] = useState(0);
  
  // Animazioni
  const crownBounce = useRef(new Animated.Value(0)).current;
  const goldGlow = useRef(new Animated.Value(0)).current;
  const fireScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animazione corona che rimbalza
    Animated.loop(
      Animated.sequence([
        Animated.timing(crownBounce, { toValue: -8, duration: 500, useNativeDriver: true }),
        Animated.timing(crownBounce, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    // Animazione glow oro
    Animated.loop(
      Animated.sequence([
        Animated.timing(goldGlow, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(goldGlow, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Animazione fuoco
    Animated.loop(
      Animated.sequence([
        Animated.timing(fireScale, { toValue: 1.2, duration: 300, useNativeDriver: true }),
        Animated.timing(fireScale, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const loadData = async () => {
    try {
      const res = await apiService.getWeeklyLeaderboard();
      setLeaderboard(res.data.leaderboard);
      setSettimana(res.data.settimana);
      // Random dedica per il vincitore
      setDedicaIndex(Math.floor(Math.random() * DEDICHE_VINCITORE.length));
    } catch (error) {
      console.error('Error loading leaderboard:', error);
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

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Trova se l'utente corrente è in classifica
  const userInLeaderboard = leaderboard.find(e => e.is_me);
  const randomMotivation = FRASI_MOTIVAZIONE[Math.floor(Math.random() * FRASI_MOTIVAZIONE.length)];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Caricamento classifica...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const winner = leaderboard[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Animated.Text style={[styles.fireEmoji, { transform: [{ scale: fireScale }] }]}>🔥</Animated.Text>
          <Text style={styles.title}>CLASSIFICA</Text>
          <Animated.Text style={[styles.fireEmoji, { transform: [{ scale: fireScale }] }]}>🔥</Animated.Text>
        </View>
        <Text style={styles.subtitle}>TOP 5 SETTIMANALE</Text>
        <Text style={styles.weekText}>📅 {settimana}</Text>

        {leaderboard.length > 0 ? (
          <>
            {/* Vincitore della settimana */}
            <Animated.View style={[
              styles.winnerCard,
              { opacity: goldGlow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }
            ]}>
              <Animated.Text style={[styles.winnerCrown, { transform: [{ translateY: crownBounce }] }]}>
                👑
              </Animated.Text>
              <Text style={styles.winnerLabel}>CAMPIONE DELLA SETTIMANA</Text>
              <Text style={styles.winnerName}>{winner.nome}</Text>
              <View style={styles.winnerStats}>
                <Text style={styles.winnerCount}>{winner.allenamenti}</Text>
                <Text style={styles.winnerCountLabel}>ALLENAMENTI</Text>
              </View>
              
              {/* Dedica divertente */}
              <View style={styles.dedicaBox}>
                <Text style={styles.dedicaText}>
                  {DEDICHE_VINCITORE[dedicaIndex](winner.nome, winner.allenamenti)}
                </Text>
              </View>
              
              {winner.is_me && (
                <View style={styles.youWinBadge}>
                  <Text style={styles.youWinText}>🎉 SEI TU! 🎉</Text>
                </View>
              )}
            </Animated.View>

            {/* Podio */}
            <View style={styles.podiumSection}>
              <Text style={styles.podiumTitle}>🏆 PODIO 🏆</Text>
              <View style={styles.podiumContainer}>
                {/* 2° posto */}
                {leaderboard.length >= 2 && (
                  <View style={styles.podiumSpot}>
                    <View style={[styles.podiumBar, styles.podiumSecond]}>
                      <Text style={styles.podiumMedal}>🥈</Text>
                      <Text style={styles.podiumCount}>{leaderboard[1].allenamenti}</Text>
                    </View>
                    <Text style={[styles.podiumName, leaderboard[1].is_me && styles.podiumNameMe]} numberOfLines={1}>
                      {leaderboard[1].nome}
                    </Text>
                    <Text style={styles.podiumPos}>2°</Text>
                  </View>
                )}
                
                {/* 1° posto */}
                <View style={styles.podiumSpot}>
                  <View style={[styles.podiumBar, styles.podiumFirst]}>
                    <Text style={styles.podiumMedal}>🥇</Text>
                    <Text style={styles.podiumCount}>{leaderboard[0].allenamenti}</Text>
                  </View>
                  <Text style={[styles.podiumName, leaderboard[0].is_me && styles.podiumNameMe]} numberOfLines={1}>
                    {leaderboard[0].nome}
                  </Text>
                  <Text style={styles.podiumPos}>1°</Text>
                </View>
                
                {/* 3° posto */}
                {leaderboard.length >= 3 && (
                  <View style={styles.podiumSpot}>
                    <View style={[styles.podiumBar, styles.podiumThird]}>
                      <Text style={styles.podiumMedal}>🥉</Text>
                      <Text style={styles.podiumCount}>{leaderboard[2].allenamenti}</Text>
                    </View>
                    <Text style={[styles.podiumName, leaderboard[2].is_me && styles.podiumNameMe]} numberOfLines={1}>
                      {leaderboard[2].nome}
                    </Text>
                    <Text style={styles.podiumPos}>3°</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Classifica completa */}
            <View style={styles.fullLeaderboard}>
              <Text style={styles.fullLeaderboardTitle}>📊 CLASSIFICA COMPLETA</Text>
              {leaderboard.map((entry, index) => (
                <View 
                  key={entry.posizione}
                  style={[
                    styles.leaderboardRow,
                    entry.is_me && styles.leaderboardRowMe,
                    index === 0 && styles.leaderboardRowFirst,
                  ]}
                >
                  <View style={styles.leaderboardLeft}>
                    <Text style={[styles.leaderboardPos, index === 0 && styles.leaderboardPosFirst]}>
                      {entry.posizione === 1 ? '🥇' : entry.posizione === 2 ? '🥈' : entry.posizione === 3 ? '🥉' : `${entry.posizione}°`}
                    </Text>
                    <View>
                      <Text style={[styles.leaderboardName, entry.is_me && styles.leaderboardNameMe]}>
                        {entry.nome} {entry.is_me && '(Tu)'}
                      </Text>
                      {entry.nome !== entry.nome_completo && (
                        <Text style={styles.leaderboardFullName}>{entry.nome_completo}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.leaderboardRight}>
                    <Text style={styles.leaderboardCount}>{entry.allenamenti}</Text>
                    <Text style={styles.leaderboardCountLabel}>💪</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Messaggio motivazionale */}
            <View style={styles.motivationBox}>
              {userInLeaderboard ? (
                <Text style={styles.motivationText}>
                  🔥 Sei al {userInLeaderboard.posizione}° posto con {userInLeaderboard.allenamenti} allenamenti! 
                  {userInLeaderboard.posizione === 1 ? ' CONTINUA COSÌ CAMPIONE!' : ' Puoi ancora salire!'}
                </Text>
              ) : (
                <Text style={styles.motivationText}>{randomMotivation}</Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏃‍♂️</Text>
            <Text style={styles.emptyTitle}>Nessun allenamento questa settimana</Text>
            <Text style={styles.emptyText}>
              La classifica si popolerà quando inizieranno gli allenamenti!
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>
            La classifica si aggiorna ogni domenica alle 9:00 con l'apertura delle nuove prenotazioni
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.gold,
    marginTop: 12,
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  fireEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 4,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 2,
  },
  weekText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },

  // Winner Card
  winnerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  winnerCrown: {
    fontSize: 50,
    marginBottom: 8,
  },
  winnerLabel: {
    fontSize: 12,
    color: COLORS.gold,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  winnerName: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: 8,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  winnerStats: {
    alignItems: 'center',
    marginTop: 16,
  },
  winnerCount: {
    fontSize: 56,
    fontWeight: '900',
    color: COLORS.gold,
  },
  winnerCountLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  dedicaBox: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  dedicaText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  youWinBadge: {
    backgroundColor: COLORS.gold,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 16,
  },
  youWinText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.background,
  },

  // Podium
  podiumSection: {
    marginBottom: 24,
  },
  podiumTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 8,
  },
  podiumSpot: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 100,
  },
  podiumBar: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  podiumFirst: {
    backgroundColor: COLORS.gold,
    height: 120,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  podiumSecond: {
    backgroundColor: COLORS.silver,
    height: 90,
  },
  podiumThird: {
    backgroundColor: COLORS.bronze,
    height: 70,
  },
  podiumMedal: {
    fontSize: 28,
  },
  podiumCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.background,
    marginTop: 4,
  },
  podiumName: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 8,
    textAlign: 'center',
  },
  podiumNameMe: {
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  podiumPos: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Full Leaderboard
  fullLeaderboard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  fullLeaderboardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  leaderboardRowMe: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  leaderboardRowFirst: {
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  leaderboardPos: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    width: 36,
    textAlign: 'center',
  },
  leaderboardPosFirst: {
    fontSize: 22,
  },
  leaderboardName: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  leaderboardNameMe: {
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  leaderboardFullName: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leaderboardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  leaderboardCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  leaderboardCountLabel: {
    fontSize: 16,
  },

  // Motivation
  motivationBox: {
    backgroundColor: COLORS.accent + '20',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  motivationText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Info
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
