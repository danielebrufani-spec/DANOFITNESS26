import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import apiService from '../services/api';

// Utility function to convert base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    // Check if push notifications are supported (only on web)
    if (Platform.OS === 'web' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Check if already subscribed
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  const subscribe = async (): Promise<boolean> => {
    if (!isSupported) return false;
    
    setIsLoading(true);
    try {
      // Request notification permission
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result !== 'granted') {
        setIsLoading(false);
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get VAPID public key from backend
      const { data } = await apiService.getVapidPublicKey();
      const vapidPublicKey = data.publicKey;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // Send subscription to backend
      const subscriptionJSON = subscription.toJSON();
      await apiService.subscribePush({
        endpoint: subscriptionJSON.endpoint!,
        keys: {
          p256dh: subscriptionJSON.keys!.p256dh,
          auth: subscriptionJSON.keys!.auth
        }
      });

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setIsLoading(false);
      return false;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!isSupported) return false;
    
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await apiService.unsubscribePush();
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setIsLoading(false);
      return false;
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe
  };
};
