import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FONTS } from '../theme';
import { requestPopup, releasePopup } from '../utils/popupQueue';

const DANIELE_WA = '393395020625';

export const QuotaDaSaldarePopup: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const check = async () => {
      try {
        const r = await apiService.getMySubscriptions();
        const insoluto = (r.data || []).some((s: any) => s.attivo && s.pagato === false);
        if (insoluto) {
          requestPopup('quota-da-saldare', () => setVisible(true));
        }
      } catch {}
    };
    check();
  }, []);

  const chiudi = () => {
    setVisible(false);
    releasePopup('quota-da-saldare');
  };

  const avvisaDaniele = () => {
    if (Platform.OS === 'web') {
      const msg = `Ciao Daniele! Sono ${user?.nome || ''} ${user?.cognome || ''} — mi appare l'avviso "quota da saldare" ma ho già pagato. Puoi verificare la mia posizione? Grazie! 🙏`;
      window.open(`https://wa.me/${DANIELE_WA}?text=${encodeURIComponent(msg)}`, '_blank');
    }
    chiudi();
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={chiudi}>
      <View style={styles.overlay}>
        <View style={styles.card} data-testid="quota-da-saldare-popup">
          <Text style={styles.emoji}>💳</Text>
          <Text style={styles.title}>PROMEMORIA QUOTA</Text>
          <Text style={styles.body}>
            Ciao {user?.nome || ''}! 👋{'\n\n'}
            Una piccola nota gentile: risulta che il tuo abbonamento sia <Text style={styles.bold}>ancora da saldare</Text>.{'\n\n'}
            Quando passi in palestra, ricordati di sistemare la quota con Daniele — nessuna fretta, ma così restiamo in regola! 🙏
          </Text>
          <View style={styles.divider} />
          <Text style={styles.body}>
            <Text style={styles.bold}>Hai già pagato?</Text> Allora ci scusiamo per la svista! 🙈 Faccelo sapere con un messaggio così sistemiamo subito la tua posizione e correggiamo l'errore.
          </Text>
          <Text style={styles.footer}>Grazie di cuore e buon allenamento! 💪</Text>
          <TouchableOpacity style={styles.waBtn} onPress={avvisaDaniele} data-testid="quota-popup-wa-btn">
            <Text style={styles.waBtnText}>📲 HO GIÀ PAGATO — AVVISA DANIELE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.okBtn} onPress={chiudi} data-testid="quota-popup-chiudi-btn">
            <Text style={styles.okBtnText}>OK, PROVVEDO APPENA PASSO</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#131316',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FF6B2C',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#FF6B2C',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  emoji: { fontSize: 46, marginBottom: 4 },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 24,
    color: '#FF6B2C',
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: { color: '#E8E2D5', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  bold: { fontWeight: '900', color: '#FFF' },
  divider: {
    width: '60%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 14,
  },
  footer: { color: '#9B9BA3', fontSize: 13, marginTop: 12, marginBottom: 18, textAlign: 'center' },
  waBtn: {
    width: '100%',
    backgroundColor: '#25D366',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  waBtnText: { color: '#FFF', fontSize: 13.5, fontWeight: '900', letterSpacing: 0.5 },
  okBtn: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  okBtnText: { color: '#D7D7DC', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
});
