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
  Image,
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
  "Non sei ancora sul podio? Perfetto, hai tutto da guadagnare! 🚀",
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
  pari_merito?: boolean;
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <View style={styles.header}>
            <Animated.Text style={[styles.fireEmoji, { transform: [{ scale: fireScale }] }]}>🔥</Animated.Text>
            <Text style={styles.title}>CLASSIFICA</Text>
            <Animated.Text style={[styles.fireEmoji, { transform: [{ scale: fireScale }] }]}>🔥</Animated.Text>
          </View>
        </View>
        <Text style={styles.subtitle}>TOP 3 SETTIMANALE</Text>
        <Text style={styles.weekText}>📅 {settimana}</Text>

        {leaderboard.length > 0 ? (
          <>
            {/* Vincitori della settimana (tutti i primi) */}
            {(() => {
              const primi = leaderboard.filter(e => e.posizione === 1);
              return (
                <Animated.View style={[
                  styles.winnerCard,
                  { opacity: goldGlow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }
                ]}>
                  <Animated.Text style={[styles.winnerCrown, { transform: [{ translateY: crownBounce }] }]}>
                    {primi.length > 1 ? '👑👑' : '👑'}
                  </Animated.Text>
                  <Text style={styles.winnerLabel}>
                    {primi.length > 1 ? `🎉 ${primi.length} CAMPIONI DELLA SETTIMANA! 🎉` : 'CAMPIONE DELLA SETTIMANA'}
                  </Text>
                  
                  {/* Nomi dei vincitori */}
                  <View style={styles.winnersNames}>
                    {primi.map((p, idx) => (
                      <View key={idx} style={styles.winnerNameRow}>
                        <Text style={styles.winnerNameStar}>⭐</Text>
                        <Text style={[styles.winnerName, p.is_me && styles.winnerNameMe]}>
                          {p.nome}
                        </Text>
                        {p.is_me && <Text style={styles.winnerYouTag}>(Tu!)</Text>}
                      </View>
                    ))}
                  </View>
                  
                  <View style={styles.winnerStats}>
                    <Text style={styles.winnerCount}>{primi[0].allenamenti}</Text>
                    <Text style={styles.winnerCountLabel}>ALLENAMENTI</Text>
                  </View>
                  
                  {/* Dedica divertente */}
                  <View style={styles.dedicaBox}>
                    <Text style={styles.dedicaText}>
                      {primi.length > 1 
                        ? `${primi.map(p => p.nome).join(' e ')} sono INARRESTABILI! ${primi[0].allenamenti} allenamenti a testa... LEGGENDARI! 🔥💪`
                        : DEDICHE_VINCITORE[dedicaIndex](primi[0].nome, primi[0].allenamenti)
                      }
                    </Text>
                  </View>
                  
                  {primi.some(p => p.is_me) && (
                    <View style={styles.youWinBadge}>
                      <Text style={styles.youWinText}>🎉 HAI VINTO! 🎉</Text>
                    </View>
                  )}
                </Animated.View>
              );
            })()}

            {/* Podio con tutti i nomi per posizione */}
            <View style={styles.podiumSection}>
              <Text style={styles.podiumTitle}>🏆 PODIO 🏆</Text>
              <View style={styles.podiumContainer}>
                {/* 2° posto - tutti i secondi */}
                {(() => {
                  const secondi = leaderboard.filter(e => e.posizione === 2);
                  if (secondi.length === 0) return null;
                  return (
                    <View style={styles.podiumSpot}>
                      <Text style={styles.podiumMedalBig}>🥈</Text>
                      <View style={[styles.podiumBar, styles.podiumSecond]}>
                        <Text style={styles.podiumCount}>{secondi[0].allenamenti}</Text>
                        <Text style={styles.podiumCountLabel}>allenam.</Text>
                      </View>
                      <View style={styles.podiumNames}>
                        {secondi.map((s, i) => (
                          <Text key={i} style={[styles.podiumName, s.is_me && styles.podiumNameMe]} numberOfLines={1}>
                            {s.nome}
                          </Text>
                        ))}
                      </View>
                      <Text style={styles.podiumPos}>2°</Text>
                    </View>
                  );
                })()}
                
                {/* 1° posto - tutti i primi */}
                {(() => {
                  const primi = leaderboard.filter(e => e.posizione === 1);
                  return (
                    <View style={styles.podiumSpot}>
                      <Text style={[styles.podiumMedalBig, styles.podiumMedalFirst]}>🥇</Text>
                      <View style={[styles.podiumBar, styles.podiumFirst]}>
                        <Text style={styles.podiumCount}>{primi[0].allenamenti}</Text>
                        <Text style={styles.podiumCountLabel}>allenam.</Text>
                      </View>
                      <View style={styles.podiumNames}>
                        {primi.map((p, i) => (
                          <Text key={i} style={[styles.podiumName, p.is_me && styles.podiumNameMe]} numberOfLines={1}>
                            {p.nome}
                          </Text>
                        ))}
                      </View>
                      <Text style={styles.podiumPos}>1°</Text>
                    </View>
                  );
                })()}
                
                {/* 3° posto - tutti i terzi */}
                {(() => {
                  const terzi = leaderboard.filter(e => e.posizione === 3);
                  if (terzi.length === 0) return null;
                  return (
                    <View style={styles.podiumSpot}>
                      <Text style={styles.podiumMedalBig}>🥉</Text>
                      <View style={[styles.podiumBar, styles.podiumThird]}>
                        <Text style={styles.podiumCount}>{terzi[0].allenamenti}</Text>
                        <Text style={styles.podiumCountLabel}>allenam.</Text>
                      </View>
                      <View style={styles.podiumNames}>
                        {terzi.map((t, i) => (
                          <Text key={i} style={[styles.podiumName, t.is_me && styles.podiumNameMe]} numberOfLines={1}>
                            {t.nome}
                          </Text>
                        ))}
                      </View>
                      <Text style={styles.podiumPos}>3°</Text>
                    </View>
                  );
                })()}
              </View>
            </View>

            {/* Classifica completa - solo podio (1°, 2°, 3°) */}
            <View style={styles.fullLeaderboard}>
              <Text style={styles.fullLeaderboardTitle}>📊 CLASSIFICA COMPLETA</Text>
              {[1, 2, 3].map((pos) => {
                const entriesAtPos = leaderboard.filter(e => e.posizione === pos);
                if (entriesAtPos.length === 0) return null;
                return (
                  <View key={pos} style={styles.positionGroup}>
                    {entriesAtPos.map((entry, idx) => (
                      <View 
                        key={`${pos}-${idx}`}
                        style={[
                          styles.leaderboardRow,
                          entry.is_me && styles.leaderboardRowMe,
                          pos === 1 && styles.leaderboardRowFirst,
                        ]}
                      >
                        <View style={styles.leaderboardLeft}>
                          <Text style={[styles.leaderboardPos, pos <= 3 && styles.leaderboardPosMedal]}>
                            {pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉'}
                          </Text>
                          <View>
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                              <Text style={[styles.leaderboardName, entry.is_me && styles.leaderboardNameMe]}>
                                {entry.nome} {entry.is_me && '(Tu)'}
                              </Text>
                              {entry.pari_merito && (
                                <Text style={styles.pariMeritoBadge}>PARI</Text>
                              )}
                            </View>
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
                );
              })}
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
            <Text style={styles.emptyIcon}>⏳</Text>
            <Text style={styles.emptyTitle}>Classifica in arrivo!</Text>
            <Text style={styles.emptyText}>
              La classifica della settimana {settimana} verrà pubblicata sabato dopo le lezioni di yoga.
              {'\n\n'}Allenati e conquista il podio! 💪
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>
            La classifica viene pubblicata sabato dopo le lezioni di yoga. In caso di parità, vince chi ha raggiunto quel numero di allenamenti per primo!
          </Text>
        </View>

        {/* Spiegazione regole */}
        <View style={styles.rulesBox}>
          <Text style={styles.rulesTitle}>📜 COME FUNZIONA</Text>
          <View style={styles.ruleItem}>
            <Text style={styles.ruleBullet}>🗓️</Text>
            <Text style={styles.ruleText}>La classifica conta gli allenamenti da Lunedì a Sabato</Text>
          </View>
          <View style={styles.ruleItem}>
            <Text style={styles.ruleBullet}>✅</Text>
            <Text style={styles.ruleText}>Vengono contate SOLO le lezioni effettivamente svolte</Text>
          </View>
          <View style={styles.ruleItem}>
            <Text style={styles.ruleBullet}>🏆</Text>
            <Text style={styles.ruleText}>La classifica viene pubblicata sabato dopo lo yoga</Text>
          </View>
          <View style={styles.ruleItem}>
            <Text style={styles.ruleBullet}>⚖️</Text>
            <Text style={styles.ruleText}>In caso di parità, vince chi ha raggiunto quel numero di allenamenti PRIMA</Text>
          </View>
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
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  winnerNameMe: {
    color: COLORS.gold,
  },
  winnersNames: {
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  winnerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 8,
  },
  winnerNameStar: {
    fontSize: 20,
  },
  winnerYouTag: {
    fontSize: 14,
    color: COLORS.gold,
    fontWeight: 'bold',
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
    maxWidth: 110,
  },
  podiumMedalBig: {
    fontSize: 48,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  podiumMedalFirst: {
    fontSize: 56,
  },
  podiumBar: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  podiumFirst: {
    backgroundColor: COLORS.gold,
    height: 90,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  podiumSecond: {
    backgroundColor: COLORS.silver,
    height: 70,
  },
  podiumThird: {
    backgroundColor: COLORS.bronze,
    height: 60,
  },
  podiumMedal: {
    fontSize: 28,
  },
  podiumCount: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.background,
  },
  podiumCountLabel: {
    fontSize: 10,
    color: COLORS.background,
    opacity: 0.8,
    marginTop: 2,
  },
  podiumName: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
  podiumNames: {
    marginTop: 8,
    alignItems: 'center',
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
  positionGroup: {
    marginBottom: 4,
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
  leaderboardPosMedal: {
    fontSize: 20,
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
  pariMeritoBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
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

  // Regole
  rulesBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  rulesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gold,
    textAlign: 'center',
    marginBottom: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  ruleBullet: {
    fontSize: 14,
    width: 24,
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});