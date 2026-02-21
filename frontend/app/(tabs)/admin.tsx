import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
  apiService,
  Booking,
  Subscription,
  User,
  DailyStats,
} from '../../src/services/api';
import {
  COLORS,
  ATTIVITA_INFO,
  ABBONAMENTO_INFO,
  formatDate,
  getTodayDateString,
  getDateString,
} from '../../src/utils/constants';

export default function AdminScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'oggi' | 'abbonamenti' | 'utenti'>('oggi');
  
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [expiredSubscriptions, setExpiredSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [showAddSubscription, setShowAddSubscription] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('lezioni_8');
  const [addingSubscription, setAddingSubscription] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());

  const loadData = async () => {
    try {
      const dateString = getDateString(selectedDate);
      const [bookingsRes, statsRes, subsRes, expiredRes, usersRes] = await Promise.all([
        apiService.getBookingsByDate(dateString),
        apiService.getDailyStats(dateString),
        apiService.getAllSubscriptions(),
        apiService.getExpiredSubscriptions(),
        apiService.getAllUsers(),
      ]);
      
      setTodayBookings(bookingsRes.data);
      setDailyStats(statsRes.data);
      setSubscriptions(subsRes.data);
      setExpiredSubscriptions(expiredRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedDate])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleProcessDay = async () => {
    const dateString = getDateString(selectedDate);
    Alert.alert(
      'Elabora Fine Giornata',
      `Vuoi elaborare le prenotazioni del ${formatDate(dateString)}?\nLe lezioni verranno scalate dagli abbonamenti a lezione.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elabora',
          onPress: async () => {
            try {
              const response = await apiService.processEndOfDay(dateString);
              Alert.alert('Successo', `Elaborate ${response.data.processed} prenotazioni`);
              await loadData();
            } catch (error: any) {
              Alert.alert('Errore', error.response?.data?.detail || 'Errore durante l\'elaborazione');
            }
          },
        },
      ]
    );
  };

  const handleAddSubscription = async () => {
    if (!selectedUser) {
      Alert.alert('Errore', 'Seleziona un utente');
      return;
    }
    
    setAddingSubscription(true);
    try {
      await apiService.createSubscription({
        user_id: selectedUser,
        tipo: selectedType,
      });
      setShowAddSubscription(false);
      setSelectedUser('');
      Alert.alert('Successo', 'Abbonamento creato');
      await loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la creazione');
    } finally {
      setAddingSubscription(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    Alert.alert(
      'Elimina Prenotazione',
      'Sei sicuro di voler eliminare questa prenotazione?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.cancelBooking(bookingId);
              await loadData();
            } catch (error) {
              Alert.alert('Errore', 'Impossibile eliminare');
            }
          },
        },
      ]
    );
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
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
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'oggi' && styles.tabActive]}
          onPress={() => setActiveTab('oggi')}
        >
          <Text style={[styles.tabText, activeTab === 'oggi' && styles.tabTextActive]}>
            Oggi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'abbonamenti' && styles.tabActive]}
          onPress={() => setActiveTab('abbonamenti')}
        >
          <Text style={[styles.tabText, activeTab === 'abbonamenti' && styles.tabTextActive]}>
            Abbonamenti
          </Text>
          {expiredSubscriptions.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{expiredSubscriptions.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'utenti' && styles.tabActive]}
          onPress={() => setActiveTab('utenti')}
        >
          <Text style={[styles.tabText, activeTab === 'utenti' && styles.tabTextActive]}>
            Utenti
          </Text>
        </TouchableOpacity>
      </View>

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
        {/* TODAY TAB */}
        {activeTab === 'oggi' && (
          <>
            {/* Date Navigator */}
            <View style={styles.dateNavigator}>
              <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateNavButton}>
                <Ionicons name="chevron-back" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedDate(new Date())}
                style={styles.dateDisplay}
              >
                <Text style={styles.dateText}>{formatDate(getDateString(selectedDate))}</Text>
                {getDateString(selectedDate) === getTodayDateString() && (
                  <Text style={styles.todayLabel}>Oggi</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateNavButton}>
                <Ionicons name="chevron-forward" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Stats */}
            {dailyStats && (
              <View style={styles.statsCard}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{dailyStats.totale_prenotazioni}</Text>
                  <Text style={styles.statLabel}>Prenotazioni</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, dailyStats.abbonamenti_scaduti > 0 && styles.statWarning]}>
                    {dailyStats.abbonamenti_scaduti}
                  </Text>
                  <Text style={styles.statLabel}>Abb. Scaduti</Text>
                </View>
              </View>
            )}

            {/* Process Day Button */}
            <TouchableOpacity style={styles.processButton} onPress={handleProcessDay}>
              <Ionicons name="checkmark-done" size={20} color={COLORS.text} />
              <Text style={styles.processButtonText}>Elabora Fine Giornata</Text>
            </TouchableOpacity>

            {/* Bookings List */}
            <Text style={styles.sectionTitle}>
              Prenotazioni ({todayBookings.length})
            </Text>
            {todayBookings.length > 0 ? (
              todayBookings.map((booking) => {
                const info = ATTIVITA_INFO[booking.lesson_info?.tipo_attivita || ''] || {};
                return (
                  <View key={booking.id} style={styles.bookingCard}>
                    <View
                      style={[styles.bookingColor, { backgroundColor: info.colore || COLORS.primary }]}
                    />
                    <View style={styles.bookingContent}>
                      <Text style={styles.bookingTime}>{booking.lesson_info?.orario}</Text>
                      <Text style={styles.bookingType}>{info.nome || booking.lesson_info?.tipo_attivita}</Text>
                      <Text style={styles.bookingUser}>
                        {booking.user_nome} {booking.user_cognome}
                      </Text>
                    </View>
                    <View style={styles.bookingActions}>
                      {booking.abbonamento_scaduto && (
                        <View style={styles.expiredBadge}>
                          <Ionicons name="warning" size={12} color={COLORS.secondary} />
                        </View>
                      )}
                      {booking.lezione_scalata && (
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                      )}
                      <TouchableOpacity onPress={() => handleDeleteBooking(booking.id)}>
                        <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>Nessuna prenotazione</Text>
            )}
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

            {expiredSubscriptions.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, styles.warningTitle]}>
                  Abbonamenti Scaduti ({expiredSubscriptions.length})
                </Text>
                {expiredSubscriptions.map((sub) => {
                  const info = ABBONAMENTO_INFO[sub.tipo] || { nome: sub.tipo };
                  return (
                    <View key={sub.id} style={[styles.subscriptionCard, styles.expiredCard]}>
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
                      <Ionicons name="alert-circle" size={24} color={COLORS.error} />
                    </View>
                  );
                })}
              </>
            )}

            <Text style={styles.sectionTitle}>
              Tutti gli Abbonamenti ({subscriptions.length})
            </Text>
            {subscriptions.map((sub) => {
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
                  </View>
                  {sub.scaduto ? (
                    <Ionicons name="close-circle" size={24} color={COLORS.error} />
                  ) : (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* USERS TAB */}
        {activeTab === 'utenti' && (
          <>
            <Text style={styles.sectionTitle}>Utenti Registrati ({users.length})</Text>
            {users.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {user.nome?.charAt(0)}{user.cognome?.charAt(0)}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.nome} {user.cognome}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  {user.telefono && (
                    <Text style={styles.userPhone}>{user.telefono}</Text>
                  )}
                </View>
                {user.role === 'admin' && (
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield" size={14} color={COLORS.text} />
                  </View>
                )}
              </View>
            ))}
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
              <TouchableOpacity onPress={() => setShowAddSubscription(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Seleziona Utente</Text>
            <ScrollView style={styles.userList} horizontal showsHorizontalScrollIndicator={false}>
              {users.filter(u => u.role !== 'admin').map((user) => (
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
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
    fontSize: 14,
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
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 16,
  },
  dateNavButton: {
    padding: 8,
  },
  dateDisplay: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  todayLabel: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  statsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    marginBottom: 16,
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
  statWarning: {
    color: COLORS.warning,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  processButton: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  processButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  warningTitle: {
    color: COLORS.warning,
  },
  bookingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bookingColor: {
    width: 4,
    alignSelf: 'stretch',
  },
  bookingContent: {
    flex: 1,
    padding: 12,
  },
  bookingTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  bookingType: {
    fontSize: 14,
    color: COLORS.primary,
  },
  bookingUser: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  bookingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  expiredBadge: {
    backgroundColor: COLORS.warning,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  subscriptionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
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
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  subscriptionType: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 2,
  },
  subscriptionLessons: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  subscriptionExpiry: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  userList: {
    marginBottom: 24,
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
    fontSize: 14,
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
    marginBottom: 24,
  },
  typeOption: {
    width: '48%',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  typeOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  typeOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  typeOptionTextSelected: {
    color: COLORS.text,
  },
  typeOptionPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
  modalButton: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});
