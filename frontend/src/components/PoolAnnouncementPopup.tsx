import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';

/**
 * Annuncio SPOSTAMENTO lezione di CIRCUITO in piscina — visibile a TUTTI i clienti
 * ad OGNI apertura app fino al deadline (oggi 22:00 ora locale).
 *
 * Il popup si ri-apre ad ogni riapertura dell'app (nessuna persistenza dismissione).
 * Per disattivare manualmente: setta ENABLED a false o cambia DEADLINE.
 */

// Deadline: oggi alle 22:00 (ora locale del dispositivo, es. Europe/Rome)
const getDeadline = (): Date => {
  const now = new Date();
  const deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0);
  return deadline;
};

const ENABLED = true;

function isStillActive(): boolean {
  return ENABLED && new Date() < getDeadline();
}

export const PoolAnnouncementPopup: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isStillActive()) return;
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  // Blink loop: opacity 1 <-> 0.25 ogni ~500ms
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.25, duration: 500, useNativeDriver: false }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, blinkAnim]);

  const close = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="pool-announce-popup">
          {/* Close X */}
          <TouchableOpacity onPress={close} style={styles.closeBtn} testID="pool-announce-close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Hero icon */}
          <View style={styles.iconHero}>
            <View style={styles.iconCircle}>
              <Ionicons name="water" size={48} color="#00C8FF" />
            </View>
          </View>

          {/* Titolo lampeggiante */}
          <Text style={styles.kicker}>AVVISO IMPORTANTE</Text>
          <Animated.Text style={[styles.title, { opacity: blinkAnim }]}>
            CIRCUITO IN PISCINA!
          </Animated.Text>
          <View style={styles.accentBar} />

          {/* Messaggio principale */}
          <View style={styles.messageBox}>
            <Text style={styles.messageIntro}>
              La lezione di <Text style={styles.hlOrange}>CIRCUITO</Text> di stasera si svolgerà
            </Text>
            <Animated.Text style={[styles.bigText, { opacity: blinkAnim }]}>
              PISCINA DEL CAMPEGGIO
            </Animated.Text>
          </View>

          {/* Avviso maltempo */}
          <View style={styles.warningBox}>
            <View style={styles.warningRow}>
              <Ionicons name="rainy-outline" size={18} color="#FFEA00" />
              <Text style={styles.warningTitle}>ATTENZIONE MALTEMPO</Text>
            </View>
            <Text style={styles.warningText}>
              In caso di cambiamenti per maltempo verranno aggiornati
              <Text style={styles.warningBold}> qui in app</Text>.
              {'\n'}
              <Text style={styles.warningBold}>Controllate sempre l'app prima di venire a lezione</Text>.
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={close}
            activeOpacity={0.85}
            testID="pool-announce-ok"
            style={styles.cta}
          >
            <Ionicons name="checkmark-circle" size={22} color="#000" />
            <Text style={styles.ctaText}>OK, CI SARÒ!</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            Grazie 💙{'\n'}
            <Text style={styles.footerSignature}>
              Il Maestro di Vita Don Nascimento Daniele{'\n'}DanoFitness23
            </Text>
          </Text>
        </View>
      </View>
    </Modal>
  );
};

export default PoolAnnouncementPopup;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#00C8FF',
    padding: 20,
    paddingTop: 24,
    position: 'relative',
    shadowColor: '#00C8FF',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconHero: {
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(0,200,255,0.12)',
    borderWidth: 3,
    borderColor: '#00C8FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00C8FF',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  kicker: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 12,
    color: '#FFEA00',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 34,
    color: '#FF6B00',
    textAlign: 'center',
    letterSpacing: 2,
    lineHeight: 38,
    textShadowColor: 'rgba(255,107,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  accentBar: {
    width: 50,
    height: 3,
    backgroundColor: '#FF1493',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 2,
  },
  infoBox: {
    backgroundColor: 'rgba(0,200,255,0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,200,255,0.25)',
    gap: 8,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoTitle: {
    fontFamily: FONTS.headline,
    fontSize: 20,
    color: COLORS.text,
    letterSpacing: 1.2,
  },
  messageBox: {
    backgroundColor: 'rgba(255,107,0,0.10)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.35)',
    marginBottom: 14,
    alignItems: 'center',
  },
  messageIntro: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  hlOrange: {
    fontFamily: FONTS.bodyBlack,
    color: '#FF6B00',
    fontStyle: 'italic',
  },
  message: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  bold: {
    fontFamily: FONTS.bodyBlack,
    color: '#FF1493',
    fontStyle: 'italic',
  },
  bigText: {
    fontFamily: FONTS.headline,
    fontSize: 30,
    color: '#FFEA00',
    letterSpacing: 1.6,
    textAlign: 'center',
    lineHeight: 34,
    textShadowColor: 'rgba(255,234,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  warningBox: {
    backgroundColor: 'rgba(255,234,0,0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,234,0,0.35)',
    marginBottom: 14,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    justifyContent: 'center',
  },
  warningTitle: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 13,
    color: '#FFEA00',
    letterSpacing: 1.4,
  },
  warningText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 19,
  },
  warningBold: {
    fontFamily: FONTS.bodyBlack,
    color: '#FFEA00',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFEA00',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#FFEA00',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 16,
    color: '#000',
    letterSpacing: 1.6,
  },
  footer: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  footerSignature: {
    fontFamily: FONTS.bodyBlack,
    color: '#00C8FF',
    fontStyle: 'italic',
  },
});
