import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';

/**
 * Annuncio lezione spostata in piscina — visibile a TUTTI i clienti
 * fino al deadline. Self-dismissing una volta superata l'ora limite.
 *
 * Per disattivare manualmente: setta ENABLED a false o cambia DEADLINE.
 */

// Deadline: oggi alle 20:00 (ora locale del dispositivo, es. Europe/Rome)
const getDeadline = (): Date => {
  const now = new Date();
  const deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
  return deadline;
};

const ENABLED = true;
const STORAGE_KEY_PREFIX = 'acquagym_confirm_dismissed_';

function getTodayKey(): string {
  const d = new Date();
  return `${STORAGE_KEY_PREFIX}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isStillActive(): boolean {
  return ENABLED && new Date() < getDeadline();
}

function readDismissed(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return window.localStorage.getItem(getTodayKey()) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  if (Platform.OS !== 'web') return;
  try {
    window.localStorage.setItem(getTodayKey(), '1');
  } catch {
    /* noop */
  }
}

export const PoolAnnouncementPopup: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isStillActive()) return;
    if (readDismissed()) return;
    const t = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    writeDismissed();
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

          {/* Title */}
          <Text style={styles.kicker}>LEZIONE CONFERMATA</Text>
          <Text style={styles.title}>ACQUAGYM CONFERMATA</Text>
          <View style={styles.accentBar} />

          {/* Messaggio principale */}
          <View style={styles.messageBox}>
            <Text style={styles.message}>
              <Text style={styles.bigText}>VI ASPETTO!</Text>
              {'\n\n'}
              Ci vediamo in <Text style={styles.bold}>piscina</Text> 🌊💪
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
            <Text style={styles.ctaText}>CI SARÒ!</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>Forza ragazzi, si fatica con il sorriso 💙</Text>
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
    fontSize: 28,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 1.5,
    lineHeight: 30,
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
    backgroundColor: 'rgba(255,20,147,0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,20,147,0.25)',
    marginBottom: 16,
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
    fontSize: 22,
    color: '#FF1493',
    letterSpacing: 1,
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
    marginTop: 10,
  },
});
