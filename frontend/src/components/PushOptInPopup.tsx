import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isPushSupported, subscribeToPush } from '../utils/pushSubscribe';

/**
 * Popup mostrato all'apertura dell'app agli utenti ESISTENTI che non hanno
 * ancora attivato le notifiche push.
 *
 * Regole di visualizzazione:
 * - Solo su web con supporto push (service worker + PushManager + Notification)
 * - NON appare se le notifiche sono già attive (check backend /push/status)
 * - NON appare se l'utente ha bloccato le notifiche dal browser (denied)
 * - NON appare ai nuovissimi iscritti che vedono il WelcomeGate (hanno già il pulsante lì)
 * - Se chiuso senza attivare, riappare al massimo UNA volta al giorno (localStorage)
 */

const STORAGE_KEY = 'push_optin_dismissed_date';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dismissedToday(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === todayStr();
  } catch {
    return false;
  }
}

function markDismissedToday() {
  try {
    window.localStorage.setItem(STORAGE_KEY, todayStr());
  } catch {
    /* noop */
  }
}

export const PushOptInPopup: React.FC = () => {
  const { isAdmin, isIstruttore } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isPushSupported()) return;
    try {
      if (Notification.permission === 'denied') return;
    } catch {
      return;
    }
    if (dismissedToday()) return;

    let cancelled = false;
    (async () => {
      try {
        // Non mostrare a chi ha già le notifiche attive
        const pushRes = await apiService.getPushStatus();
        if (cancelled || pushRes.data.subscribed) return;

        // Non mostrare ai nuovissimi iscritti: vedono già il pulsante nel WelcomeGate.
        // (Admin e istruttori non passano dal WelcomeGate, quindi per loro si salta il check)
        if (!isAdmin && !isIstruttore) {
          try {
            const onb = await apiService.onboardingStatus();
            if (cancelled) return;
            if (onb.data.is_brand_new && onb.data.can_self_activate_trial) return;
          } catch {
            /* se il check fallisce, mostriamo comunque il popup */
          }
        }

        if (!cancelled) setVisible(true);
      } catch {
        /* utente non loggato o rete KO: non mostriamo nulla */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    markDismissedToday();
    setVisible(false);
  };

  const activate = async () => {
    setLoading(true);
    setError(null);
    const res = await subscribeToPush();
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => setVisible(false), 2200);
    } else if (res.reason === 'denied') {
      // Permesso negato dal prompt del browser: non insistere, riproponi domani
      dismiss();
    } else {
      setError(res.message || 'Impossibile attivare le notifiche. Riprova.');
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="push-optin-popup">
          {!success && (
            <TouchableOpacity
              onPress={dismiss}
              style={styles.closeBtn}
              testID="push-optin-close"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          {success ? (
            <>
              <View style={styles.iconHero}>
                <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
                  <Ionicons name="checkmark-circle" size={48} color="#00E676" />
                </View>
              </View>
              <Text style={[styles.title, { color: '#00E676', textShadowColor: '#00E67699' }]}>
                NOTIFICHE ATTIVE!
              </Text>
              <Text style={styles.successText}>
                Riceverai un avviso sul telefono ad ogni novità di Dano Fitness.
              </Text>
            </>
          ) : (
            <>
              {/* Icona campanella */}
              <View style={styles.iconHero}>
                <View style={styles.iconCircle}>
                  <Ionicons name="notifications" size={44} color="#FF6B00" />
                </View>
              </View>

              <Text style={styles.title}>NON PERDERTI NIENTE!</Text>
              <View style={styles.accentBar} />

              <View style={styles.messageBox}>
                <Text style={styles.message}>
                  Attiva le <Text style={styles.bold}>notifiche push</Text> per ricevere sul tuo
                  telefono tutti gli avvisi: cambi orario, nuove lezioni, lotteria e promozioni.
                  {'\n'}
                  <Text style={styles.bold}>Anche quando l'app è chiusa!</Text>
                </Text>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#FF4D6D" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* CTA principale */}
              <TouchableOpacity
                onPress={activate}
                disabled={loading}
                activeOpacity={0.85}
                testID="push-optin-activate"
                style={[styles.cta, loading && { opacity: 0.6 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="notifications" size={22} color="#000" />
                    <Text style={styles.ctaText}>ATTIVA NOTIFICHE</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Rimanda a domani */}
              <TouchableOpacity
                onPress={dismiss}
                activeOpacity={0.7}
                testID="push-optin-dismiss"
                style={styles.laterBtn}
              >
                <Text style={styles.laterBtnText}>Non ora, ricordamelo domani</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default PushOptInPopup;

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
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FF6B00',
    padding: 20,
    paddingTop: 24,
    position: 'relative',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconHero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: '#FF6B00',
    backgroundColor: 'rgba(255,107,0,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  iconCircleSuccess: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0,230,118,0.10)',
    shadowColor: '#00E676',
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 30,
    color: '#FF6B00',
    textAlign: 'center',
    letterSpacing: 1.8,
    lineHeight: 34,
    marginTop: 8,
    textShadowColor: '#FF6B0099',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  accentBar: {
    width: 50,
    height: 3,
    backgroundColor: '#FF6B00',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
    borderRadius: 2,
  },
  messageBox: {
    backgroundColor: 'rgba(255,107,0,0.10)',
    borderColor: 'rgba(255,107,0,0.45)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
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
    color: '#FF6B00',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,77,109,0.1)',
    borderWidth: 1,
    borderColor: '#FF4D6D',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: '#FF4D6D',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF6B00',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 16,
    color: '#000',
    letterSpacing: 1.4,
  },
  laterBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  laterBtnText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  successText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 6,
  },
});
