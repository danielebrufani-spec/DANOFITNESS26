import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';

interface StreakStatus {
  settimana: string;
  lunedi: string;
  domenica: string;
  oggi: string;
  streak_corrente: number;
  max_consecutivi: number;
  giorni_allenati: string[];
  bonus_3_dato: boolean;
  bonus_5_dato: boolean;
  biglietti_ottenuti: number;
  prossima_soglia: number | null;
  biglietti_prossima_soglia: number;
  soglia_3: { giorni: number; biglietti: number };
  soglia_5: { giorni: number; biglietti: number };
}

const DAY_LABELS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export const StreakBanner: React.FC = () => {
  const [streak, setStreak] = useState<StreakStatus | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const flameAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    const fetchStreak = async () => {
      try {
        const res = await apiService.getStreakStatus();
        if (mounted) setStreak(res.data);
      } catch {
        /* silent fail: user might not have trained yet */
      }
    };
    fetchStreak();

    // loop subtle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flameAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    return () => {
      mounted = false;
    };
  }, []);

  if (!streak) return null;

  const flameScale = flameAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const flameOpacity = flameAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  // Calcola pallini giorni (Lun-Dom)
  const monday = new Date(streak.lunedi + 'T00:00:00');
  const today = new Date(streak.oggi + 'T00:00:00');
  const trainedSet = new Set(streak.giorni_allenati);

  const dots = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const trained = trainedSet.has(iso);
    const isToday = iso === streak.oggi;
    const isFuture = d > today;
    return { iso, trained, isToday, isFuture, label: DAY_LABELS[i] };
  });

  const soglia3Raggiunta = streak.bonus_3_dato;
  const soglia5Raggiunta = streak.bonus_5_dato;
  const streakColor = soglia5Raggiunta ? '#FF3D00' : soglia3Raggiunta ? '#FF9800' : streak.streak_corrente >= 1 ? '#FFC107' : '#555';

  const progressoVerso = streak.prossima_soglia
    ? Math.min(streak.streak_corrente / streak.prossima_soglia, 1)
    : 1;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShowInfo(true)}
        data-testid="streak-banner-btn"
        style={styles.wrapper}
      >
        <View style={[styles.card, { borderColor: streakColor }]}>
          {/* Left: fiamma e streak */}
          <View style={styles.leftBlock}>
            <Animated.Text
              style={[styles.flame, { transform: [{ scale: flameScale }], opacity: flameOpacity }]}
            >
              🔥
            </Animated.Text>
            <View>
              <Text style={styles.streakValue}>{streak.streak_corrente}</Text>
              <Text style={styles.streakLabel}>
                {streak.streak_corrente === 1 ? 'giorno' : 'giorni'} di fila
              </Text>
            </View>
          </View>

          {/* Right: pallini settimana */}
          <View style={styles.rightBlock}>
            <View style={styles.dotsRow}>
              {dots.map((d, idx) => (
                <View key={idx} style={styles.dotWrapper}>
                  <View
                    style={[
                      styles.dot,
                      d.trained && styles.dotTrained,
                      d.isToday && !d.trained && styles.dotToday,
                      d.isFuture && styles.dotFuture,
                    ]}
                  >
                    {d.trained ? <Text style={styles.dotCheck}>✓</Text> : null}
                  </View>
                  <Text style={[styles.dotLabel, d.isToday && styles.dotLabelToday]}>{d.label}</Text>
                </View>
              ))}
            </View>

            {/* Milestone riga */}
            <View style={styles.milestoneRow}>
              <View style={[styles.milestoneBadge, soglia3Raggiunta && styles.milestoneBadgeDone]}>
                <Text style={styles.milestoneIcon}>🎟️</Text>
                <Text style={styles.milestoneText}>
                  3gg → +{streak.soglia_3.biglietti}
                </Text>
                {soglia3Raggiunta ? <Ionicons name="checkmark-circle" size={14} color="#4ADE80" /> : null}
              </View>
              <View style={[styles.milestoneBadge, soglia5Raggiunta && styles.milestoneBadgeDone]}>
                <Text style={styles.milestoneIcon}>🎟️</Text>
                <Text style={styles.milestoneText}>
                  5gg → +{streak.soglia_5.biglietti}
                </Text>
                {soglia5Raggiunta ? <Ionicons name="checkmark-circle" size={14} color="#4ADE80" /> : null}
              </View>
            </View>

            {/* Progress bar verso prossima soglia */}
            {streak.prossima_soglia ? (
              <View style={styles.progressWrapper}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progressoVerso * 100}%`, backgroundColor: streakColor }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {streak.prossima_soglia - streak.streak_corrente} giorni al prossimo bonus
                </Text>
              </View>
            ) : (
              <View style={styles.maxedOut}>
                <Text style={styles.maxedText}>🏆 BONUS MASSIMO SETTIMANA!</Text>
              </View>
            )}
          </View>

          {/* icona info */}
          <View style={styles.infoIcon}>
            <Ionicons name="information-circle" size={22} color={streakColor} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Modal spiegazione */}
      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔥 BONUS STREAK</Text>
              <TouchableOpacity onPress={() => setShowInfo(false)} data-testid="streak-close-btn">
                <Ionicons name="close-circle" size={28} color="#FF6B6B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>💪 COS'È LA STREAK?</Text>
              <Text style={styles.modalText}>
                La streak è il numero di{' '}
                <Text style={styles.modalBold}>giorni consecutivi</Text> in cui ti alleni nella stessa settimana (Lunedì → Domenica).
              </Text>

              <Text style={styles.modalSectionTitle}>🎟️ I BONUS</Text>
              <View style={styles.bonusRow}>
                <Text style={styles.bonusEmoji}>3️⃣</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bonusTitle}>3 giorni di fila</Text>
                  <Text style={styles.bonusDesc}>+{streak.soglia_3.biglietti} biglietti lotteria bonus 🎟️🎟️🎟️</Text>
                </View>
              </View>
              <View style={styles.bonusRow}>
                <Text style={styles.bonusEmoji}>5️⃣</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bonusTitle}>5 giorni di fila</Text>
                  <Text style={styles.bonusDesc}>+{streak.soglia_5.biglietti} biglietti EXTRA (in aggiunta ai primi 3) 🎟️🎟️🎟️</Text>
                </View>
              </View>

              <Text style={styles.modalSectionTitle}>⚠️ ATTENZIONE</Text>
              <Text style={styles.modalText}>
                • Se <Text style={styles.modalBold}>SALTI UN GIORNO</Text>, la streak si azzera 💥{'\n'}
                • Ogni <Text style={styles.modalBold}>lunedì</Text> si riparte da zero 🔄{'\n'}
                • Il bonus si riceve <Text style={styles.modalBold}>una sola volta a settimana</Text> per ogni soglia
              </Text>

              <Text style={styles.modalSectionTitle}>🧠 ESEMPIO</Text>
              <View style={styles.exampleBox}>
                <Text style={styles.exampleText}>
                  🏋️ Lun + Mar + Mer = <Text style={styles.modalBold}>+{streak.soglia_3.biglietti} biglietti</Text>{'\n'}
                  🏋️ Gio + Ven = <Text style={styles.modalBold}>+{streak.soglia_5.biglietti} biglietti extra</Text>{'\n'}
                  ✅ Totale: <Text style={styles.exampleHighlight}>+{streak.soglia_3.biglietti + streak.soglia_5.biglietti} biglietti lotteria!</Text>
                </Text>
              </View>

              <View style={styles.tipBox}>
                <Ionicons name="bulb" size={18} color="#FFD700" />
                <Text style={styles.tipText}>
                  I biglietti bonus si aggiungono automaticamente alla lotteria del mese 🎰
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowInfo(false)}
              data-testid="streak-ok-btn"
            >
              <Text style={styles.modalCloseText}>HO CAPITO! 💪</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginVertical: 10,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 14,
    borderWidth: 2,
    gap: 12,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  leftBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
    minWidth: 72,
  },
  flame: {
    fontSize: 38,
    marginBottom: 2,
  },
  streakValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFD700',
    textAlign: 'center',
    lineHeight: 34,
  },
  streakLabel: {
    fontSize: 10,
    color: '#aaa',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rightBlock: {
    flex: 1,
    gap: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotWrapper: {
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotTrained: {
    backgroundColor: '#FF6B00',
    borderColor: '#FFD700',
  },
  dotToday: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  dotFuture: {
    opacity: 0.35,
  },
  dotCheck: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  dotLabel: {
    fontSize: 9,
    color: '#888',
    fontWeight: '700',
  },
  dotLabelToday: {
    color: '#FFD700',
  },
  milestoneRow: {
    flexDirection: 'row',
    gap: 6,
  },
  milestoneBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  milestoneBadgeDone: {
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  milestoneIcon: {
    fontSize: 10,
  },
  milestoneText: {
    fontSize: 10,
    color: '#ddd',
    fontWeight: '700',
  },
  progressWrapper: {
    gap: 3,
  },
  progressBar: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 10,
    color: '#aaa',
    fontStyle: 'italic',
  },
  maxedOut: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  maxedText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  infoIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 1.2,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FF9800',
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  modalText: {
    fontSize: 14,
    color: '#ddd',
    lineHeight: 20,
  },
  modalBold: {
    fontWeight: '800',
    color: '#fff',
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,107,0,0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.3)',
  },
  bonusEmoji: {
    fontSize: 28,
  },
  bonusTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  bonusDesc: {
    fontSize: 12,
    color: '#FFD700',
    marginTop: 2,
  },
  exampleBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FFD700',
  },
  exampleText: {
    color: '#ddd',
    fontSize: 13,
    lineHeight: 22,
  },
  exampleHighlight: {
    color: '#FFD700',
    fontWeight: '900',
  },
  tipBox: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,215,0,0.1)',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tipText: {
    flex: 1,
    color: '#FFD700',
    fontSize: 12,
    fontStyle: 'italic',
  },
  modalCloseBtn: {
    marginTop: 14,
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1.2,
  },
});
