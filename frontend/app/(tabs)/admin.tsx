import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
  apiService,
  Subscription,
  User,
} from '../../src/services/api';
import {
  COLORS,
  ATTIVITA_INFO,
  ABBONAMENTO_INFO,
  GIORNI_DISPLAY,
  formatDate,
  getTodayDateString,
} from '../../src/utils/constants';

interface WeeklyLesson {
  lesson_id: string;
  orario: string;
  tipo_attivita: string;
  partecipanti: Array<{
    booking_id: string;
    user_id: string;
    nome: string;
    cognome: string;
    abbonamento_scaduto: boolean;
    lezione_scalata: boolean;
  }>;
  totale_iscritti: number;
}

interface WeeklyDay {
  data: string;
  giorno: string;
  lezioni: WeeklyLesson[];
}

interface WeeklyBookings {
  settimana_inizio: string;
  settimana_fine: string;
  giorni: WeeklyDay[];
}

export default function AdminScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'riepilogo' | 'presenze' | 'abbonamenti' | 'utenti'>('riepilogo');
  
  const [weeklyBookings, setWeeklyBookings] = useState<WeeklyBookings | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [expiredSubscriptions, setExpiredSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Daily stats
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Search
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [subscriptionUserSearch, setSubscriptionUserSearch] = useState<string>('');
  const [abbonamentoSearchQuery, setAbbonamentoSearchQuery] = useState<string>('');
  
  // Add subscription modal
  const [showAddSubscription, setShowAddSubscription] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('lezioni_8');
  const [customLessons, setCustomLessons] = useState<string>('');
  const [addingSubscription, setAddingSubscription] = useState(false);

  // Edit subscription modal
  const [showEditSubscription, setShowEditSubscription] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [editLessons, setEditLessons] = useState<string>('');
  const [editExpiry, setEditExpiry] = useState<string>('');
  const [editType, setEditType] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Expanded days
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Filtered users based on search
  const filteredUsers = users
    .filter(user => {
      if (!userSearchQuery.trim()) return true;
      const searchLower = userSearchQuery.toLowerCase();
      return (
        user.nome?.toLowerCase().includes(searchLower) ||
        user.cognome?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.telefono?.includes(searchLower)
      );
    })
    .sort((a, b) => {
      const nameA = `${a.cognome || ''} ${a.nome || ''}`.toLowerCase();
      const nameB = `${b.cognome || ''} ${b.nome || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

  // Filtered users for subscription modal
  const filteredUsersForSubscription = users
    .filter(u => {
      if (u.role === 'admin') return false;
      if (!subscriptionUserSearch.trim()) return true;
      const searchLower = subscriptionUserSearch.toLowerCase();
      return (
        u.nome?.toLowerCase().includes(searchLower) ||
        u.cognome?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const nameA = `${a.cognome || ''} ${a.nome || ''}`.toLowerCase();
      const nameB = `${b.cognome || ''} ${b.nome || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

  // Filtered subscriptions based on search
  const filteredSubscriptions = subscriptions
    .filter(sub => {
      if (!abbonamentoSearchQuery.trim()) return true;
      const searchLower = abbonamentoSearchQuery.toLowerCase();
      return (
        sub.user_nome?.toLowerCase().includes(searchLower) ||
        sub.user_cognome?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const nameA = `${a.user_cognome || ''} ${a.user_nome || ''}`.toLowerCase();
      const nameB = `${b.user_cognome || ''} ${b.user_nome || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

  // Calcola presenze totali settimanali
  const getTotalWeeklyPresenze = () => {
    if (!weeklyBookings) return 0;
    return weeklyBookings.giorni.reduce((total, day) => {
      return total + day.lezioni.reduce((dayTotal, lesson) => dayTotal + lesson.totale_iscritti, 0);
    }, 0);
  };

  const loadData = async () => {
    try {
      const [weeklyRes, subsRes, expiredRes, usersRes] = await Promise.all([
        apiService.getWeeklyBookings(),
        apiService.getAllSubscriptions(),
        apiService.getExpiredSubscriptions(),
        apiService.getAllUsers(),
      ]);
      
      setWeeklyBookings(weeklyRes.data);
      setSubscriptions(subsRes.data);
      setExpiredSubscriptions(expiredRes.data);
      setUsers(usersRes.data);
      
      // Tendine sempre chiuse di default
      setExpandedDays(new Set());
      
      // Carica le statistiche giornaliere
      const today = getTodayDateString();
      loadDailyStats(today);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDailyStats = async (date: string) => {
    setLoadingStats(true);
    try {
      const response = await apiService.getDailyStats(date);
      setDailyStats(response.data);
    } catch (error) {
      console.error('Error loading daily stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Auto-refresh every 10 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[Admin] Auto-refresh triggered');
      loadData();
    }, 10000); // 10 seconds - più frequente per vedere le nuove prenotazioni
    
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const handleAddSubscription = async () => {
    if (!selectedUser) {
      Alert.alert('Errore', 'Seleziona un utente');
      return;
    }
    
    setAddingSubscription(true);
    try {
      const data: any = {
        user_id: selectedUser,
        tipo: selectedType,
      };
      
      if (customLessons && (selectedType === 'lezioni_8' || selectedType === 'lezioni_16')) {
        data.lezioni_rimanenti = parseInt(customLessons);
      }
      
      await apiService.createSubscription(data);
      setShowAddSubscription(false);
      setSelectedUser('');
      setCustomLessons('');
      Alert.alert('Successo', 'Abbonamento creato');
      await loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la creazione');
    } finally {
      setAddingSubscription(false);
    }
  };

  const openEditModal = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setEditLessons(subscription.lezioni_rimanenti?.toString() || '');
    setEditType(subscription.tipo);
    const expiryDate = new Date(subscription.data_scadenza);
    setEditExpiry(expiryDate.toISOString().split('T')[0]);
    setShowEditSubscription(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSubscription) return;
    
    setSavingEdit(true);
    try {
      const updateData: any = {};
      
      // Aggiorna il tipo se cambiato
      if (editType && editType !== editingSubscription.tipo) {
        updateData.tipo = editType;
        // Se cambia a tipo con lezioni, imposta il numero di lezioni
        if (editType === 'lezioni_8') {
          updateData.lezioni_rimanenti = parseInt(editLessons) || 8;
        } else if (editType === 'lezioni_16') {
          updateData.lezioni_rimanenti = parseInt(editLessons) || 16;
        } else {
          // Per mensile/trimestrale, le lezioni sono null
          updateData.lezioni_rimanenti = null;
        }
      } else if (editLessons && (editType === 'lezioni_8' || editType === 'lezioni_16')) {
        const newLessons = parseInt(editLessons);
        if (!isNaN(newLessons) && newLessons >= 0) {
          updateData.lezioni_rimanenti = newLessons;
        }
      }
      
      if (editExpiry) {
        updateData.data_scadenza = new Date(editExpiry).toISOString();
      }
      
      if (Object.keys(updateData).length === 0) {
        Alert.alert('Errore', 'Nessuna modifica da salvare');
        setSavingEdit(false);
        return;
      }
      
      await apiService.updateSubscription(editingSubscription.id, updateData);
      setShowEditSubscription(false);
      setEditingSubscription(null);
      Alert.alert('Successo', 'Abbonamento aggiornato');
      await loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante l\'aggiornamento');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSubscription = async (subscriptionId: string) => {
    Alert.alert(
      '⚠️ Conferma Eliminazione',
      'Sei sicuro di voler eliminare questo abbonamento?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Sì, Elimina', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteSubscription(subscriptionId);
              await loadData();
            } catch (error) {
              console.error('Errore eliminazione abbonamento:', error);
            }
          }
        }
      ]
    );
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    Alert.alert(
      '⚠️ Conferma Eliminazione',
      `Sei sicuro di voler eliminare l'utente ${userName}?\n\nQuesto eliminerà anche tutti i suoi abbonamenti e prenotazioni.`,
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Sì, Elimina', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteUser(userId);
              await loadData();
            } catch (error: any) {
              console.error('Errore eliminazione utente:', error);
            }
          }
        }
      ]
    );
  };

  const handleDeleteBooking = async (bookingId: string) => {
    Alert.alert(
      '⚠️ Conferma Eliminazione',
      'Sei sicuro di voler eliminare questa prenotazione?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Sì, Elimina', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.cancelBooking(bookingId);
              await loadData();
            } catch (error) {
              console.error('Errore eliminazione prenotazione:', error);
            }
          }
        }
      ]
    );
  };

  // Calculate totals
  const getTotalParticipants = () => {
    if (!weeklyBookings) return 0;
    return weeklyBookings.giorni.reduce((sum, day) => 
      sum + day.lezioni.reduce((lessonSum, lesson) => lessonSum + lesson.totale_iscritti, 0), 0);
  };

  const getTotalLessonsWithBookings = () => {
    if (!weeklyBookings) return 0;
    return weeklyBookings.giorni.reduce((sum, day) => 
      sum + day.lezioni.filter(l => l.totale_iscritti > 0).length, 0);
  };

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
        <Text style={styles.title}>Admin</Text>
        {weeklyBookings && (
          <Text style={styles.weekRange}>
            {formatDate(weeklyBookings.settimana_inizio)} - {formatDate(weeklyBookings.settimana_fine)}
          </Text>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'riepilogo' && styles.tabActive]}
          onPress={() => setActiveTab('riepilogo')}
        >
          <Text style={[styles.tabText, activeTab === 'riepilogo' && styles.tabTextActive]}>
            Oggi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'presenze' && styles.tabActive]}
          onPress={() => setActiveTab('presenze')}
        >
          <Text style={[styles.tabText, activeTab === 'presenze' && styles.tabTextActive]}>
            Presenze
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'abbonamenti' && styles.tabActive]}
          onPress={() => setActiveTab('abbonamenti')}
        >
          <Text style={[styles.tabText, activeTab === 'abbonamenti' && styles.tabTextActive]}>
            Abbon.
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'utenti' && styles.tabActive]}
          onPress={() => setActiveTab('utenti')}
        >
          <Text style={[styles.tabText, activeTab === 'utenti' && styles.tabTextActive]}>
            Utenti
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scaduti' && styles.tabActive]}
          onPress={() => setActiveTab('scaduti')}
        >
          <Text style={[styles.tabText, activeTab === 'scaduti' && styles.tabTextActive]}>
            Scaduti
          </Text>
          {expiredSubscriptions.length > 0 && (
            <View style={[styles.badge, { backgroundColor: COLORS.error }]}>
              <Text style={styles.badgeText}>{expiredSubscriptions.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Refresh Button */}
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={onRefresh}
        disabled={refreshing}
      >
        <Ionicons 
          name="refresh" 
          size={20} 
          color={COLORS.text} 
          style={refreshing ? styles.spinning : undefined}
        />
        <Text style={styles.refreshButtonText}>
          {refreshing ? 'Aggiornamento...' : 'Aggiorna'}
        </Text>
      </TouchableOpacity>

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
        {/* RIEPILOGO TAB - TODAY'S SUMMARY */}
        {activeTab === 'riepilogo' && (
          <View style={styles.riepilogoContainer}>
            <Text style={styles.riepilogoTitle}>📊 Riepilogo Giornaliero</Text>
            <Text style={styles.riepilogoDate}>{formatDate(getTodayDateString())}</Text>
            
            {loadingStats ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : dailyStats ? (
              <>
                {/* Totale Presenze Card */}
                <View style={styles.totalCard}>
                  <Text style={styles.totalNumber}>{dailyStats.totale_prenotazioni}</Text>
                  <Text style={styles.totalLabel}>Presenze Totali Oggi</Text>
                </View>

                {/* Presenze per Lezione */}
                <Text style={styles.riepilogoSectionTitle}>Dettaglio per Lezione</Text>
                
                {Object.keys(dailyStats.prenotazioni_per_lezione).length > 0 ? (
                  Object.entries(dailyStats.prenotazioni_per_lezione)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([lezione, presenze]) => {
                      const [orario, tipo] = lezione.split(' - ');
                      const info = ATTIVITA_INFO[tipo?.toLowerCase()] || {};
                      return (
                        <View key={lezione} style={styles.lessonStatCard}>
                          <View style={[styles.lessonStatColor, { backgroundColor: info.colore || COLORS.primary }]} />
                          <View style={styles.lessonStatInfo}>
                            <Text style={styles.lessonStatTime}>{orario}</Text>
                            <Text style={styles.lessonStatType}>{tipo}</Text>
                          </View>
                          <View style={styles.lessonStatBadge}>
                            <Text style={styles.lessonStatCount}>{presenze as number}</Text>
                            <Text style={styles.lessonStatUnit}>presenze</Text>
                          </View>
                        </View>
                      );
                    })
                ) : (
                  <Text style={styles.noDataText}>Nessuna prenotazione per oggi</Text>
                )}

                {/* Riepilogo Abbonamenti */}
                <Text style={styles.riepilogoSectionTitle}>Lezioni Scalate</Text>
                
                <View style={styles.abbonamentoStatsContainer}>
                  {/* Abbonamenti a Lezioni */}
                  <View style={[styles.abbonamentoStatCard, { backgroundColor: COLORS.warning + '20' }]}>
                    <Text style={[styles.abbonamentoStatNumber, { color: COLORS.warning }]}>
                      {dailyStats.lezioni_scalate}
                    </Text>
                    <Text style={styles.abbonamentoStatLabel}>A Lezione</Text>
                    <Text style={styles.abbonamentoStatSubLabel}>(pacchetto)</Text>
                  </View>
                  
                  {/* Abbonamenti a Tempo */}
                  <View style={[styles.abbonamentoStatCard, { backgroundColor: COLORS.success + '20' }]}>
                    <Text style={[styles.abbonamentoStatNumber, { color: COLORS.success }]}>
                      {dailyStats.presenze_abbonamento_tempo || 0}
                    </Text>
                    <Text style={styles.abbonamentoStatLabel}>A Tempo</Text>
                    <Text style={styles.abbonamentoStatSubLabel}>(mensile/trimestrale)</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.noDataText}>Caricamento statistiche...</Text>
            )}
          </View>
        )}

        {/* PRESENZE TAB - WEEKLY VIEW */}
        {activeTab === 'presenze' && weeklyBookings && (
          <>
            {/* Presenze Totali Settimanali - Grande in alto */}
            <View style={styles.weeklyTotalCard}>
              <Text style={styles.weeklyTotalLabel}>Presenze Totali Settimanali</Text>
              <Text style={styles.weeklyTotalNumber}>{getTotalWeeklyPresenze()}</Text>
            </View>

            <View style={styles.autoProcessInfo}>
              <Ionicons name="time-outline" size={16} color={COLORS.success} />
              <Text style={styles.autoProcessText}>
                Aggiornamento automatico a mezzanotte
              </Text>
            </View>

            {/* Weekly Days List */}
            {weeklyBookings.giorni.map((day) => {
              const isExpanded = expandedDays.has(day.data);
              const dayTotalBookings = day.lezioni.reduce((sum, l) => sum + l.totale_iscritti, 0);
              const isToday = day.data === getTodayDateString();
              const isPast = day.data < getTodayDateString();
              
              return (
                <View key={day.data} style={[styles.dayCard, isPast && styles.dayCardPast]}>
                  {/* Day Header - Giorno in risalto */}
                  <TouchableOpacity 
                    style={[styles.dayHeader, isToday && styles.dayHeaderToday]}
                    onPress={() => toggleDay(day.data)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayInfoLarge}>
                      <Text style={[styles.dayDateLarge, isToday && styles.dayDateToday]}>
                        {formatDate(day.data)}
                      </Text>
                      <Text style={[styles.dayNameSmall, isToday && styles.dayNameTodaySmall]}>
                        {GIORNI_DISPLAY[day.giorno]}
                        {isToday && ' • OGGI'}
                      </Text>
                    </View>
                    <View style={styles.dayStats}>
                      <View style={[styles.dayCountBadge, isToday && styles.dayCountBadgeToday]}>
                        <Ionicons name="people" size={16} color={COLORS.text} />
                        <Text style={styles.dayCountText}>{dayTotalBookings}</Text>
                      </View>
                      <Ionicons 
                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                        size={24} 
                        color={isToday ? COLORS.primary : COLORS.textSecondary} 
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Lessons */}
                  {isExpanded && (
                    <View style={styles.lessonsContainer}>
                      {day.lezioni.length > 0 ? (
                        day.lezioni.map((lesson) => {
                          const info = ATTIVITA_INFO[lesson.tipo_attivita] || {};
                          return (
                            <View key={lesson.lesson_id} style={styles.lessonItem}>
                              <View style={[styles.lessonHeader, { borderLeftColor: info.colore || COLORS.primary }]}>
                                <View style={styles.lessonInfo}>
                                  <Text style={styles.lessonTime}>{lesson.orario}</Text>
                                  <Text style={[styles.lessonType, { color: info.colore || COLORS.primary }]}>
                                    {info.nome || lesson.tipo_attivita}
                                  </Text>
                                </View>
                                <View style={styles.lessonCount}>
                                  <Text style={styles.lessonCountText}>{lesson.totale_iscritti}</Text>
                                </View>
                              </View>
                              
                              {lesson.partecipanti.length > 0 ? (
                                <View style={styles.participantsList}>
                                  {lesson.partecipanti.map((p, index) => (
                                    <View key={p.booking_id} style={styles.participantRow}>
                                      <Text style={styles.participantNumber}>{index + 1}.</Text>
                                      <Text style={styles.participantName}>
                                        {p.nome} {p.cognome}
                                      </Text>
                                      {p.abbonamento_scaduto && (
                                        <Ionicons name="warning" size={14} color={COLORS.warning} />
                                      )}
                                      {p.lezione_scalata && (
                                        <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                                      )}
                                      {!isPast && (
                                        <TouchableOpacity 
                                          onPress={() => handleDeleteBooking(p.booking_id)}
                                          style={styles.removeButton}
                                        >
                                          <Ionicons name="close" size={16} color={COLORS.error} />
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  ))}
                                </View>
                              ) : (
                                <Text style={styles.noParticipants}>Nessun iscritto</Text>
                              )}
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.noLessons}>Nessuna lezione</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* SUBSCRIPTIONS TAB */}
        {activeTab === 'abbonamenti' && (
          <>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddSubscription(true)}
            >
              <Ionicons name="add-circle" size={20} color={COLORS.text} />
              <Text style={styles.addButtonText}>Nuovo Abbonamento</Text>
            </TouchableOpacity>

            {/* Barra di ricerca abbonamenti */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cerca cliente..."
                placeholderTextColor={COLORS.textSecondary}
                value={abbonamentoSearchQuery}
                onChangeText={setAbbonamentoSearchQuery}
              />
              {abbonamentoSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setAbbonamentoSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {expiredSubscriptions.length > 0 && !abbonamentoSearchQuery && (
              <>
                <Text style={[styles.sectionTitle, styles.warningTitle]}>
                  Abbonamenti Scaduti ({expiredSubscriptions.length})
                </Text>
                {[...expiredSubscriptions]
                  .sort((a, b) => {
                    const nameA = `${a.user_cognome || ''} ${a.user_nome || ''}`.toLowerCase();
                    const nameB = `${b.user_cognome || ''} ${b.user_nome || ''}`.toLowerCase();
                    return nameA.localeCompare(nameB);
                  })
                  .map((sub) => {
                  const info = ABBONAMENTO_INFO[sub.tipo] || { nome: sub.tipo };
                  return (
                    <TouchableOpacity 
                      key={sub.id} 
                      style={[styles.subscriptionCard, styles.expiredCard]}
                      onPress={() => openEditModal(sub)}
                    >
                      <View style={styles.subscriptionInfo}>
                        <Text style={styles.subscriptionUser}>
                          {sub.user_nome} {sub.user_cognome}
                        </Text>
                        <Text style={styles.subscriptionType}>{info.nome}</Text>
                        {sub.lezioni_rimanenti !== null && (
                          <Text style={styles.subscriptionLessons}>
                            {sub.lezioni_rimanenti} lezioni rimanenti
                          </Text>
                        )}
                        <Text style={styles.subscriptionExpiry}>
                          Scaduto: {formatDate(sub.data_scadenza)}
                        </Text>
                      </View>
                      <View style={styles.subscriptionActions}>
                        <TouchableOpacity 
                          style={styles.editButton}
                          onPress={() => openEditModal(sub)}
                        >
                          <Ionicons name="pencil" size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                        <Ionicons name="alert-circle" size={24} color={COLORS.error} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            <Text style={styles.sectionTitle}>
              {abbonamentoSearchQuery ? `Risultati ricerca (${filteredSubscriptions.length})` : `Tutti gli Abbonamenti (${subscriptions.length})`}
            </Text>
            {filteredSubscriptions.map((sub) => {
              const info = ABBONAMENTO_INFO[sub.tipo] || { nome: sub.tipo };
              return (
                <View
                  key={sub.id}
                  style={[styles.subscriptionCard, sub.scaduto && styles.expiredCard]}
                >
                  <View style={styles.subscriptionInfo}>
                    <Text style={styles.subscriptionUser}>
                      {sub.user_nome} {sub.user_cognome}
                    </Text>
                    <Text style={styles.subscriptionType}>{info.nome}</Text>
                    {sub.lezioni_rimanenti !== null && (
                      <Text style={styles.subscriptionLessons}>
                        {sub.lezioni_rimanenti} lezioni rimanenti
                      </Text>
                    )}
                    <Text style={styles.subscriptionExpiry}>
                      Scadenza: {formatDate(sub.data_scadenza)}
                    </Text>
                    {sub.scaduto && (
                      <Text style={styles.expiredBadge}>SCADUTO</Text>
                    )}
                  </View>
                  <View style={styles.iconActions}>
                    <TouchableOpacity 
                      style={styles.iconBtn}
                      onPress={() => openEditModal(sub)}
                    >
                      <Ionicons name="pencil" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.iconBtn}
                      onPress={() => handleDeleteSubscription(sub.id)}
                    >
                      <Ionicons name="trash" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* USERS TAB */}
        {activeTab === 'utenti' && (
          <>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cerca utente per nome, email o telefono..."
                placeholderTextColor={COLORS.textSecondary}
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
              />
              {userSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setUserSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionTitle}>
              Utenti Registrati ({filteredUsers.length}{userSearchQuery ? ` di ${users.length}` : ''})
            </Text>
            
            {/* Legenda */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>A Lezioni</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.legendText}>A Tempo</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.textSecondary }]} />
                <Text style={styles.legendText}>No Abb.</Text>
              </View>
            </View>

            {filteredUsers.map((user) => {
              // Trova l'abbonamento dell'utente
              const userSubscription = subscriptions.find(s => s.user_id === user.id);
              const isLezioniType = userSubscription && (userSubscription.tipo === 'lezioni_8' || userSubscription.tipo === 'lezioni_16');
              const isTempoType = userSubscription && (userSubscription.tipo === 'mensile' || userSubscription.tipo === 'trimestrale');
              
              return (
              <View key={user.id} style={[
                styles.userCard,
                isLezioniType && styles.userCardLezioni,
                isTempoType && styles.userCardTempo,
                !userSubscription && styles.userCardNoSub
              ]}>
                <View style={[
                  styles.userAvatar,
                  isLezioniType && styles.userAvatarLezioni,
                  isTempoType && styles.userAvatarTempo
                ]}>
                  {user.profile_image ? (
                    <Image source={{ uri: user.profile_image }} style={styles.userAvatarImage} />
                  ) : (
                    <Text style={styles.userAvatarText}>
                      {user.nome?.charAt(0)}{user.cognome?.charAt(0)}
                    </Text>
                  )}
                </View>
                <View style={styles.userInfoFlex}>
                  <Text style={styles.userName}>{user.nome} {user.cognome}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  {user.telefono && (
                    <Text style={styles.userPhone}>{user.telefono}</Text>
                  )}
                  {/* Badge tipo abbonamento */}
                  {userSubscription && (
                    <View style={[
                      styles.subTypeBadge,
                      isLezioniType && styles.subTypeBadgeLezioni,
                      isTempoType && styles.subTypeBadgeTempo
                    ]}>
                      <Ionicons 
                        name={isLezioniType ? 'fitness' : 'calendar'} 
                        size={12} 
                        color={COLORS.text} 
                      />
                      <Text style={styles.subTypeBadgeText}>
                        {isLezioniType ? `${userSubscription.lezioni_rimanenti} lez.` : ABBONAMENTO_INFO[userSubscription.tipo]?.nome}
                      </Text>
                    </View>
                  )}
                </View>
                {user.role === 'admin' ? (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.iconBtn}
                    onPress={() => handleDeleteUser(user.id, `${user.nome} ${user.cognome}`)}
                  >
                    <Ionicons name="trash" size={24} color={COLORS.error} />
                  </TouchableOpacity>
                )}
              </View>
              );
            })}
            {filteredUsers.length === 0 && userSearchQuery && (
              <Text style={styles.noResults}>Nessun utente trovato per "{userSearchQuery}"</Text>
            )}
          </>
        )}

        {/* SCADUTI TAB */}
        {activeTab === 'scaduti' && (
          <>
            <Text style={styles.scadutiTitle}>
              Abbonamenti da Rinnovare
            </Text>
            <Text style={styles.scadutiSubtitle}>
              {expiredSubscriptions.length} clienti con abbonamento scaduto
            </Text>
            
            {expiredSubscriptions.length === 0 ? (
              <View style={styles.emptyScaduti}>
                <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
                <Text style={styles.emptyScadutiText}>Nessun abbonamento scaduto!</Text>
                <Text style={styles.emptyScadutiSubtext}>Tutti i clienti sono in regola</Text>
              </View>
            ) : (
              [...expiredSubscriptions]
                .sort((a, b) => {
                  const nameA = `${a.user_cognome || ''} ${a.user_nome || ''}`.toLowerCase();
                  const nameB = `${b.user_cognome || ''} ${b.user_nome || ''}`.toLowerCase();
                  return nameA.localeCompare(nameB);
                })
                .map((sub) => {
                  const info = ABBONAMENTO_INFO[sub.tipo] || { nome: sub.tipo };
                  const scadenzaDate = new Date(sub.data_scadenza);
                  const oggi = new Date();
                  const giorniScaduto = Math.floor((oggi.getTime() - scadenzaDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <TouchableOpacity 
                      key={sub.id} 
                      style={styles.scadutiCard}
                      onPress={() => openEditModal(sub)}
                    >
                      <View style={styles.scadutiCardHeader}>
                        <View style={styles.scadutiUserInfo}>
                          <Ionicons name="person-circle" size={40} color={COLORS.error} />
                          <View>
                            <Text style={styles.scadutiUserName}>
                              {sub.user_cognome} {sub.user_nome}
                            </Text>
                            <Text style={styles.scadutiTipo}>{info.nome}</Text>
                          </View>
                        </View>
                        <View style={styles.scadutiBadge}>
                          <Text style={styles.scadutiBadgeText}>
                            {giorniScaduto > 0 ? `${giorniScaduto}g fa` : 'Oggi'}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.scadutiDetails}>
                        <View style={styles.scadutiDetailRow}>
                          <Ionicons name="calendar-outline" size={18} color={COLORS.error} />
                          <Text style={styles.scadutiDetailLabel}>Scaduto il:</Text>
                          <Text style={styles.scadutiDetailValue}>{formatDate(sub.data_scadenza)}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.scadutiAction}>
                        <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.scadutiActionText}>Assegna nuovo abbonamento</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
            )}
          </>
        )}
      </ScrollView>

      {/* Add Subscription Modal */}
      <Modal
        visible={showAddSubscription}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddSubscription(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuovo Abbonamento</Text>
              <TouchableOpacity onPress={() => {
                setShowAddSubscription(false);
                setSubscriptionUserSearch('');
                setSelectedUser('');
              }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Cerca Utente</Text>
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search" size={18} color={COLORS.textSecondary} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Nome o cognome..."
                placeholderTextColor={COLORS.textSecondary}
                value={subscriptionUserSearch}
                onChangeText={setSubscriptionUserSearch}
              />
              {subscriptionUserSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSubscriptionUserSearch('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.userList} horizontal showsHorizontalScrollIndicator={false}>
              {filteredUsersForSubscription.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[
                    styles.userOption,
                    selectedUser === user.id && styles.userOptionSelected,
                  ]}
                  onPress={() => setSelectedUser(user.id)}
                >
                  <Text
                    style={[
                      styles.userOptionText,
                      selectedUser === user.id && styles.userOptionTextSelected,
                    ]}
                  >
                    {user.nome} {user.cognome?.charAt(0)}.
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredUsersForSubscription.length === 0 && (
              <Text style={styles.noUsersText}>Nessun utente trovato</Text>
            )}

            <Text style={styles.modalLabel}>Tipo Abbonamento</Text>
            <View style={styles.typeGrid}>
              {Object.entries(ABBONAMENTO_INFO).map(([key, info]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.typeOption,
                    selectedType === key && styles.typeOptionSelected,
                  ]}
                  onPress={() => setSelectedType(key)}
                >
                  <Text
                    style={[
                      styles.typeOptionName,
                      selectedType === key && styles.typeOptionTextSelected,
                    ]}
                  >
                    {info.nome}
                  </Text>
                  <Text style={styles.typeOptionPrice}>{info.prezzo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {(selectedType === 'lezioni_8' || selectedType === 'lezioni_16') && (
              <>
                <Text style={styles.modalLabel}>Lezioni Rimanenti (opzionale)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder={`Default: ${selectedType === 'lezioni_8' ? '8' : '16'}`}
                    placeholderTextColor={COLORS.textSecondary}
                    value={customLessons}
                    onChangeText={setCustomLessons}
                    keyboardType="number-pad"
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.modalButton, addingSubscription && styles.modalButtonDisabled]}
              onPress={handleAddSubscription}
              disabled={addingSubscription}
            >
              {addingSubscription ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.modalButtonText}>Crea Abbonamento</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Subscription Modal */}
      <Modal
        visible={showEditSubscription}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditSubscription(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifica Abbonamento</Text>
              <TouchableOpacity onPress={() => setShowEditSubscription(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {editingSubscription && (
                <>
                  {/* Nome Cliente */}
                  <View style={styles.editUserInfo}>
                    <Text style={styles.editUserName}>
                      {editingSubscription.user_nome} {editingSubscription.user_cognome}
                    </Text>
                  </View>

                  {/* Selezione Tipo Abbonamento */}
                  <Text style={styles.modalLabel}>Tipo Abbonamento</Text>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[styles.typeOption, editType === 'lezioni_8' && styles.typeOptionSelected]}
                      onPress={() => {
                        setEditType('lezioni_8');
                        if (!editLessons || editType !== 'lezioni_8') setEditLessons('8');
                      }}
                    >
                      <Text style={[styles.typeOptionText, editType === 'lezioni_8' && styles.typeOptionTextSelected]}>8 Lezioni</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeOption, editType === 'lezioni_16' && styles.typeOptionSelected]}
                      onPress={() => {
                        setEditType('lezioni_16');
                        if (!editLessons || editType !== 'lezioni_16') setEditLessons('16');
                      }}
                    >
                      <Text style={[styles.typeOptionText, editType === 'lezioni_16' && styles.typeOptionTextSelected]}>16 Lezioni</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeOption, editType === 'mensile' && styles.typeOptionSelected]}
                      onPress={() => setEditType('mensile')}
                    >
                      <Text style={[styles.typeOptionText, editType === 'mensile' && styles.typeOptionTextSelected]}>Mensile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeOption, editType === 'trimestrale' && styles.typeOptionSelected]}
                      onPress={() => setEditType('trimestrale')}
                    >
                      <Text style={[styles.typeOptionText, editType === 'trimestrale' && styles.typeOptionTextSelected]}>Trimestrale</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Lezioni Rimanenti - solo per abbonamenti a lezioni */}
                  {(editType === 'lezioni_8' || editType === 'lezioni_16') && (
                    <>
                      <Text style={styles.modalLabel}>Lezioni Rimanenti</Text>
                      <View style={styles.lessonsEditor}>
                        <TouchableOpacity 
                          style={styles.lessonBtn}
                          onPress={() => setEditLessons(Math.max(0, parseInt(editLessons || '0') - 1).toString())}
                        >
                          <Ionicons name="remove" size={28} color={COLORS.text} />
                        </TouchableOpacity>
                        <TextInput
                          style={styles.lessonsInput}
                          value={editLessons}
                          onChangeText={setEditLessons}
                          keyboardType="number-pad"
                          textAlign="center"
                        />
                        <TouchableOpacity 
                          style={styles.lessonBtn}
                          onPress={() => setEditLessons((parseInt(editLessons || '0') + 1).toString())}
                        >
                          <Ionicons name="add" size={28} color={COLORS.text} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* Data Scadenza */}
                  <Text style={styles.modalLabel}>Data Scadenza</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="AAAA-MM-GG"
                      placeholderTextColor={COLORS.textSecondary}
                      value={editExpiry}
                      onChangeText={setEditExpiry}
                    />
                  </View>
                  
                  {/* Quick date buttons */}
                  <View style={styles.quickDateButtons}>
                    <TouchableOpacity 
                      style={styles.quickDateBtn}
                      onPress={() => {
                        const d = new Date();
                        d.setMonth(d.getMonth() + 1);
                        setEditExpiry(d.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.quickDateBtnText}>+1 Mese</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.quickDateBtn}
                      onPress={() => {
                        const d = new Date();
                        d.setMonth(d.getMonth() + 3);
                        setEditExpiry(d.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.quickDateBtnText}>+3 Mesi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.quickDateBtn}
                      onPress={() => {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 1);
                        setEditExpiry(d.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.quickDateBtnText}>+1 Anno</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Pulsanti Azioni */}
                  <View style={styles.modalActionsVertical}>
                    <TouchableOpacity
                      style={[styles.modalButtonLarge, styles.saveButtonLarge, savingEdit && styles.modalButtonDisabled]}
                      onPress={handleSaveEdit}
                      disabled={savingEdit}
                    >
                      {savingEdit ? (
                        <ActivityIndicator color={COLORS.text} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={24} color={COLORS.text} />
                          <Text style={styles.modalButtonTextLarge}>Salva Modifiche</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.modalButtonLarge, styles.deleteButtonLarge]}
                      onPress={() => {
                        setShowEditSubscription(false);
                        handleDeleteSubscription(editingSubscription.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={24} color={COLORS.error} />
                      <Text style={[styles.modalButtonTextLarge, { color: COLORS.error }]}>Elimina Abbonamento</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    padding: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  weekRange: {
    fontSize: 10,
    color: COLORS.primary,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.text,
  },
  badge: {
    backgroundColor: COLORS.error,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  refreshButtonText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '600',
  },
  spinning: {
    opacity: 0.6,
  },
  scrollContent: {
    padding: 12,
    paddingTop: 0,
    paddingBottom: 32,
  },
  statsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  // Presenze Totali Settimanali Card
  weeklyTotalCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  weeklyTotalLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    marginBottom: 8,
  },
  weeklyTotalNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  autoProcessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
    padding: 8,
    backgroundColor: COLORS.card,
    borderRadius: 8,
  },
  autoProcessText: {
    fontSize: 10,
    color: COLORS.success,
  },
  dayCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  dayCardPast: {
    opacity: 0.6,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  dayHeaderToday: {
    backgroundColor: COLORS.primary + '15',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  dayInfoLarge: {
    flex: 1,
  },
  dayDateLarge: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  dayDateToday: {
    color: COLORS.primary,
    fontSize: 20,
  },
  dayNameSmall: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dayNameTodaySmall: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  dayNameToday: {
    color: COLORS.primary,
  },
  dayDate: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dayStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  dayCountBadgeToday: {
    backgroundColor: COLORS.primary,
    transform: [{ scale: 1.1 }],
  },
  dayCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  lessonsContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 12,
  },
  lessonItem: {
    marginBottom: 8,
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingVertical: 8,
    borderLeftWidth: 4,
    backgroundColor: COLORS.cardLight,
    borderRadius: 8,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTime: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  lessonType: {
    fontSize: 10,
    fontWeight: '500',
  },
  lessonCount: {
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  lessonCountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  participantsList: {
    marginTop: 8,
    paddingLeft: 16,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  participantNumber: {
    fontSize: 10,
    color: COLORS.textSecondary,
    width: 24,
  },
  participantName: {
    flex: 1,
    fontSize: 10,
    color: COLORS.text,
  },
  removeButton: {
    padding: 4,
  },
  noParticipants: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 16,
  },
  noLessons: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  warningTitle: {
    color: COLORS.warning,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  addButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  subscriptionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiredCard: {
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionUser: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  subscriptionType: {
    fontSize: 10,
    color: COLORS.primary,
    marginTop: 2,
  },
  subscriptionLessons: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  subscriptionExpiry: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  subscriptionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    padding: 8,
    backgroundColor: COLORS.cardLight,
    borderRadius: 8,
  },
  // Legenda tipi abbonamento
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderRadius: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  userCardLezioni: {
    borderLeftColor: '#4CAF50',
    backgroundColor: '#4CAF5010',
  },
  userCardTempo: {
    borderLeftColor: '#2196F3',
    backgroundColor: '#2196F310',
  },
  userCardNoSub: {
    borderLeftColor: COLORS.textSecondary,
    opacity: 0.7,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  userAvatarLezioni: {
    backgroundColor: '#4CAF50',
  },
  userAvatarTempo: {
    backgroundColor: '#2196F3',
  },
  userAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  subTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.cardLight,
  },
  subTypeBadgeLezioni: {
    backgroundColor: '#4CAF5030',
  },
  subTypeBadgeTempo: {
    backgroundColor: '#2196F330',
  },
  subTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  adminBadge: {
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  userList: {
    marginBottom: 10,
  },
  userOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.cardLight,
    borderRadius: 20,
    marginRight: 8,
  },
  userOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  userOptionText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  userOptionTextSelected: {
    color: COLORS.text,
    fontWeight: '600',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  typeOption: {
    width: '48%',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  typeOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  typeOptionName: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  typeOptionTextSelected: {
    color: COLORS.text,
  },
  typeOptionPrice: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
  inputContainer: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  modalInput: {
    height: 50,
    color: COLORS.text,
    fontSize: 10,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  quickButton: {
    flex: 1,
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  editUserInfo: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  editUserName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  editSubscriptionType: {
    fontSize: 10,
    color: COLORS.primary,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
  },
  saveButton: {
    backgroundColor: COLORS.success,
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
  modalButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  // Nuovi stili per il modal di modifica abbonamento
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
    minWidth: '45%',
    alignItems: 'center',
  },
  typeOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
  },
  typeOptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  typeOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  lessonsEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
  },
  lessonBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lessonsInput: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    width: 80,
    textAlign: 'center',
  },
  quickDateButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  quickDateBtn: {
    flex: 1,
    backgroundColor: COLORS.cardLight,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickDateBtnText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
  },
  modalActionsVertical: {
    gap: 12,
    marginTop: 8,
  },
  modalButtonLarge: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveButtonLarge: {
    backgroundColor: COLORS.success,
  },
  deleteButtonLarge: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  modalButtonTextLarge: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 10,
    color: COLORS.text,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  iconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBtn: {
    padding: 8,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  editBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editBtnText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: COLORS.error,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  deleteBtnText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '600',
  },
  expiredBadge: {
    backgroundColor: COLORS.error,
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  userInfoFlex: {
    flex: 1,
  },
  adminBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '600',
  },
  deleteUserButton: {
    padding: 12,
    backgroundColor: COLORS.cardLight,
    borderRadius: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteUserButtonPressed: {
    backgroundColor: COLORS.border,
    opacity: 0.7,
  },
  deleteSubButton: {
    padding: 8,
    backgroundColor: COLORS.cardLight,
    borderRadius: 8,
    marginRight: 8,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  noResults: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 10,
    color: COLORS.text,
  },
  noUsersText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  // Riepilogo Giornaliero Styles
  riepilogoContainer: {
    paddingHorizontal: 16,
  },
  riepilogoTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  riepilogoDate: {
    fontSize: 10,
    color: COLORS.primary,
    marginBottom: 10,
  },
  totalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  totalNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  totalLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  riepilogoSectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 8,
  },
  lessonStatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  lessonStatColor: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 10,
  },
  lessonStatInfo: {
    flex: 1,
  },
  lessonStatTime: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  lessonStatType: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  lessonStatBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  lessonStatCount: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  lessonStatUnit: {
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  noDataText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
  },
  abbonamentoStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  abbonamentoStatCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  abbonamentoStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  abbonamentoStatLabel: {
    fontSize: 14,
    color: COLORS.text,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  abbonamentoStatSubLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  scalaLezioniButton: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  scalaLezioniButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  // Scaduti Tab Styles
  scadutiTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: 4,
  },
  scadutiSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  emptyScaduti: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyScadutiText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.success,
  },
  emptyScadutiSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  scadutiCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  scadutiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scadutiUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scadutiUserName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  scadutiTipo: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  scadutiBadge: {
    backgroundColor: COLORS.error + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scadutiBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
  scadutiDetails: {
    gap: 8,
    marginBottom: 12,
  },
  scadutiDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scadutiDetailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  scadutiDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  scadutiAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  scadutiActionText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
});
