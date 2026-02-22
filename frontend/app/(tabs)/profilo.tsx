import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/utils/constants';
import * as ImagePicker from 'expo-image-picker';
import { apiService } from '../../src/services/api';

// Utility function to convert base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function ProfiloScreen() {
  const { user, logout, isAdmin, refreshUser } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  
  // Push notification state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    if (Platform.OS === 'web' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      checkPushStatus();
    }
  }, []);

  const checkPushStatus = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushEnabled(!!subscription);
    } catch (error) {
      console.error('Error checking push status:', error);
    }
  };

  const togglePushNotifications = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        // Unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await apiService.unsubscribePush();
        }
        setPushEnabled(false);
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          Alert.alert('Permesso negato', 'Devi permettere le notifiche per riceverle.');
          setPushLoading(false);
          return;
        }

        await navigator.serviceWorker.register('/sw.js');
        const registration = await navigator.serviceWorker.ready;
        
        const { data } = await apiService.getVapidPublicKey();
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey)
        });

        const subscriptionJSON = subscription.toJSON();
        await apiService.subscribePush({
          endpoint: subscriptionJSON.endpoint!,
          keys: {
            p256dh: subscriptionJSON.keys!.p256dh,
            auth: subscriptionJSON.keys!.auth
          }
        });
        
        setPushEnabled(true);
      }
    } catch (error) {
      console.error('Error toggling push:', error);
    }
    setPushLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setUploading(true);
        try {
          const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
          console.log('Uploading image, size:', base64Image.length);
          await apiService.updateProfileImage(base64Image);
          console.log('Image uploaded successfully');
          if (refreshUser) {
            await refreshUser();
          }
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
        }
        setUploading(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profilo</Text>

        {/* User Info Card */}
        <View style={styles.userCard}>
          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} disabled={uploading}>
            {user?.profile_image ? (
              <Image source={{ uri: user.profile_image }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {user?.nome?.charAt(0)}{user?.cognome?.charAt(0)}
              </Text>
            )}
            <View style={styles.editAvatarBadge}>
              <Ionicons name="camera" size={14} color={COLORS.text} />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.nome} {user?.cognome}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.text} />
              <Text style={styles.adminBadgeText}>Amministratore</Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informazioni</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Nome completo</Text>
                <Text style={styles.infoValue}>{user?.nome} {user?.cognome}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
            </View>
            {user?.telefono && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Telefono</Text>
                    <Text style={styles.infoValue}>{user?.telefono}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="fitness-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>App</Text>
                <Text style={styles.infoValue}>DanoFitness23</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Stagione</Text>
                <Text style={styles.infoValue}>Invernale 2025/26</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notifications Section */}
        {pushSupported && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifiche</Text>
            <View style={styles.infoCard}>
              <View style={styles.notificationRow}>
                <View style={styles.notificationInfo}>
                  <Ionicons name="notifications-outline" size={20} color={COLORS.textSecondary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Notifiche Push</Text>
                    <Text style={styles.notificationDescription}>
                      Ricevi avvisi per nuovi messaggi e abbonamenti
                    </Text>
                  </View>
                </View>
                {pushLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Switch
                    value={pushEnabled}
                    onValueChange={togglePushNotifications}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#fff"
                  />
                )}
              </View>
            </View>
          </View>
        )}

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contatti</Text>
          <View style={styles.contactCard}>
            <Ionicons name="call" size={24} color={COLORS.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>Daniele</Text>
              <Text style={styles.contactNumber}>339 50 20 625</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Esci</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 24,
  },
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.text,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  contactCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  contactNumber: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  notificationDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 8,
    textAlign: 'center',
  },
});
