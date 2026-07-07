import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';
import { apiService } from '../services/api';
import { SummerSilhouettes } from './SummerSilhouettes';
import { PushNotificationButton } from './PushNotificationButton';

/**
 * Gate per i nuovi iscritti: blocca completamente la navigazione finché
 * l'utente non attiva la sua settimana di prova gratuita.
 *
 * Si attiva solo se:
 *  - L'utente NON ha mai avuto un abbonamento (subscriptions_count = 0)
 *  - E non ha un prova_attiva legacy
 *
 * Dopo l'attivazione il gate si chiude e l'app diventa navigabile.
 */
export const WelcomeGate: React.FC<{
  enabled: boolean;
  onActivated: () => void;
  userNome?: string;
}> = ({ enabled, onActivated, userNome }) => {
  const [status, setStatus] = useState<'checking' | 'show' | 'hidden'>('checking');
  const [activating, setActivating] = useState(false);
  const [nome, setNome] = useState(userNome || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!enabled) {
      setStatus('hidden');
      return () => { mounted = false; };
    }
    (async () => {
      try {
        const res = await apiService.onboardingStatus();
        if (!mounted) return;
        if (res.data.is_brand_new && res.data.can_self_activate_trial) {
          setNome(res.data.user_nome || '');
          setStatus('show');
        } else {
          setStatus('hidden');
        }
      } catch {
        if (mounted) setStatus('hidden');
      }
    })();
    return () => { mounted = false; };
  }, [enabled]);

  const activate = async () => {
    setActivating(true);
    setError(null);
    try {
      await apiService.selfActivateTrial();
      setStatus('hidden');
      onActivated();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore. Riprova.');
    } finally {
      setActivating(false);
    }
  };

  if (status !== 'show') return null;

  return (
    <View style={styles.fullscreen}>
      <SafeAreaView style={styles.safe}>
        <SummerSilhouettes variant="login" />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.iconCircle}>
              <Ionicons name="gift" size={48} color="#FFEA00" />
            </View>
            <Text style={styles.kicker}>BENVENUTO IN DANO FITNESS</Text>
            <Text style={styles.title}>
              CIAO{nome ? `, ${nome.toUpperCase()}` : ''}!{'\n'}
              <Text style={styles.titleAccent}>HAI UN REGALO</Text>
            </Text>
            <View style={styles.accentBar} />
          </View>

          {/* Box descrizione */}
          <View style={styles.descBox}>
            <Text style={styles.descTitle}>🎁 7 GIORNI DI PROVA GRATIS</Text>
            <Text style={styles.descText}>
              Cliccando il pulsante qui sotto attiverai la tua{' '}
              <Text style={styles.bold}>settimana di prova gratuita</Text>.
              {'\n\n'}
              Per 7 giorni potrai{' '}
              <Text style={styles.bold}>prenotare TUTTE le lezioni che vuoi</Text>{' '}
              — workout funzionale, circuito, pilates, lezioni in piscina al camping. Senza limiti.
            </Text>

            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#39FF14" />
              <Text style={styles.featureText}>Accesso a tutte le lezioni</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#39FF14" />
              <Text style={styles.featureText}>Prenotazioni illimitate</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#39FF14" />
              <Text style={styles.featureText}>Nessun pagamento richiesto</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#39FF14" />
              <Text style={styles.featureText}>Annulli quando vuoi</Text>
            </View>
          </View>

          {/* Disclaimer */}
          <View style={styles.warnBox}>
            <Ionicons name="information-circle-outline" size={18} color="#FFEA00" />
            <Text style={styles.warnText}>
              Una volta attivata, la prova parte SUBITO e dura 7 giorni esatti.
              Potrai accedere all'app solo dopo l'attivazione.
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#FF4D6D" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            onPress={activate}
            disabled={activating}
            activeOpacity={0.88}
            testID="welcome-activate-trial"
            style={[styles.cta, activating && { opacity: 0.5 }]}
          >
            {activating ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="play-circle" size={26} color="#000" />
                <Text style={styles.ctaText}>ATTIVA SETTIMANA DI PROVA</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Push Notifications activation (opzionale, così il nuovo cliente non si perde gli avvisi) */}
          <View style={styles.pushSection}>
            <View style={styles.pushIntroRow}>
              <Ionicons name="notifications-outline" size={18} color={COLORS.primary} />
              <Text style={styles.pushIntroText}>
                Attiva le notifiche per non perderti orari, cambi lezione e vincite alla lotteria!
              </Text>
            </View>
            <PushNotificationButton />
          </View>

          <Text style={styles.footer}>
            Hai dubbi? Scrivi a Daniele su WhatsApp{Platform.OS === 'web' ? ' · ' : '\n'}339 502 0625
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default WelcomeGate;

const styles = StyleSheet.create({
  fullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    zIndex: 9999,
  },
  safe: { flex: 1 },
  scroll: { padding: 22, paddingBottom: 80, alignItems: 'center' },
  hero: {
    alignItems: 'center',
    marginBottom: 22,
    marginTop: 10,
    width: '100%',
    maxWidth: 480,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,234,0,0.15)',
    borderWidth: 3,
    borderColor: '#FFEA00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#FFEA00',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  kicker: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 13,
    color: '#00C8FF',
    letterSpacing: 3,
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 38,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 1.5,
    lineHeight: 42,
  },
  titleAccent: {
    color: '#FFEA00',
  },
  accentBar: {
    width: 60,
    height: 4,
    backgroundColor: '#FF1493',
    borderRadius: 2,
    marginTop: 14,
  },

  descBox: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  descTitle: {
    fontFamily: FONTS.headline,
    fontSize: 20,
    color: '#FFEA00',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
  },
  descText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 14,
  },
  bold: {
    fontFamily: FONTS.bodyBlack,
    color: '#00C8FF',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  featureText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },

  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 480,
    backgroundColor: 'rgba(255,234,0,0.1)',
    borderWidth: 1,
    borderColor: '#FFEA00',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warnText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 480,
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
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFEA00',
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#FFEA00',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 16,
    color: '#000',
    letterSpacing: 1.8,
  },
  footer: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 18,
    textAlign: 'center',
    lineHeight: 18,
  },
  pushSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  pushIntroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  pushIntroText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
});
