import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { apiService, Lesson, Booking } from '../../src/services/api';
import {
  COLORS,
  ATTIVITA_INFO,
  GIORNI,
  GIORNI_DISPLAY,
  getTodayDateString,
  getDateString,
  formatDate,
} from '../../src/utils/constants';

export default function PrenotaScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [lessonsRes, bookingsRes] = await Promise.all([
        apiService.getLessons(),
        apiService.getMyBookings(),
      ]);
      setLessons(lessonsRes.data);
      setMyBookings(bookingsRes.data);
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

  const getWeekDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getDayName = (date: Date) => {
    return GIORNI[date.getDay()];
  };

  const getLessonsForDay = (dayName: string) => {
    return lessons.filter((lesson) => lesson.giorno === dayName);
  };

  const isBooked = (lessonId: string, dateString: string) => {
    return myBookings.some(
      (b) => b.lesson_id === lessonId && b.data_lezione === dateString
    );
  };

  const getBookingId = (lessonId: string, dateString: string) => {
    const booking = myBookings.find(
      (b) => b.lesson_id === lessonId && b.data_lezione === dateString
    );
    return booking?.id;
  };

  // Book a lesson
  const handleBook = async (lessonId: string) => {
    const dateString = getDateString(selectedDate);
    setBookingLoading(lessonId);
    try {
      const response = await apiService.createBooking({
        lesson_id: lessonId,
        data_lezione: dateString,
      });
      await loadData();
      
      if (response.data.abbonamento_scaduto) {
        Alert.alert(
          'Attenzione',
          'Prenotazione effettuata, ma il tuo abbonamento è scaduto. Contatta Daniele per rinnovare.'
        );
      }
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la prenotazione');
    } finally {
      setBookingLoading(null);
    }
  };

  // Cancel a booking - INSTANT, no confirmation
  const handleCancel = async (lessonId: string) => {
    const dateString = getDateString(selectedDate);
    const bookingId = getBookingId(lessonId, dateString);
    
    if (!bookingId) return;
    
    setBookingLoading(lessonId);
    try {
      await apiService.cancelBooking(bookingId);
      await loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la cancellazione');
    } finally {
      setBookingLoading(null);
    }
  };

  // Cancel from my bookings list - INSTANT
  const handleCancelFromList = async (bookingId: string) => {
    setCancelLoading(bookingId);
    try {
      await apiService.cancelBooking(bookingId);
      await loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la cancellazione');
    } finally {
      setCancelLoading(null);
    }
  };

  const weekDates = getWeekDates();
  const dayLessons = getLessonsForDay(getDayName(selectedDate));

  // Sort lessons by time
  dayLessons.sort((a, b) => a.orario.localeCompare(b.orario));

  // Get upcoming bookings
  const upcomingBookings = myBookings
    .filter((b) => b.data_lezione >= getTodayDateString())
    .sort((a, b) => a.data_lezione.localeCompare(b.data_lezione));

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
      <View style={styles.header}>
        <Text style={styles.title}>Prenota Lezione</Text>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateSelectorContent}
        >
          {weekDates.map((date, index) => {
            const isSelected = getDateString(date) === getDateString(selectedDate);
            const isToday = getDateString(date) === getTodayDateString();
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateItem,
                  isSelected && styles.dateItemSelected,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text
                  style={[
                    styles.dateDay,
                    isSelected && styles.dateDaySelected,
                  ]}
                >
                  {GIORNI_DISPLAY[getDayName(date)]?.substring(0, 3) || getDayName(date).substring(0, 3)}
                </Text>
                <Text
                  style={[
                    styles.dateNumber,
                    isSelected && styles.dateNumberSelected,
                  ]}
                >
                  {date.getDate()}
                </Text>
                {isToday && <View style={styles.todayDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Selected Date Info */}
      <View style={styles.selectedDateInfo}>
        <Ionicons name="calendar" size={20} color={COLORS.primary} />
        <Text style={styles.selectedDateText}>
          {GIORNI_DISPLAY[getDayName(selectedDate)]} {formatDate(getDateString(selectedDate))}
        </Text>
      </View>

      {/* Lessons List */}
      <ScrollView
        style={styles.lessonsList}
        contentContainerStyle={styles.lessonsContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {dayLessons.length > 0 ? (
          dayLessons.map((lesson) => {
            const info = ATTIVITA_INFO[lesson.tipo_attivita] || {};
            const dateString = getDateString(selectedDate);
            const booked = isBooked(lesson.id, dateString);
            const isLoadingThis = bookingLoading === lesson.id;

            return (
              <View key={lesson.id} style={styles.lessonCard}>
                <View
                  style={[
                    styles.lessonColorBar,
                    { backgroundColor: info.colore || COLORS.primary },
                  ]}
                />
                <View style={styles.lessonContent}>
                  <View style={styles.lessonHeader}>
                    <Text style={styles.lessonTime}>{lesson.orario}</Text>
                    <Text style={styles.lessonType}>{info.nome || lesson.tipo_attivita}</Text>
                  </View>
                  {lesson.descrizione && (
                    <Text style={styles.lessonDescription}>{lesson.descrizione}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[
                    styles.bookButton,
                    booked && styles.bookedButton,
                  ]}
                  onPress={() => booked ? handleCancel(lesson.id) : handleBook(lesson.id)}
                  disabled={isLoadingThis}
                >
                  {isLoadingThis ? (
                    <ActivityIndicator size="small" color={COLORS.text} />
                  ) : (
                    <>
                      <Ionicons
                        name={booked ? 'close-circle' : 'add-circle-outline'}
                        size={24}
                        color={COLORS.text}
                      />
                      <Text style={styles.bookButtonText}>
                        {booked ? 'Cancella' : 'Prenota'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <View style={styles.noLessonsContainer}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.noLessonsText}>Nessuna lezione in questo giorno</Text>
          </View>
        )}

        {/* My Bookings Section */}
        <View style={styles.myBookingsSection}>
          <Text style={styles.sectionTitle}>Le Mie Prenotazioni ({upcomingBookings.length})</Text>
          {upcomingBookings.length > 0 ? (
            upcomingBookings.map((booking) => {
              const info = ATTIVITA_INFO[booking.lesson_info?.tipo_attivita || ''] || {};
              const isLoadingCancel = cancelLoading === booking.id;
              
              return (
                <View key={booking.id} style={styles.bookingItem}>
                  <View
                    style={[
                      styles.bookingColorBar,
                      { backgroundColor: info.colore || COLORS.primary },
                    ]}
                  />
                  <View style={styles.bookingContent}>
                    <Text style={styles.bookingDate}>{formatDate(booking.data_lezione)}</Text>
                    <Text style={styles.bookingDetails}>
                      {booking.lesson_info?.orario} - {info.nome || booking.lesson_info?.tipo_attivita}
                    </Text>
                  </View>
                  {booking.abbonamento_scaduto && (
                    <View style={styles.warningBadge}>
                      <Ionicons name="warning" size={14} color={COLORS.secondary} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancelFromList(booking.id)}
                    disabled={isLoadingCancel}
                  >
                    {isLoadingCancel ? (
                      <ActivityIndicator size="small" color={COLORS.error} />
                    ) : (
                      <Ionicons name="trash-outline" size={22} color={COLORS.error} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={styles.noBookingsText}>Nessuna prenotazione</Text>
          )}
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
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  dateSelector: {
    paddingVertical: 8,
  },
  dateSelectorContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dateItem: {
    width: 56,
    height: 72,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateItemSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dateDay: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  dateDaySelected: {
    color: COLORS.text,
  },
  dateNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 4,
  },
  dateNumberSelected: {
    color: COLORS.text,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginTop: 4,
  },
  selectedDateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  selectedDateText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  lessonsList: {
    flex: 1,
  },
  lessonsContent: {
    padding: 16,
    paddingTop: 0,
  },
  lessonCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  lessonColorBar: {
    width: 6,
  },
  lessonContent: {
    flex: 1,
    padding: 16,
  },
  lessonHeader: {
    marginBottom: 4,
  },
  lessonTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  lessonType: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  lessonDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
    gap: 4,
  },
  bookedButton: {
    backgroundColor: COLORS.error,
  },
  bookButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  noLessonsContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  noLessonsText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  myBookingsSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  bookingItem: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bookingColorBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  bookingContent: {
    flex: 1,
    padding: 12,
  },
  bookingDate: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  bookingDetails: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  warningBadge: {
    backgroundColor: COLORS.warning,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noBookingsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
