import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';
import { apiService } from '../services/api';
import { isPushSupported, subscribeToPush } from '../utils/pushSubscribe';

/**
 * Pulsante per attivare/disattivare le Web Push Notifications.
 * Funziona solo su Web (React Native Web + browser support).
 * Su iOS Safari le push funzionano solo se l'app è stata installata su Home Screen (iOS 16.4+).
 */

type PermState = 'default' | 'granted' | 'denied' | 'unsupported';

export const PushNotificationButton: React.FC = () => {
  const [permission, setPermission] = useState<PermState>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Stabilizza il check di supporto una sola volta
  const [isSupported] = useState<boolean>(() => isPushSupported());

  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      return;
    }
    try {
      const perm = Notification.permission as PermState;
      setPermission(perm);
    } catch {
      /* noop */
    }
    // Verifica se già subscribed via backend (best effort, non blocca la UI)
    apiService.getPushStatus()
      .then((res) => setSubscribed(!!res.data.subscribed))
      .catch(() => setSubscribed(false));
  }, [isSupported]);

  const subscribe = async () => {
    if (!isSupported) return;
    setLoading(true);
    const res = await subscribeToPush();
    setLoading(false);
    try {
      setPermission(Notification.permission as PermState);
    } catch {
      /* noop */
    }
    if (res.ok) {
      setSubscribed(true);
      alertFn('Attive!', 'Riceverai una notifica sul telefono ad ogni nuovo avviso pubblicato.');
    } else if (res.reason === 'denied') {
      alertFn('Permesso negato', 'Per ricevere le notifiche devi consentirle dal browser.');
    } else {
      alertFn('Errore', res.message || 'Impossibile attivare le notifiche.');
    }
  };

  const unsubscribe = async () => {
    if (!isSupported) return;
    try {
      setLoading(true);
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const json = sub.toJSON();
        await apiService.pushUnsubscribe({
          endpoint: json.endpoint || '',
          keys: {
            p256dh: json.keys?.p256dh || '',
            auth: json.keys?.auth || '',
          },
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      alertFn('Disattivate', 'Non riceverai più notifiche sul telefono.');
    } catch (e: any) {
      alertFn('Errore', e?.message || 'Impossibile disattivare');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <View style={[styles.card, { borderColor: COLORS.border }]} testID="push-btn-unsupported">
        <View style={styles.row}>
          <Ionicons name="notifications-off-outline" size={20} color={COLORS.textSecondary} />
          <Text style={[styles.title, { color: COLORS.textSecondary }]}>Notifiche non supportate</Text>
        </View>
        <Text style={styles.sub}>
          Il tuo browser/dispositivo non supporta le notifiche push. Su iPhone, aggiungi l'app alla schermata Home da Safari (iOS 16.4+).
        </Text>
      </View>
    );
  }

  if (permission === 'denied') {
    return (
      <View style={[styles.card, { borderColor: '#B00020' }]} testID="push-btn-denied">
        <View style={styles.row}>
          <Ionicons name="notifications-off" size={20} color="#B00020" />
          <Text style={[styles.title, { color: '#B00020' }]}>Notifiche bloccate</Text>
        </View>
        <Text style={styles.sub}>
          Hai negato le notifiche dal browser. Per riattivarle: apri le impostazioni del sito, autorizza le notifiche, poi ricarica la pagina.
        </Text>
      </View>
    );
  }

  if (subscribed) {
    return (
      <TouchableOpacity
        onPress={unsubscribe}
        style={[styles.card, styles.cardActive]}
        activeOpacity={0.85}
        disabled={loading}
        testID="push-btn-unsubscribe"
      >
        <View style={styles.row}>
          <Ionicons name="notifications" size={22} color="#00E676" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: '#00E676' }]}>NOTIFICHE ATTIVE ✓</Text>
            <Text style={styles.sub}>Tocca per disattivare.</Text>
          </View>
          {loading && <Text style={styles.helper}>…</Text>}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={subscribe}
      style={[styles.card, styles.cardCta]}
      activeOpacity={0.85}
      disabled={loading}
      testID="push-btn-subscribe"
    >
      <View style={styles.row}>
        <Ionicons name="notifications-outline" size={22} color="#000" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: '#000' }]}>{loading ? 'Attivazione…' : 'ATTIVA NOTIFICHE PUSH'}</Text>
          <Text style={[styles.sub, { color: '#000' }]}>Ricevi un avviso sul telefono anche quando l'app è chiusa.</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const alertFn = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export default PushNotificationButton;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 8,
  },
  cardCta: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  cardActive: {
    borderColor: '#00E676',
    backgroundColor: '#00E67615',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 14,
    letterSpacing: 1,
    color: COLORS.text,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  helper: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },
});
