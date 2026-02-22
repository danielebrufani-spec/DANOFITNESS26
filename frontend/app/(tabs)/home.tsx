import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { apiService, Booking, Subscription, Lesson } from '../../src/services/api';
import {
  COLORS,
  ATTIVITA_INFO,
  GIORNI_DISPLAY,
  formatDate,
  getTodayDateString,
  getCurrentDayName,
} from '../../src/utils/constants';

export default function HomeScreen() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [mySubscriptions, setMySubscriptions] = useState<Subscription[]>([]);
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);

  const loadData = async () => {
    try {
      const [bookingsRes, subscriptionsRes, lessonsRes] = await Promise.all([
        apiService.getMyBookings(),
        apiService.getMySubscriptions(),
        apiService.getLessonsByDay(getCurrentDayName()),
      ]);
      setMyBookings(bookingsRes.data);
      setMySubscriptions(subscriptionsRes.data);
      setTodayLessons(lessonsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getActiveSubscription = () => {
    return mySubscriptions.find((sub) => sub.attivo && !sub.scaduto);
  };

  const upcomingBookings = myBookings.filter(
    (b) => b.data_lezione >= getTodayDateString()
  ).slice(0, 3);

  const activeSubscription = getActiveSubscription();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Ciao,</Text>
            <Text style={styles.userName}>{user?.nome} {user?.cognome}</Text>
          </View>
          <Image 
            source={require('../../assets/images/logo.jpg')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Subscription Status */}
        <TouchableOpacity
          style={[
            styles.subscriptionCard,
            !activeSubscription && styles.subscriptionCardExpired,
          ]}
          onPress={() => router.push('/(tabs)/abbonamento')}
        >
          <View style={styles.subscriptionHeader}>
            <Ionicons
              name={activeSubscription ? 'checkmark-circle' : 'alert-circle'}
              size={24}
              color={activeSubscription ? COLORS.success : COLORS.error}
            />
            <Text style={styles.subscriptionTitle}>
              {activeSubscription ? 'Abbonamento Attivo' : 'Nessun Abbonamento Attivo'}
            </Text>
          </View>
          {activeSubscription && (
            <View style={styles.subscriptionDetails}>
              <Text style={styles.subscriptionType}>
                {activeSubscription.tipo === 'lezioni_8'
                  ? '8 Lezioni'
                  : activeSubscription.tipo === 'lezioni_16'
                  ? '16 Lezioni'
                  : activeSubscription.tipo === 'mensile'
                  ? 'Mensile'
                  : 'Trimestrale'}
              </Text>
              {activeSubscription.lezioni_rimanenti !== null && (
                <Text style={styles.lessonsRemaining}>
                  {activeSubscription.lezioni_rimanenti} lezioni rimanenti
                </Text>
              )}
              <Text style={styles.expiryDate}>
                Scadenza: {formatDate(activeSubscription.data_scadenza)}
              </Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={COLORS.textSecondary}
            style={styles.subscriptionArrow}
          />
        </TouchableOpacity>

        {/* Today's Lessons */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Lezioni di Oggi</Text>
            <Text style={styles.sectionSubtitle}>
              {GIORNI_DISPLAY[getCurrentDayName()]}
            </Text>
          </View>
          {todayLessons.length > 0 ? (
            todayLessons.map((lesson) => {
              const info = ATTIVITA_INFO[lesson.tipo_attivita] || {};
              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={styles.lessonCard}
                  onPress={() => router.push('/(tabs)/prenota')}
                >
                  <View
                    style={[
                      styles.lessonColor,
                      { backgroundColor: info.colore || COLORS.primary },
                    ]}
                  />
                  <View style={styles.lessonInfo}>
                    <Text style={styles.lessonTime}>{lesson.orario}</Text>
                    <Text style={styles.lessonType}>{info.nome || lesson.tipo_attivita}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.noData}>Nessuna lezione oggi</Text>
          )}
        </View>

        {/* Upcoming Bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Prossime Prenotazioni</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/prenota')}>
              <Text style={styles.seeAll}>Vedi tutte</Text>
            </TouchableOpacity>
          </View>
          {upcomingBookings.length > 0 ? (
            upcomingBookings.map((booking) => {
              const info = ATTIVITA_INFO[booking.lesson_info?.tipo_attivita || ''] || {};
              // Mostra "Abb. Scaduto" solo se NON c'è un abbonamento attivo
              const showExpiredBadge = booking.abbonamento_scaduto && !activeSubscription;
              return (
                <View key={booking.id} style={styles.bookingCard}>
                  <View
                    style={[
                      styles.bookingColor,
                      { backgroundColor: info.colore || COLORS.primary },
                    ]}
                  />
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingDate}>{formatDate(booking.data_lezione)}</Text>
                    <Text style={styles.bookingType}>
                      {booking.lesson_info?.orario} - {info.nome || booking.lesson_info?.tipo_attivita}
                    </Text>
                  </View>
                  {showExpiredBadge && (
                    <View style={styles.expiredBadge}>
                      <Text style={styles.expiredBadgeText}>Abb. Scaduto</Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.noData}>Nessuna prenotazione</Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Azioni Rapide</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/prenota')}
            >
              <Ionicons name="calendar" size={32} color={COLORS.primary} />
              <Text style={styles.actionText}>Prenota Lezione</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/abbonamento')}
            >
              <Ionicons name="card" size={32} color={COLORS.primary} />
              <Text style={styles.actionText}>Abbonamento</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  logoImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subscriptionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  subscriptionCardExpired: {
    borderColor: COLORS.error,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 12,
  },
  subscriptionDetails: {
    flex: 1,
    marginLeft: 36,
  },
  subscriptionType: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  lessonsRemaining: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  expiryDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  subscriptionArrow: {
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.primary,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  lessonCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lessonColor: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTime: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  lessonType: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bookingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingColor: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingDate: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  bookingType: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  expiredBadge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  expiredBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  noData: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
  },
});
