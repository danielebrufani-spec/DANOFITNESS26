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

// Get current booking week (Monday to Saturday)
// Bookings for next week open on Saturday at 7:00 AM
const getBookingWeek = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();
  
  let monday = new Date(now);
  
  if (currentDay === 6 && currentHour >= 7) {
    // It's Saturday after 7:00 AM - show NEXT week
    // Next Monday is in 2 days
    monday.setDate(now.getDate() + 2);
  } else if (currentDay === 0) {
    // It's Sunday - show NEXT week (bookings opened yesterday at 7)
    // Next Monday is tomorrow
    monday.setDate(now.getDate() + 1);
  } else if (currentDay === 6 && currentHour < 7) {
    // It's Saturday before 7:00 AM - still show CURRENT week
    // This week's Monday was 5 days ago
    monday.setDate(now.getDate() - 5);
  } else {
    // Mon-Fri: show CURRENT week
    const daysFromMonday = currentDay - 1;
    monday.setDate(now.getDate() - daysFromMonday);
  }
  
  monday.setHours(0, 0, 0, 0);
  
  // Generate Mon-Sat dates
  const weekDates = [];
  for (let i = 0; i < 6; i++) { // 6 days: Mon to Sat
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDates.push(date);
  }
  
  return weekDates;
};

// Check if bookings are open
const areBookingsOpen = () => {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  
  // Saturday before 7:00 AM - bookings for next week not yet open
  if (currentDay === 6 && currentHour < 7) {
    return { open: true, message: 'Prenotazioni settimana prossima alle 7:00' };
  }
  
  // Bookings always open (Saturday 7AM onwards, Sunday, Mon-Fri)
  return { open: true, message: null };
};

// Check if a date is in the past
const isDatePassed = (dateString: string) => {
  const today = getTodayDateString();
  return dateString < today;
};

export default function PrenotaScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState({ open: true, message: null as string | null });

  const weekDates = getBookingWeek();

  useEffect(() => {
    // Set initial selected date to today if it's in the week, otherwise first available
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayInWeek = weekDates.find(d => getDateString(d) === getDateString(today));
    if (todayInWeek && !isDatePassed(getDateString(todayInWeek))) {
      setSelectedDate(todayInWeek);
    } else {
      // Find first non-passed date
      const firstAvailable = weekDates.find(d => !isDatePassed(getDateString(d)));
      setSelectedDate(firstAvailable || weekDates[0]);
    }
    
    setBookingStatus(areBookingsOpen());
  }, []);

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
      setBookingStatus(areBookingsOpen());
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setBookingStatus(areBookingsOpen());
    loadData();
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

  // Book a lesson - Date is calculated automatically from lesson day
  const handleBook = async (lessonId: string) => {
    if (!bookingStatus.open) {
      Alert.alert('Prenotazioni Chiuse', bookingStatus.message || 'Le prenotazioni non sono attive');
      return;
    }
    
    // Find the lesson to get its day
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) {
      Alert.alert('Errore', 'Lezione non trovata');
      return;
    }
    
    // Calculate the correct date for this lesson based on its day
    const lessonDay = lesson.giorno;
    const dayIndex = GIORNI.indexOf(lessonDay);
    
    // Find the date in weekDates that matches this day
    const correctDate = weekDates.find(date => {
      const dateDay = date.getDay(); // JS: 0=Sun, 1=Mon, etc
      return dateDay === dayIndex;
    });
    
    if (!correctDate) {
      Alert.alert('Errore', 'Data non disponibile per questa lezione');
      return;
    }
    
    const dateString = getDateString(correctDate);
    
    if (isDatePassed(dateString)) {
      Alert.alert('Errore', 'Non puoi prenotare per una data passata');
      return;
    }
    
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

  // Cancel a booking - INSTANT
  const handleCancel = async (lessonId: string) => {
    if (!selectedDate) return;
    
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

  const dayLessons = selectedDate ? getLessonsForDay(getDayName(selectedDate)) : [];
  dayLessons.sort((a, b) => a.orario.localeCompare(b.orario));

  // Get this week's bookings only
  const weekStart = weekDates[0] ? getDateString(weekDates[0]) : '';
  const weekEnd = weekDates[5] ? getDateString(weekDates[5]) : '';
  
  const thisWeekBookings = myBookings
    .filter((b) => b.data_lezione >= weekStart && b.data_lezione <= weekEnd)
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
        <Text style={styles.subtitle}>Settimana {formatDate(getDateString(weekDates[0]))} - {formatDate(getDateString(weekDates[5]))}</Text>
      </View>

      {/* Booking Status Banner */}
      {!bookingStatus.open && (
        <View style={styles.closedBanner}>
          <Ionicons name="time-outline" size={20} color={COLORS.warning} />
          <Text style={styles.closedBannerText}>{bookingStatus.message}</Text>
        </View>
      )}

      {/* Week Date Selector (Mon-Sat only) */}
      <View style={styles.dateSelector}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateSelectorContent}
        >
          {weekDates.map((date, index) => {
            const dateString = getDateString(date);
            const isSelected = selectedDate && getDateString(selectedDate) === dateString;
            const isToday = dateString === getTodayDateString();
            const isPassed = isDatePassed(dateString);
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateItem,
                  isSelected && styles.dateItemSelected,
                  isPassed && styles.dateItemPassed,
                ]}
                onPress={() => setSelectedDate(date)}
                disabled={isPassed}
              >
                <Text
                  style={[
                    styles.dateDay,
                    isSelected && styles.dateDaySelected,
                    isPassed && styles.dateDayPassed,
                  ]}
                >
                  {GIORNI_DISPLAY[getDayName(date)]?.substring(0, 3)}
                </Text>
                <Text
                  style={[
                    styles.dateNumber,
                    isSelected && styles.dateNumberSelected,
                    isPassed && styles.dateNumberPassed,
                  ]}
                >
                  {date.getDate()}
                </Text>
                {isToday && !isPassed && <View style={styles.todayDot} />}
                {isPassed && (
                  <Ionicons name="checkmark" size={12} color={COLORS.textSecondary} style={styles.passedIcon} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Selected Date Info */}
      {selectedDate && (
        <View style={styles.selectedDateInfo}>
          <Ionicons name="calendar" size={20} color={COLORS.primary} />
          <Text style={styles.selectedDateText}>
            {GIORNI_DISPLAY[getDayName(selectedDate)]} {formatDate(getDateString(selectedDate))}
          </Text>
          {isDatePassed(getDateString(selectedDate)) && (
            <View style={styles.passedBadge}>
              <Text style={styles.passedBadgeText}>Passato</Text>
            </View>
          )}
        </View>
      )}

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
        {selectedDate && dayLessons.length > 0 ? (
          dayLessons.map((lesson) => {
            const info = ATTIVITA_INFO[lesson.tipo_attivita] || {};
            const dateString = getDateString(selectedDate);
            const booked = isBooked(lesson.id, dateString);
            const isLoadingThis = bookingLoading === lesson.id;
            const isPassed = isDatePassed(dateString);
            const canBook = bookingStatus.open && !isPassed;

            return (
              <View key={lesson.id} style={[styles.lessonCard, isPassed && styles.lessonCardPassed]}>
                <View
                  style={[
                    styles.lessonColorBar,
                    { backgroundColor: info.colore || COLORS.primary },
                  ]}
                />
                <View style={styles.lessonContent}>
                  <View style={styles.lessonHeader}>
                    <Text style={[styles.lessonTime, isPassed && styles.lessonTimePassed]}>{lesson.orario}</Text>
                    <Text style={[styles.lessonType, { color: isPassed ? COLORS.textSecondary : (info.colore || COLORS.primary) }]}>
                      {info.nome || lesson.tipo_attivita}
                    </Text>
                  </View>
                </View>
                {!isPassed ? (
                  <TouchableOpacity
                    style={[
                      styles.bookButton,
                      booked && styles.bookedButton,
                      !canBook && styles.disabledButton,
                    ]}
                    onPress={() => booked ? handleCancel(lesson.id) : handleBook(lesson.id)}
                    disabled={isLoadingThis || !canBook}
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
                ) : (
                  <View style={styles.passedIndicator}>
                    <Text style={styles.passedIndicatorText}>Passato</Text>
                  </View>
                )}
              </View>
            );
          })
        ) : selectedDate ? (
          <View style={styles.noLessonsContainer}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.noLessonsText}>Nessuna lezione in questo giorno</Text>
          </View>
        ) : null}

        {/* This Week's Bookings */}
        <View style={styles.myBookingsSection}>
          <Text style={styles.sectionTitle}>Prenotazioni Settimana ({thisWeekBookings.length})</Text>
          {thisWeekBookings.length > 0 ? (
            thisWeekBookings.map((booking) => {
              const info = ATTIVITA_INFO[booking.lesson_info?.tipo_attivita || ''] || {};
              const isLoadingCancel = cancelLoading === booking.id;
              const isPassed = isDatePassed(booking.data_lezione);
              
              return (
                <View key={booking.id} style={[styles.bookingItem, isPassed && styles.bookingItemPassed]}>
                  <View
                    style={[
                      styles.bookingColorBar,
                      { backgroundColor: info.colore || COLORS.primary },
                    ]}
                  />
                  <View style={styles.bookingContent}>
                    <Text style={[styles.bookingDate, isPassed && styles.bookingDatePassed]}>
                      {GIORNI_DISPLAY[booking.lesson_info?.giorno || '']?.substring(0, 3)} {formatDate(booking.data_lezione)}
                    </Text>
                    <Text style={styles.bookingDetails}>
                      {booking.lesson_info?.orario} - {info.nome || booking.lesson_info?.tipo_attivita}
                    </Text>
                  </View>
                  {booking.abbonamento_scaduto && (
                    <View style={styles.warningBadge}>
                      <Ionicons name="warning" size={14} color={COLORS.secondary} />
                    </View>
                  )}
                  {!isPassed && (
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
                  )}
                  {isPassed && (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark" size={16} color={COLORS.success} />
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.noBookingsText}>Nessuna prenotazione questa settimana</Text>
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
  subtitle: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  closedBannerText: {
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: '500',
  },
  dateSelector: {
    paddingVertical: 12,
  },
  dateSelectorContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dateItem: {
    width: 56,
    height: 76,
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
  dateItemPassed: {
    backgroundColor: COLORS.cardLight,
    borderColor: COLORS.border,
    opacity: 0.6,
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
  dateDayPassed: {
    color: COLORS.textSecondary,
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
  dateNumberPassed: {
    color: COLORS.textSecondary,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginTop: 4,
  },
  passedIcon: {
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
    flex: 1,
  },
  passedBadge: {
    backgroundColor: COLORS.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  passedBadgeText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '600',
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
  lessonCardPassed: {
    opacity: 0.5,
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
  lessonTimePassed: {
    color: COLORS.textSecondary,
  },
  lessonType: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
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
  disabledButton: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.5,
  },
  bookButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  passedIndicator: {
    backgroundColor: COLORS.cardLight,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passedIndicatorText: {
    color: COLORS.textSecondary,
    fontSize: 12,
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
  bookingItemPassed: {
    opacity: 0.6,
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
  bookingDatePassed: {
    color: COLORS.textSecondary,
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
  completedBadge: {
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
