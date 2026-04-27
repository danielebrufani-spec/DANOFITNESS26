import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiService, Lesson, Booking } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import {
  COLORS,
  ATTIVITA_INFO,
  GIORNI,
  GIORNI_DISPLAY,
  getTodayDateString,
  getDateString,
  formatDate,
} from '../../src/utils/constants';
import { FONTS } from '../../src/theme';

// Get current booking week (Monday to Saturday)
// Bookings for next week open ONLY on Sunday at 9:00 AM Rome time
const getBookingWeek = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();
  
  let monday = new Date(now);
  
  // Next week bookings open ONLY on Sunday at 9:00 AM
  const canShowNextWeek = (currentDay === 0 && currentHour >= 9); // Sunday after 9 AM
  
  if (canShowNextWeek) {
    // It's Sunday after 9 AM - show NEXT week
    // Next Monday is tomorrow
    monday.setDate(now.getDate() + 1);
  } else if (currentDay === 0) {
    // It's Sunday before 9 AM - show CURRENT week (which just ended)
    // Find last Monday (6 days ago)
    monday.setDate(now.getDate() - 6);
  } else if (currentDay === 6) {
    // It's Saturday - show CURRENT week
    // Last Monday was 5 days ago
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

// Check if bookings are open for next week
const areBookingsOpen = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday
  const currentHour = now.getHours();
  
  // Next week bookings open ONLY on Sunday at 9:00 AM
  if (currentDay === 0 && currentHour < 9) {
    return { 
      open: false, 
      message: `Le prenotazioni per la prossima settimana si aprono alle 9:00. Mancano ${9 - currentHour} ore!` 
    };
  }
  
  return { open: true, message: null };
};

// Check if a date is in the past
const isDatePassed = (dateString: string) => {
  const today = getTodayDateString();
  return dateString < today;
};

// Check if a lesson has started (not bookable anymore)
// Returns true if current time is after the lesson start time
const isLessonPassed = (dateString: string, lessonTime: string) => {
  const now = new Date();
  
  // Parse lesson date and time
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = lessonTime.split(':').map(Number);
  
  // Create lesson datetime
  const lessonDateTime = new Date(year, month - 1, day, hours, minutes, 0);
  
  // Lesson is not bookable once it starts
  return now >= lessonDateTime;
};

// Check if all lessons for a day are passed
const isDayClosed = (date: Date, dayLessons: {orario: string}[]) => {
  if (dayLessons.length === 0) return false;
  
  const dateString = getDateString(date);
  const today = getTodayDateString();
  
  // If date is in the past, day is closed
  if (dateString < today) return true;
  
  // If date is in the future, day is open
  if (dateString > today) return false;
  
  // For today, check if all lessons have started
  const now = new Date();
  return dayLessons.every(lesson => {
    const [hours, minutes] = lesson.orario.split(':').map(Number);
    const lessonTime = new Date(date);
    lessonTime.setHours(hours, minutes, 0, 0);
    return now >= lessonTime;
  });
};

export default function PrenotaScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState({ open: true, message: null as string | null });
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [participants, setParticipants] = useState<{[key: string]: {nome: string}[]}>({});
  const [loadingParticipants, setLoadingParticipants] = useState<string | null>(null);
  const [cancelledLessons, setCancelledLessons] = useState<any[]>([]);
  
  // Animazioni
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSadModal, setShowSadModal] = useState(false);
  const confettiPieces = useRef<Animated.Value[]>([]);
  const sadScale = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  // Inizializza confetti pieces
  useEffect(() => {
    confettiPieces.current = Array(30).fill(0).map(() => new Animated.Value(0));
  }, []);

  // Funzione per confetti explosion 🎉
  const triggerConfetti = () => {
    setShowConfetti(true);
    
    const animations = confettiPieces.current.map((anim, index) => {
      anim.setValue(0);
      return Animated.timing(anim, {
        toValue: 1,
        duration: 1500 + Math.random() * 500,
        useNativeDriver: true,
      });
    });
    
    Animated.parallel(animations).start(() => {
      setShowConfetti(false);
    });
  };

  // Funzione per mostrare modal triste 😢
  const triggerSadModal = () => {
    setShowSadModal(true);
    sadScale.setValue(0);
    
    Animated.spring(sadScale, {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();
    
    // Auto-chiudi dopo 2.5 secondi
    setTimeout(() => {
      Animated.timing(sadScale, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowSadModal(false);
      });
    }, 2500);
  };

  // State per bonus prima prenotazione
  const [showBonusModal, setShowBonusModal] = useState(false);
  const bonusScale = useRef(new Animated.Value(0)).current;

  // Funzione per mostrare modal bonus domenica 🎁
  const triggerBonusModal = () => {
    setShowBonusModal(true);
    bonusScale.setValue(0);
    
    Animated.spring(bonusScale, {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();
    
    // Auto-chiudi dopo 4 secondi
    setTimeout(() => {
      Animated.timing(bonusScale, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowBonusModal(false);
      });
    }, 4000);
  };

  // Redirect admin to home
  useEffect(() => {
    if (isAdmin) {
      router.replace('/(tabs)/home');
    }
  }, [isAdmin]);

  const weekDates = getBookingWeek();

  // Find first available day (not closed)
  const findFirstAvailableDay = (lessonsList: Lesson[]) => {
    for (const date of weekDates) {
      const dayName = GIORNI[date.getDay()];
      const dayLessons = lessonsList.filter(l => l.giorno === dayName);
      if (!isDayClosed(date, dayLessons)) {
        return date;
      }
    }
    return weekDates[0]; // Fallback to first day
  };

  useEffect(() => {
    // Initial setup will happen after lessons are loaded
    setBookingStatus(areBookingsOpen());
  }, []);

  // Auto-select first available day when lessons change
  useEffect(() => {
    if (lessons.length > 0) {
      const availableDay = findFirstAvailableDay(lessons);
      setSelectedDate(availableDay);
    }
  }, [lessons]);

  const loadData = async (showLoading = true) => {
    try {
      // Don't show loading spinner if we already have data
      if (showLoading && lessons.length === 0) {
        setLoading(true);
      }
      const [lessonsRes, bookingsRes] = await Promise.all([
        apiService.getLessons(),
        apiService.getMyBookings(),
      ]);
      setLessons(lessonsRes.data);
      setMyBookings(bookingsRes.data);
      
      // Carica lezioni annullate
      try {
        const cancelledRes = await apiService.getCancelledLessons();
        setCancelledLessons(cancelledRes.data);
      } catch { setCancelledLessons([]); }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Don't show loading if we already have data - just refresh in background
      loadData(false);
      setBookingStatus(areBookingsOpen());
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setBookingStatus(areBookingsOpen());
    setExpandedLesson(null);
    setParticipants({});
    loadData();
  };

  const toggleParticipants = async (lessonId: string) => {
    if (expandedLesson === lessonId) {
      // Chiudi tendina
      setExpandedLesson(null);
      return;
    }

    // Apri tendina e carica partecipanti
    setExpandedLesson(lessonId);
    
    if (!selectedDate) return;
    
    const dateString = getDateString(selectedDate);
    const key = `${lessonId}_${dateString}`;
    
    // Se già caricati, non ricaricare
    if (participants[key]) return;
    
    setLoadingParticipants(lessonId);
    try {
      const res = await apiService.getLessonParticipants(lessonId, dateString);
      setParticipants(prev => ({
        ...prev,
        [key]: res.data.participants
      }));
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setLoadingParticipants(null);
    }
  };

  const getParticipantsList = (lessonId: string) => {
    if (!selectedDate) return [];
    const dateString = getDateString(selectedDate);
    const key = `${lessonId}_${dateString}`;
    return participants[key] || [];
  };

  const getDayName = (date: Date) => {
    return GIORNI[date.getDay()];
  };

  const getLessonsForDay = (dayName: string) => {
    return lessons.filter((lesson) => lesson.giorno === dayName);
  };

  const isBooked = (lessonId: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return false;
    
    const lessonDay = lesson.giorno;
    const dayIndex = GIORNI.indexOf(lessonDay);
    const correctDate = weekDates.find(date => date.getDay() === dayIndex);
    if (!correctDate) return false;
    
    const dateString = getDateString(correctDate);
    return myBookings.some(
      (b) => b.lesson_id === lessonId && b.data_lezione === dateString
    );
  };

  const getBookingId = (lessonId: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return undefined;
    
    const lessonDay = lesson.giorno;
    const dayIndex = GIORNI.indexOf(lessonDay);
    const correctDate = weekDates.find(date => date.getDay() === dayIndex);
    if (!correctDate) return undefined;
    
    const dateString = getDateString(correctDate);
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
      
      // Triggera confetti! 🎉
      triggerConfetti();
      
      // Se ha vinto bonus biglietti (prima prenotazione domenica)
      if (response.data.bonus_biglietti && response.data.bonus_biglietti > 0) {
        // Aspetta che finiscano i confetti poi mostra bonus modal
        setTimeout(() => {
          triggerBonusModal();
        }, 1800);
      }
      
      await loadData();
      
      if (response.data.abbonamento_scaduto) {
        Alert.alert(
          'Attenzione',
          'Prenotazione effettuata, ma il tuo abbonamento è scaduto. Contatta Daniele per rinnovare.'
        );
      }
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;
      
      // Messaggio personalizzato per chi non ha abbonamento
      if (errorDetail === 'NO_SUBSCRIPTION') {
        if (Platform.OS === 'web') {
          alert(
            '🏋️ Ciao campione!\n\n' +
            'Per prenotare le lezioni hai bisogno di un abbonamento attivo.\n\n' +
            'Contatta il Maestro Daniele per attivare il tuo abbonamento e tornare ad allenarti con noi! 💪\n\n' +
            'Ti aspettiamo in palestra! 🔥'
          );
        } else {
          Alert.alert(
            '🏋️ Ciao campione!',
            'Per prenotare le lezioni hai bisogno di un abbonamento attivo.\n\n' +
            'Contatta il Maestro Daniele per attivare il tuo abbonamento e tornare ad allenarti con noi! 💪\n\n' +
            'Ti aspettiamo in palestra! 🔥',
            [{ text: 'Ho capito!', style: 'default' }]
          );
        }
      } else {
        Alert.alert('Errore', errorDetail || 'Errore durante la prenotazione');
      }
    } finally {
      setBookingLoading(null);
    }
  };

  // Cancel a booking - INSTANT
  const handleCancel = async (lessonId: string) => {
    const bookingId = getBookingId(lessonId);
    
    if (!bookingId) return;
    
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler cancellare questa prenotazione?')) {
        setBookingLoading(lessonId);
        try {
          await apiService.cancelBooking(bookingId);
          await loadData();
          // Mostra modal triste 😢
          triggerSadModal();
        } catch (error: any) {
          alert(error.response?.data?.detail || 'Errore durante la cancellazione');
        } finally {
          setBookingLoading(null);
        }
      }
    } else {
      Alert.alert(
        '⚠️ Conferma Cancellazione',
        'Sei sicuro di voler cancellare questa prenotazione?',
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Sì, Cancella', 
            style: 'destructive',
            onPress: async () => {
              setBookingLoading(lessonId);
              try {
                await apiService.cancelBooking(bookingId);
                await loadData();
                // Mostra modal triste 😢
                triggerSadModal();
              } catch (error: any) {
                Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la cancellazione');
              } finally {
                setBookingLoading(null);
              }
            }
          }
        ]
      );
    }
  };

  // Cancel from my bookings list - INSTANT
  const handleCancelFromList = async (bookingId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler cancellare questa prenotazione?')) {
        setCancelLoading(bookingId);
        try {
          await apiService.cancelBooking(bookingId);
          await loadData();
          // Mostra modal triste 😢
          triggerSadModal();
        } catch (error: any) {
          alert(error.response?.data?.detail || 'Errore durante la cancellazione');
        } finally {
          setCancelLoading(null);
        }
      }
    } else {
      Alert.alert(
        '⚠️ Conferma Cancellazione',
        'Sei sicuro di voler cancellare questa prenotazione?',
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Sì, Cancella', 
            style: 'destructive',
            onPress: async () => {
              setCancelLoading(bookingId);
              try {
                await apiService.cancelBooking(bookingId);
                await loadData();
                // Mostra modal triste 😢
                triggerSadModal();
              } catch (error: any) {
                Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la cancellazione');
              } finally {
                setCancelLoading(null);
              }
            }
          }
        ]
      );
    }
  };

  const dayLessons = selectedDate ? getLessonsForDay(getDayName(selectedDate)) : [];
  dayLessons.sort((a, b) => a.orario.localeCompare(b.orario));

  // Get this week's bookings only
  const weekStart = weekDates[0] ? getDateString(weekDates[0]) : '';
  const weekEnd = weekDates[5] ? getDateString(weekDates[5]) : '';
  
  // Filtra solo prenotazioni ATTIVE (non ancora fatte) della settimana corrente
  const thisWeekBookings = myBookings
    .filter((b) => {
      // Prima: deve essere nella settimana corrente
      if (b.data_lezione < weekStart || b.data_lezione > weekEnd) return false;
      
      // Poi: la lezione NON deve essere già passata
      const lessonTime = b.lesson_info?.orario || '00:00';
      const isPassed = isLessonPassed(b.data_lezione, lessonTime);
      
      return !isPassed; // Mostra solo se NON è passata
    })
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Prenota Lezione</Text>
          <Text style={styles.subtitle}>Settimana {formatDate(getDateString(weekDates[0]))} - {formatDate(getDateString(weekDates[5]))}</Text>
        </View>
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
            const dayName = getDayName(date);
            const dayLessons = getLessonsForDay(dayName);
            const isClosed = isDayClosed(date, dayLessons);
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateItem,
                  isSelected && styles.dateItemSelected,
                  isClosed && styles.dateItemPassed,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text
                  style={[
                    styles.dateDay,
                    isSelected && styles.dateDaySelected,
                    isClosed && styles.dateDayPassed,
                  ]}
                >
                  {GIORNI_DISPLAY[getDayName(date)]?.substring(0, 3)}
                </Text>
                <Text
                  style={[
                    styles.dateNumber,
                    isSelected && styles.dateNumberSelected,
                    isClosed && styles.dateNumberPassed,
                  ]}
                >
                  {date.getDate()}
                </Text>
                {isToday && !isClosed && <View style={styles.todayDot} />}
                {isClosed && (
                  <Text style={styles.closedText}>Chiuso</Text>
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
            
            // Calculate correct date for this lesson
            const lessonDay = lesson.giorno;
            const dayIndex = GIORNI.indexOf(lessonDay);
            const correctDate = weekDates.find(date => date.getDay() === dayIndex);
            const dateString = correctDate ? getDateString(correctDate) : '';
            
            const booked = isBooked(lesson.id);
            const isLoadingThis = bookingLoading === lesson.id;
            // Use new isLessonPassed function that considers time + 1 hour buffer
            const isPassed = dateString ? isLessonPassed(dateString, lesson.orario) : false;
            const canBook = bookingStatus.open && !isPassed;

            // LEZIONE ANNULLATA (dinamico da DB)
            const isCancelled = cancelledLessons.some(
              (c: any) => c.lesson_id === lesson.id && c.data_lezione === dateString
            );
            const cancelInfo = cancelledLessons.find(
              (c: any) => c.lesson_id === lesson.id && c.data_lezione === dateString
            );

            return (
              <View key={lesson.id} style={[styles.lessonCard, (isPassed || isCancelled) && styles.lessonCardPassed]}>
                <View
                  style={[
                    styles.lessonColorBar,
                    { backgroundColor: isCancelled ? '#EF4444' : (info.colore || COLORS.primary) },
                  ]}
                />
                <View style={styles.lessonContent}>
                  <View style={styles.lessonHeader}>
                    <Text style={[styles.lessonTime, (isPassed || isCancelled) && styles.lessonTimePassed]}>{lesson.orario}</Text>
                    <View style={styles.lessonTypeContainer}>
                      <Text style={[styles.lessonType, { color: (isPassed || isCancelled) ? COLORS.textSecondary : (info.colore || COLORS.primary) }]}>
                        {info.nome || lesson.tipo_attivita}
                      </Text>
                      {isCancelled ? (
                        <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: 'bold' }}>ANNULLATA{cancelInfo?.motivo ? ` - ${cancelInfo.motivo}` : ''}</Text>
                      ) : lesson.coach ? (
                        <Text style={[styles.coachName, isPassed && styles.coachNamePassed]}>
                          Coach {lesson.coach}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
                {isCancelled ? (
                  <View style={[styles.bookButton, { backgroundColor: '#EF444420', borderColor: '#EF444450' }]}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                    <Text style={[styles.bookButtonText, { color: '#EF4444' }]}>Annullata</Text>
                  </View>
                ) : !isPassed ? (
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
                    <Text style={styles.passedIndicatorText}>Non prenotabile</Text>
                  </View>
                )}

                {/* Lista Partecipanti - Solo se prenotato */}
                {booked && (
                  <View style={styles.participantsSection}>
                    <TouchableOpacity 
                      style={styles.participantsToggle}
                      onPress={() => toggleParticipants(lesson.id)}
                    >
                      <Ionicons name="people" size={18} color={COLORS.primary} />
                      <Text style={styles.participantsToggleText}>
                        Chi partecipa?
                      </Text>
                      <Ionicons 
                        name={expandedLesson === lesson.id ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color={COLORS.textSecondary} 
                      />
                    </TouchableOpacity>
                    
                    {expandedLesson === lesson.id && (
                      <View style={styles.participantsList}>
                        {loadingParticipants === lesson.id ? (
                          <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : getParticipantsList(lesson.id).length > 0 ? (
                          getParticipantsList(lesson.id).map((p: any, idx: number) => (
                            <View key={idx} style={styles.participantItem}>
                              <Text style={styles.participantNumber}>{idx + 1}.</Text>
                              <Ionicons name="person" size={14} color={COLORS.textSecondary} />
                              <Text style={styles.participantName}>{p.nome}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.noParticipants}>Nessun partecipante</Text>
                        )}
                      </View>
                    )}
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
          <View style={styles.myBookingsBanner}>
            <View style={styles.bannerGlow} />
            <Ionicons name="calendar" size={28} color="#FFF" />
            <Text style={styles.myBookingsTitle}>Le mie Prenotazioni</Text>
          </View>
          {thisWeekBookings.length > 0 ? (
            thisWeekBookings.map((booking) => {
              const info = ATTIVITA_INFO[booking.lesson_info?.tipo_attivita || ''] || {};
              const isLoadingCancel = cancelLoading === booking.id;
              const lessonTime = booking.lesson_info?.orario || '00:00';
              const attivitaNome = info.nome || booking.lesson_info?.tipo_attivita || 'Lezione';
              const lessonCoach = booking.lesson_info?.coach || 'Daniele';
              
              // Formato data: es "Lunedì 23"
              const date = new Date(booking.data_lezione + 'T00:00:00');
              const giorni = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
              const giornoSettimana = giorni[date.getDay()];
              const numero = date.getDate();
              
              return (
                <View key={booking.id} style={styles.bookingItem}>
                  <View
                    style={[
                      styles.bookingColorBar,
                      { backgroundColor: info.colore || COLORS.primary },
                    ]}
                  />
                  <View style={styles.bookingContent}>
                    <Text style={styles.bookingDate}>
                      {giornoSettimana} {numero} ore {lessonTime}
                    </Text>
                    <Text style={styles.bookingDetails}>
                      {attivitaNome}
                    </Text>
                    <Text style={styles.bookingCoach}>
                      Coach {lessonCoach}
                    </Text>
                  </View>
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
            <Text style={styles.noBookingsText}>Nessuna prenotazione questa settimana</Text>
          )}
        </View>
      </ScrollView>

      {/* Confetti Explosion 🎉 */}
      {showConfetti && (
        <View style={styles.confettiContainer} pointerEvents="none">
          {confettiPieces.current.map((anim, index) => {
            const randomX = (Math.random() - 0.5) * screenWidth * 1.5;
            const randomRotation = Math.random() * 720 - 360;
            const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
            const color = colors[index % colors.length];
            const size = 8 + Math.random() * 12;
            
            return (
              <Animated.View
                key={index}
                style={[
                  styles.confettiPiece,
                  {
                    backgroundColor: color,
                    width: size,
                    height: size * 0.6,
                    left: screenWidth / 2,
                    top: screenHeight * 0.4,
                    transform: [
                      {
                        translateX: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, randomX],
                        }),
                      },
                      {
                        translateY: anim.interpolate({
                          inputRange: [0, 0.3, 1],
                          outputRange: [0, -150, screenHeight * 0.5],
                        }),
                      },
                      {
                        rotate: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', `${randomRotation}deg`],
                        }),
                      },
                      {
                        scale: anim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0, 1.2, 0.8],
                        }),
                      },
                    ],
                    opacity: anim.interpolate({
                      inputRange: [0, 0.1, 0.8, 1],
                      outputRange: [0, 1, 1, 0],
                    }),
                  },
                ]}
              />
            );
          })}
          {/* Testo centrale "PRENOTATO!" */}
          <Animated.Text style={styles.confettiText}>
            🎉 PRENOTATO! 🎉
          </Animated.Text>
        </View>
      )}

      {/* Modal Triste per Cancellazione 😢 */}
      {showSadModal && (
        <View style={styles.sadModalOverlay}>
          <Animated.View style={[styles.sadModalContent, { transform: [{ scale: sadScale }] }]}>
            <Text style={styles.sadEmoji}>😢</Text>
            <Text style={styles.sadTitle}>Il Maestro è deluso...</Text>
            <Text style={styles.sadMessage}>Hai cancellato la lezione!</Text>
            <Text style={styles.sadSubtext}>Torna presto ad allenarti! 💪</Text>
          </Animated.View>
        </View>
      )}

      {/* Modal Bonus Prima Prenotazione Domenica 🎁 */}
      {showBonusModal && (
        <View style={styles.bonusModalOverlay}>
          <Animated.View style={[styles.bonusModalContent, { transform: [{ scale: bonusScale }] }]}>
            <Text style={styles.bonusEmoji}>🏆</Text>
            <Text style={styles.bonusTitle}>SEI IL PRIMO!</Text>
            <Text style={styles.bonusSubtitle}>+2 BIGLIETTI LOTTERIA! 🎟️🎟️</Text>
            <Text style={styles.bonusMessage}>
              Sei stato il più veloce a prenotare questa domenica!
            </Text>
            <Text style={styles.bonusMotivation}>
              La costanza paga sempre... continua così campione! 💪🔥
            </Text>
          </Animated.View>
        </View>
      )}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 38,
    color: COLORS.text,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 6,
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  closedBannerText: {
    color: COLORS.warning,
    fontSize: 13,
    fontFamily: FONTS.bodySemi,
    flex: 1,
  },
  dateSelector: {
    paddingVertical: 12,
  },
  dateSelectorContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dateItem: {
    width: 60,
    height: 80,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
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
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.border,
    opacity: 0.55,
  },
  dateDay: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dateDaySelected: {
    color: COLORS.text,
  },
  dateDayPassed: {
    color: COLORS.textSecondary,
  },
  dateNumber: {
    fontFamily: FONTS.headline,
    fontSize: 24,
    color: COLORS.text,
    marginTop: 4,
    letterSpacing: 1,
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
  closedText: {
    fontSize: 9,
    color: COLORS.error,
    fontFamily: FONTS.bodyBold,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  selectedDateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  selectedDateText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  passedBadge: {
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  passedBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontFamily: FONTS.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  lessonsList: {
    flex: 1,
  },
  lessonsContent: {
    padding: 12,
    paddingTop: 0,
  },
  lessonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lessonCardPassed: {
    opacity: 0.5,
  },
  lessonColorBar: {
    width: 4,
  },
  lessonContent: {
    flex: 1,
    padding: 14,
  },
  lessonHeader: {
    marginBottom: 4,
  },
  lessonTime: {
    fontFamily: FONTS.headline,
    fontSize: 24,
    color: COLORS.text,
    letterSpacing: 1.5,
  },
  lessonTimePassed: {
    color: COLORS.textSecondary,
  },
  lessonTypeContainer: {
    flexDirection: 'column',
  },
  lessonType: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 13,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  coachName: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  coachNamePassed: {
    color: COLORS.textSecondary,
    opacity: 0.7,
  },
  participantsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  participantsSection: {
    marginTop: 10,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  participantNumber: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 13,
    color: COLORS.primary,
    minWidth: 20,
  },
  participantsToggleText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  participantsList: {
    marginTop: 8,
    padding: 10,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  participantsCount: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.primary,
    marginBottom: 6,
  },
  participantName: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
    marginVertical: 2,
  },
  noParticipants: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 110,
    gap: 4,
  },
  bookedButton: {
    backgroundColor: COLORS.error,
  },
  disabledButton: {
    backgroundColor: COLORS.surfaceElevated,
    opacity: 0.6,
  },
  bookButtonText: {
    color: COLORS.text,
    fontFamily: FONTS.bodyBlack,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  passedIndicator: {
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 110,
  },
  passedIndicatorText: {
    color: COLORS.error,
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  noLessonsContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  noLessonsText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  myBookingsSection: {
    marginTop: 24,
    paddingTop: 0,
  },
  myBookingsBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    backgroundColor: '#FFF',
    opacity: 0.15,
    borderRadius: 50,
  },
  myBookingsTitle: {
    fontFamily: FONTS.headline,
    fontSize: 26,
    color: '#FFF',
    flex: 1,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: FONTS.headline,
    fontSize: 22,
    color: COLORS.text,
    marginBottom: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  bookingItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
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
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bookingDatePassed: {
    color: COLORS.textSecondary,
  },
  bookingDetails: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bookingDetailsPassed: {
    color: COLORS.textSecondary,
  },
  bookingCoach: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  bookingCoachPassed: {
    opacity: 0.7,
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
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedBadge: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noBookingsText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  // Confetti styles
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confettiPiece: {
    position: 'absolute',
    borderRadius: 2,
  },
  confettiText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  // Sad modal styles
  sadModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  sadModalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF6B6B',
    maxWidth: 300,
  },
  sadEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  sadTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 8,
    textAlign: 'center',
  },
  sadMessage: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  sadSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // Bonus Modal Styles
  bonusModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  bonusModalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFD700',
    maxWidth: 320,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  bonusEmoji: {
    fontSize: 80,
    marginBottom: 12,
  },
  bonusTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
    textAlign: 'center',
  },
  bonusSubtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  bonusMessage: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  bonusMotivation: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
