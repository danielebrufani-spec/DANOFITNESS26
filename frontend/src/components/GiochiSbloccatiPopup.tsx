import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { apiService } from '../services/api';
import { FONTS } from '../theme';
import { requestPopup, releasePopup } from '../utils/popupQueue';

const KEY = 'giochi_popup_date';

type StatoGiochi = {
  allenamento_oggi: boolean;
  ruota: boolean;
  quiz: boolean;
  crono: boolean;
  disponibili: number;
};

export const GiochiSbloccatiPopup: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [stato, setStato] = useState<StatoGiochi | null>(null);
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      try {
        const oggi = new Date().toISOString().slice(0, 10);
        if (Platform.OS === 'web') {
          try {
            if (window.localStorage.getItem(KEY) === oggi) return;
          } catch {}
        }
        const r = await apiService.getGiochiOggi();
        const d: StatoGiochi = r.data;
        if (d.allenamento_oggi && d.disponibili > 0) {
          setStato(d);
          requestPopup('giochi-sbloccati', () => setVisible(true));
        }
      } catch {}
    };
    check();
  }, []);

  const chiudi = () => {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(KEY, new Date().toISOString().slice(0, 10)); } catch {}
    }
    setVisible(false);
    releasePopup('giochi-sbloccati');
  };

  const gioca = () => {
    chiudi();
    router.push('/premi');
  };

  if (!visible || !stato) return null;

  const giochi = [
    { key: 'ruota', emoji: '🎰', nome: 'RUOTA DELLA FORTUNA', desc: 'Gira la ruota e vinci premi e biglietti', disp: stato.ruota },
    { key: 'quiz', emoji: '🧠', nome: 'QUIZ BONUS', desc: 'Rispondi giusto e raddoppia la vincita', disp: stato.quiz },
    { key: 'crono', emoji: '⏱️', nome: 'CRONO — STOP AL 10', desc: 'Ferma il cronometro a 10.00 → 3 biglietti', disp: stato.crono },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={chiudi}>
      <View style={styles.overlay}>
        <View style={styles.card} data-testid="giochi-sbloccati-popup">
          <Text style={styles.festa}>🎉</Text>
          <Text style={styles.title}>GIOCHI SBLOCCATI!</Text>
          <Text style={styles.subtitle}>
            Allenamento completato! 💪{'\n'}Ora gioca e vinci biglietti per la lotteria 🎟️
          </Text>

          <View style={styles.lista}>
            {giochi.map((g) => (
              <View key={g.key} style={[styles.gameRow, !g.disp && styles.gameRowDone]} data-testid={`giochi-popup-row-${g.key}`}>
                <Text style={styles.gameEmoji}>{g.emoji}</Text>
                <View style={styles.gameInfo}>
                  <Text style={styles.gameNome}>{g.nome}</Text>
                  <Text style={styles.gameDesc}>{g.desc}</Text>
                </View>
                {g.disp ? (
                  <View style={styles.badgeDisp}><Text style={styles.badgeDispText}>GIOCA</Text></View>
                ) : (
                  <Text style={styles.badgeFatto}>✓</Text>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.playBtn} onPress={gioca} data-testid="giochi-popup-play-btn">
            <Text style={styles.playBtnText}>🎮 GIOCA ORA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterBtn} onPress={chiudi} data-testid="giochi-popup-later-btn">
            <Text style={styles.laterBtnText}>Più tardi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#131316',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  festa: { fontSize: 44, marginBottom: 4 },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 26,
    color: '#FFD700',
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#D7D7DC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 18,
  },
  lista: { width: '100%', gap: 10, marginBottom: 20 },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    padding: 12,
    gap: 12,
  },
  gameRowDone: { opacity: 0.45, borderColor: 'rgba(255,255,255,0.1)' },
  gameEmoji: { fontSize: 28 },
  gameInfo: { flex: 1 },
  gameNome: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  gameDesc: { color: '#9B9BA3', fontSize: 11.5, marginTop: 2 },
  badgeDisp: {
    backgroundColor: '#E0252F',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeDispText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  badgeFatto: { color: '#3DD56D', fontSize: 18, fontWeight: '900' },
  playBtn: {
    width: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  playBtnText: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  laterBtn: { marginTop: 10, paddingVertical: 8 },
  laterBtnText: { color: '#9B9BA3', fontSize: 13 },
});
