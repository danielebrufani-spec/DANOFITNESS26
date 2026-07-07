import { Platform } from 'react-native';
import { apiService } from '../services/api';

/**
 * Logica condivisa per l'attivazione delle Web Push Notifications.
 * Usata da PushNotificationButton (profilo/welcome gate) e PushOptInPopup (popup all'accesso).
 */

export function isPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Converte base64url in Uint8Array (necessario per applicationServerKey)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'error'; message?: string };

export async function subscribeToPush(): Promise<PushSubscribeResult> {
  try {
    // 1) Richiedi permesso
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'denied' };

    // 2) Registra il service worker (se non già)
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // 3) Recupera VAPID public key dal backend
    const vapidRes = await apiService.getVapidPublicKey();
    const vapidPublic = vapidRes.data.public_key;
    if (!vapidPublic) {
      return { ok: false, reason: 'error', message: 'Chiave VAPID non configurata sul server.' };
    }

    // 4) Subscribe con PushManager
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // applicationServerKey wants a BufferSource; convert Uint8Array to standalone ArrayBuffer
      const keyArr = urlBase64ToUint8Array(vapidPublic);
      const keyBuf = keyArr.buffer.slice(keyArr.byteOffset, keyArr.byteOffset + keyArr.byteLength) as ArrayBuffer;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuf,
      });
    }

    // 5) Invia subscription al backend
    const json = sub.toJSON();
    await apiService.pushSubscribe({
      endpoint: json.endpoint || '',
      keys: {
        p256dh: json.keys?.p256dh || '',
        auth: json.keys?.auth || '',
      },
    });

    return { ok: true };
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('Push subscribe error', e);
    return { ok: false, reason: 'error', message: e?.message || 'Impossibile attivare le notifiche.' };
  }
}
