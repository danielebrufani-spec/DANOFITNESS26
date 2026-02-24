import { useEffect, useState, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import apiService from '../services/api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Utility function to convert base64 to Uint8Array (for web)
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
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<string | null>(null);
  
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web: Check if push notifications are supported
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        setIsSupported(true);
        setPermission(Notification.permission);
        checkWebSubscription();
      }
    } else {
      // Mobile: Always supported on real devices
      setIsSupported(Device.isDevice);
      checkMobilePermission();
    }

    // Set up notification listeners for mobile
    if (Platform.OS !== 'web') {
      // Listener for notifications received while app is foregrounded
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('[NOTIFICATION] Received:', notification);
      });

      // Listener for when user taps on notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('[NOTIFICATION] Response:', response);
        // Navigate to relevant screen based on notification data
        const data = response.notification.request.content.data;
        if (data?.screen) {
          // Handle navigation here if needed
        }
      });

      return () => {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      };
    }
  }, []);

  const checkMobilePermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermission(status);
    setIsSubscribed(status === 'granted');
  };

  const checkWebSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  // Register for Expo Push Notifications (mobile)
  const registerForExpoPushNotifications = async (): Promise<string | null> => {
    // Check existing permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PUSH] Permission not granted');
      return null;
    }

    setPermission(finalStatus);

    // Get Expo push token
    try {
      // Usa experienceId basato su @anonymous/slug per Expo Go
      const experienceId = `@anonymous/${Constants.expoConfig?.slug || 'danofitness23'}`;
      
      console.log('[PUSH] Getting token with experienceId:', experienceId);
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        experienceId: experienceId,
      });
      
      const token = tokenData.data;
      console.log('[PUSH] Got token:', token);
      setExpoPushToken(token);
      
      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'DanoFitness',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B35',
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
        });
      }

      return token;
    } catch (error: any) {
      console.error('[PUSH] Error getting Expo push token:', error);
      return null;
    }
  };

  // Subscribe to push notifications
  const subscribe = async (): Promise<boolean> => {
    if (!isSupported) {
      Alert.alert('Non Supportato', 'Le notifiche push non sono supportate su questo dispositivo');
      return false;
    }
    
    setIsLoading(true);

    try {
      if (Platform.OS === 'web') {
        // Web subscription
        const result = await Notification.requestPermission();
        setPermission(result);
        
        if (result !== 'granted') {
          setIsLoading(false);
          return false;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const { data } = await apiService.getVapidPublicKey();
        const vapidPublicKey = data.publicKey;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

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
      } else {
        // Mobile subscription (Expo)
        const token = await registerForExpoPushNotifications();
        
        if (token) {
          // Send token to backend
          try {
            await apiService.registerExpoPushToken(token);
            setIsSubscribed(true);
            setIsLoading(false);
            return true;
          } catch (error) {
            console.error('Error registering token with backend:', error);
          }
        }
        
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setIsLoading(false);
      return false;
    }
  };

  // Unsubscribe from push notifications
  const unsubscribe = async (): Promise<boolean> => {
    if (!isSupported) return false;
    
    setIsLoading(true);
    
    try {
      if (Platform.OS === 'web') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          await subscription.unsubscribe();
          await apiService.unsubscribePush();
        }
      } else {
        // Mobile: Remove token from backend
        if (expoPushToken) {
          await apiService.unregisterExpoPushToken();
        }
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

  // Send a local notification (for testing)
  const sendLocalNotification = async (title: string, body: string) => {
    if (Platform.OS !== 'web') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          data: { screen: 'comunicazioni' },
        },
        trigger: null, // Immediately
      });
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    expoPushToken,
    subscribe,
    unsubscribe,
    sendLocalNotification,
  };
};

export default usePushNotifications;
