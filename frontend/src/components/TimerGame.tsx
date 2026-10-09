import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image,
  ActivityIndicator, Animated, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import { FONTS } from '../theme';
import { ConfettiBurst } from './ConfettiBurst';

const LOGO = require('../../assets/images/logo.jpg');

type TimerStatus = {
  can_play: boolean;
  reason?: string;
  last_elapsed_ms?: number;
  last_vinto?: boolean;
  message: string;
};

type PlayResult = {
  vinto: boolean;
  elapsed_ms: number;
  biglietti_vinti: number;
  message: string;
};

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
};

export const TimerGameSection: React.FC<{ onPlayed?: () => void }> = ({ onPlayed }) => {
  const [status, setStatus] = useState<TimerStatus | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    apiService.getTimerGameStatus().then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <TouchableOpacity
        style={[styles.card, status?.can_play && styles.cardActive]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        testID="timer-game-card"
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>⏱️ STOP AL 10</Text>
          {status?.can_play && (
            <View style={styles.playBadge}>
              <Text style={styles.playBadgeText}>GIOCA ORA</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardDemo}>10.00</Text>
        <Text style={styles.cardSub}>
          {status?.can_play
            ? 'Ferma il cronometro a 10.00 e vinci 3 biglietti! 🎟️'
            : status?.reason === 'already_played'
              ? `Oggi hai fatto ${fmt(status.last_elapsed_ms || 0)}${status.last_vinto ? ' — VINTO! 🎉' : ''} · Riprova domani`
              : 'Completa un allenamento per sbloccare 💪'}
        </Text>
      </TouchableOpacity>

      {open && (
        <TimerGameScreen
          status={status}
          onClose={(played) => {
            setOpen(false);
            if (played) {
              load();
              onPlayed?.();
            }
          }}
        />
      )}
    </>
  );
};

const TimerGameScreen: React.FC<{ status: TimerStatus | null; onClose: (played: boolean) => void }> = ({ status, onClose }) => {
  const [phase, setPhase] = useState<'idle' | 'running' | 'result'>('idle');
  const [display, setDisplay] = useState('00.00');
  const [result, setResult] = useState<PlayResult | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [sending, setSending] = useState(false);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const canPlay = !!status?.can_play;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
      ])
    );
    if (phase === 'idle' && canPlay) loop.start();
    return () => loop.stop();
  }, [phase, canPlay, pulse]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const tick = useCallback(() => {
    const el = performance.now() - startRef.current;
    setDisplay(fmt(el));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = () => {
    if (!canPlay || phase !== 'idle') return;
    startRef.current = performance.now();
    setPhase('running');
    rafRef.current = requestAnimationFrame(tick);
  };

  const stop = async () => {
    if (phase !== 'running' || sending) return;
    const elapsed = Math.round(performance.now() - startRef.current);
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    setDisplay(fmt(elapsed));
    setSending(true);
    try {
      const res = await apiService.playTimerGame(elapsed);
      setResult(res.data);
      setPhase('result');
      if (res.data.vinto) setConfetti((c) => c + 1);
    } catch (e: any) {
      setResult({ vinto: false, elapsed_ms: elapsed, biglietti_vinti: 0, message: e?.response?.data?.detail || 'Errore, riprova' });
      setPhase('result');
    }
    setSending(false);
  };

  const vicino = result && !result.vinto && Math.abs(result.elapsed_ms - 10000) <= 500;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => onClose(phase === 'result')}>
      <View style={styles.screen} testID="timer-game-screen">
        <ConfettiBurst trigger={confetti} />

        <TouchableOpacity style={styles.closeBtn} onPress={() => onClose(phase === 'result')} testID="timer-game-close">
          <Ionicons name="close" size={30} color="#888" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>STOP AL 10</Text>
          <Text style={styles.target}>FERMA IL CRONOMETRO A <Text style={styles.targetNum}>10.00</Text></Text>

          <View style={[styles.displayBox, phase === 'result' && (result?.vinto ? styles.displayWin : styles.displayLose)]}>
            <Text
              style={[
                styles.display,
                phase === 'result' && (result?.vinto ? styles.displayTextWin : styles.displayTextLose),
              ]}
              testID="timer-display"
            >
              {display}
            </Text>
          </View>

          {phase === 'result' && result && (
            <View style={[styles.resultBox, result.vinto ? styles.resultBoxWin : styles.resultBoxLose]} testID="timer-result">
              <Text style={[styles.resultText, { color: result.vinto ? '#39FF14' : vicino ? '#FF9800' : '#FF4D6D' }]}>
                {result.vinto ? 'PERFETTO! +3 BIGLIETTI 🎟️' : result.message}
              </Text>
            </View>
          )}

          {phase !== 'result' ? (
            <Animated.View style={{ transform: [{ scale: phase === 'idle' ? pulse : 1 }] }}>
              <TouchableOpacity
                style={[styles.bigBtn, phase === 'running' && styles.bigBtnStop, !canPlay && styles.bigBtnDisabled]}
                onPress={phase === 'idle' ? start : stop}
                disabled={!canPlay || sending}
                activeOpacity={0.85}
                testID="timer-game-btn"
              >
                <Image source={LOGO} style={styles.btnLogo} />
                <View style={styles.btnOverlay}>
                  {sending ? (
                    <ActivityIndicator color="#fff" size="large" />
                  ) : (
                    <Text style={styles.btnText}>{phase === 'idle' ? 'START' : 'STOP'}</Text>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity style={styles.doneBtn} onPress={() => onClose(true)} testID="timer-game-done">
              <Text style={styles.doneBtnText}>{result?.vinto ? 'GRANDE! 🎉' : 'A DOMANI 💪'}</Text>
            </TouchableOpacity>
          )}

          {!canPlay && phase === 'idle' && (
            <Text style={styles.lockedText}>{status?.message}</Text>
          )}

          <View style={styles.rulesBox}>
            <Text style={styles.rulesTitle}>📋 REGOLAMENTO</Text>
            <Text style={styles.ruleRow}>1️⃣  Completa un allenamento per sbloccare la giocata</Text>
            <Text style={styles.ruleRow}>2️⃣  Hai <Text style={styles.ruleBold}>1 tentativo al giorno</Text></Text>
            <Text style={styles.ruleRow}>3️⃣  Premi START, poi STOP più vicino possibile a <Text style={styles.ruleBold}>10.00</Text></Text>
            <Text style={styles.ruleRow}>4️⃣  Se ti fermi tra <Text style={styles.ruleBold}>9.99 e 10.01</Text> vinci <Text style={styles.ruleBold}>3 BIGLIETTI LOTTERIA 🎟️</Text></Text>
            <Text style={styles.ruleRow}>5️⃣  Niente conto alla rovescia sullo schermo: conta nella tua testa! 🧠</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0E0E13',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,59,48,0.35)',
    padding: 18,
    marginBottom: 16,
  },
  cardActive: {
    borderColor: '#FF3B30',
    ...Platform.select({ web: { boxShadow: '0 0 18px rgba(255,59,48,0.4)' }, default: {} }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: FONTS.headline,
    fontSize: 24,
    color: '#fff',
    letterSpacing: 1.5,
  },
  playBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  playBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  cardDemo: {
    fontFamily: FONTS.headline,
    fontSize: 54,
    color: '#FF3B30',
    textAlign: 'center',
    letterSpacing: 4,
    marginVertical: 6,
    ...Platform.select({ web: { textShadow: '0 0 16px rgba(255,59,48,0.7)' }, default: {} }),
  },
  cardSub: {
    fontSize: 13,
    color: '#A0A0B0',
    textAlign: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: '#07070A',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 60,
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 18,
    zIndex: 10,
    padding: 6,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 44,
    color: '#fff',
    letterSpacing: 3,
  },
  target: {
    fontSize: 13,
    fontWeight: '800',
    color: '#A0A0B0',
    letterSpacing: 1.5,
    marginTop: 4,
    marginBottom: 22,
  },
  targetNum: {
    color: '#FF3B30',
    fontWeight: '900',
  },
  displayBox: {
    alignSelf: 'stretch',
    backgroundColor: '#0E0E13',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,59,48,0.5)',
    paddingVertical: 26,
    alignItems: 'center',
    ...Platform.select({ web: { boxShadow: '0 0 30px rgba(255,59,48,0.25) inset, 0 0 22px rgba(255,59,48,0.25)' }, default: {} }),
  },
  displayWin: {
    borderColor: '#39FF14',
    ...Platform.select({ web: { boxShadow: '0 0 30px rgba(57,255,20,0.35)' }, default: {} }),
  },
  displayLose: {
    borderColor: '#FF4D6D',
  },
  display: {
    fontFamily: FONTS.headline,
    fontSize: 104,
    color: '#FF3B30',
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
    ...Platform.select({ web: { textShadow: '0 0 26px rgba(255,59,48,0.8)' }, default: {} }),
  },
  displayTextWin: {
    color: '#39FF14',
    ...Platform.select({ web: { textShadow: '0 0 26px rgba(57,255,20,0.8)' }, default: {} }),
  },
  displayTextLose: {
    color: '#FF4D6D',
  },
  resultBox: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  resultBoxWin: {
    borderColor: '#39FF14',
    backgroundColor: 'rgba(57,255,20,0.08)',
  },
  resultBoxLose: {
    borderColor: 'rgba(255,77,109,0.5)',
    backgroundColor: 'rgba(255,77,109,0.07)',
  },
  resultText: {
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  bigBtn: {
    width: 170,
    height: 170,
    borderRadius: 85,
    marginTop: 30,
    borderWidth: 4,
    borderColor: '#FF3B30',
    overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 0 34px rgba(255,59,48,0.55)' }, default: {} }),
  },
  bigBtnStop: {
    borderColor: '#FFD700',
    ...Platform.select({ web: { boxShadow: '0 0 40px rgba(255,215,0,0.6)' }, default: {} }),
  },
  bigBtnDisabled: {
    opacity: 0.35,
  },
  btnLogo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  btnOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontFamily: FONTS.headline,
    fontSize: 42,
    color: '#fff',
    letterSpacing: 3,
    ...Platform.select({ web: { textShadow: '0 2px 10px rgba(0,0,0,0.9)' }, default: {} }),
  },
  doneBtn: {
    marginTop: 30,
    backgroundColor: '#FF3B30',
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 44,
  },
  doneBtnText: {
    fontFamily: FONTS.headline,
    fontSize: 22,
    color: '#fff',
    letterSpacing: 2,
  },
  lockedText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '700',
    color: '#FF9800',
    textAlign: 'center',
  },
  rulesBox: {
    alignSelf: 'stretch',
    backgroundColor: '#0E0E13',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    marginTop: 34,
  },
  rulesTitle: {
    fontFamily: FONTS.headline,
    fontSize: 18,
    color: '#fff',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  ruleRow: {
    fontSize: 13,
    color: '#A0A0B0',
    lineHeight: 22,
    marginBottom: 4,
  },
  ruleBold: {
    color: '#fff',
    fontWeight: '900',
  },
});
