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
  Subscription,
  User,
} from '../../src/services/api';
import {
  COLORS,
  ATTIVITA_INFO,
  ABBONAMENTO_INFO,
  GIORNI_DISPLAY,
  formatDate,
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
  const [activeTab, setActiveTab] = useState<'presenze' | 'abbonamenti' | 'utenti'>('presenze');
  
  const [weeklyBookings, setWeeklyBookings] = useState<WeeklyBookings | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [expiredSubscriptions, setExpiredSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Search
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [subscriptionUserSearch, setSubscriptionUserSearch] = useState<string>('');
  
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
  const [savingEdit, setSavingEdit] = useState(false);

  // Expanded days
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Filtered users based on search
  const filteredUsers = users.filter(user => {
    if (!userSearchQuery.trim()) return true;
    const searchLower = userSearchQuery.toLowerCase();
    return (
      user.nome?.toLowerCase().includes(searchLower) ||
      user.cognome?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.telefono?.includes(searchLower)
    );
  });

  // Filtered users for subscription modal
  const filteredUsersForSubscription = users.filter(u => {
    if (u.role === 'admin') return false;
    if (!subscriptionUserSearch.trim()) return true;
    const searchLower = subscriptionUserSearch.toLowerCase();
    return (
      u.nome?.toLowerCase().includes(searchLower) ||
      u.cognome?.toLowerCase().includes(searchLower)
    );
  });

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
      
      // Auto-expand today
      const today = new Date().toISOString().split('T')[0];
      setExpandedDays(new Set([today]));
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
    const expiryDate = new Date(subscription.data_scadenza);
    setEditExpiry(expiryDate.toISOString().split('T')[0]);
    setShowEditSubscription(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSubscription) return;
    
    setSavingEdit(true);
    try {
      const updateData: any = {};
      
      if (editLessons && editingSubscription.lezioni_rimanenti !== null) {
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
    // Elimina direttamente senza conferma (più veloce)
    try {
      await apiService.deleteSubscription(subscriptionId);
      await loadData();
    } catch (error) {
      console.error('Errore eliminazione abbonamento:', error);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    // Elimina direttamente senza conferma
    try {
      await apiService.deleteUser(userId);
      await loadData();
    } catch (error: any) {
      console.error('Errore eliminazione utente:', error);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      await apiService.cancelBooking(bookingId);
      await loadData();
    } catch (error) {
      console.error('Errore eliminazione prenotazione:', error);
    }
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
        {/* PRESENZE TAB - WEEKLY VIEW */}
        {activeTab === 'presenze' && weeklyBookings && (
          <>
            {/* Summary Stats */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{getTotalParticipants()}</Text>
                <Text style={styles.statLabel}>Prenotazioni Totali</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{getTotalLessonsWithBookings()}</Text>
                <Text style={styles.statLabel}>Lezioni con Iscritti</Text>
              </View>
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
              const isToday = day.data === new Date().toISOString().split('T')[0];
              const isPast = day.data < new Date().toISOString().split('T')[0];
              
              return (
                <View key={day.data} style={[styles.dayCard, isPast && styles.dayCardPast]}>
                  {/* Day Header */}
                  <TouchableOpacity 
                    style={styles.dayHeader}
                    onPress={() => toggleDay(day.data)}
                  >
                    <View style={styles.dayInfo}>
                      <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                        {GIORNI_DISPLAY[day.giorno]}
                        {isToday && ' (Oggi)'}
                      </Text>
                      <Text style={styles.dayDate}>{formatDate(day.data)}</Text>
                    </View>
                    <View style={styles.dayStats}>
                      <View style={styles.dayCountBadge}>
                        <Ionicons name="people" size={14} color={COLORS.text} />
                        <Text style={styles.dayCountText}>{dayTotalBookings}</Text>
                      </View>
                      <Ionicons 
                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                        size={20} 
                        color={COLORS.textSecondary} 
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

            {expiredSubscriptions.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, styles.warningTitle]}>
                  Abbonamenti Scaduti ({expiredSubscriptions.length})
                </Text>
                {expiredSubscriptions.map((sub) => {
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
                    {sub.scaduto && (
                      <Text style={styles.expiredBadge}>SCADUTO</Text>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity 
                      style={styles.actionBtn}
                      onPress={() => openEditModal(sub)}
                    >
                      <Ionicons name="create-outline" size={22} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionBtn}
                      onPress={() => handleDeleteSubscription(sub.id)}
                    >
                      <Ionicons name="trash-outline" size={22} color={COLORS.error} />
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
            {filteredUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {user.nome?.charAt(0)}{user.cognome?.charAt(0)}
                  </Text>
                </View>
                <View style={styles.userInfoFlex}>
                  <Text style={styles.userName}>{user.nome} {user.cognome}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  {user.telefono && (
                    <Text style={styles.userPhone}>{user.telefono}</Text>
                  )}
                </View>
                {user.role === 'admin' ? (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => handleDeleteUser(user.id, `${user.nome} ${user.cognome}`)}
                  >
                    <Ionicons name="trash-outline" size={22} color={COLORS.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {filteredUsers.length === 0 && userSearchQuery && (
              <Text style={styles.noResults}>Nessun utente trovato per "{userSearchQuery}"</Text>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifica Abbonamento</Text>
              <TouchableOpacity onPress={() => setShowEditSubscription(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {editingSubscription && (
              <>
                <View style={styles.editUserInfo}>
                  <Text style={styles.editUserName}>
                    {editingSubscription.user_nome} {editingSubscription.user_cognome}
                  </Text>
                  <Text style={styles.editSubscriptionType}>
                    {ABBONAMENTO_INFO[editingSubscription.tipo]?.nome || editingSubscription.tipo}
                  </Text>
                </View>

                {editingSubscription.lezioni_rimanenti !== null && (
                  <>
                    <Text style={styles.modalLabel}>Lezioni Rimanenti</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Numero lezioni"
                        placeholderTextColor={COLORS.textSecondary}
                        value={editLessons}
                        onChangeText={setEditLessons}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.quickButtons}>
                      <TouchableOpacity 
                        style={styles.quickButton}
                        onPress={() => setEditLessons(Math.max(0, parseInt(editLessons || '0') - 1).toString())}
                      >
                        <Ionicons name="remove" size={20} color={COLORS.text} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.quickButton}
                        onPress={() => setEditLessons((parseInt(editLessons || '0') + 1).toString())}
                      >
                        <Ionicons name="add" size={20} color={COLORS.text} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <Text style={styles.modalLabel}>Data Scadenza (AAAA-MM-GG)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="2025-12-31"
                    placeholderTextColor={COLORS.textSecondary}
                    value={editExpiry}
                    onChangeText={setEditExpiry}
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.deleteButton]}
                    onPress={() => {
                      setShowEditSubscription(false);
                      handleDeleteSubscription(editingSubscription.id);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.text} />
                    <Text style={styles.modalButtonText}>Elimina</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton, savingEdit && styles.modalButtonDisabled]}
                    onPress={handleSaveEdit}
                    disabled={savingEdit}
                  >
                    {savingEdit ? (
                      <ActivityIndicator color={COLORS.text} />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={20} color={COLORS.text} />
                        <Text style={styles.modalButtonText}>Salva</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  weekRange: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
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
    fontSize: 13,
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
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  refreshButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  spinning: {
    opacity: 0.6,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
  statsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    marginBottom: 12,
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
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  autoProcessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 8,
    backgroundColor: COLORS.card,
    borderRadius: 8,
  },
  autoProcessText: {
    fontSize: 12,
    color: COLORS.success,
  },
  dayCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dayCardPast: {
    opacity: 0.7,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  dayNameToday: {
    color: COLORS.primary,
  },
  dayDate: {
    fontSize: 13,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
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
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  lessonType: {
    fontSize: 13,
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
    fontSize: 14,
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
    fontSize: 13,
    color: COLORS.textSecondary,
    width: 24,
  },
  participantName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  removeButton: {
    padding: 4,
  },
  noParticipants: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 16,
  },
  noLessons: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
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
    maxHeight: '85%',
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
    marginTop: 8,
  },
  userList: {
    marginBottom: 16,
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
    marginBottom: 16,
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
  inputContainer: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  modalInput: {
    height: 50,
    color: COLORS.text,
    fontSize: 16,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
    padding: 16,
    marginBottom: 16,
  },
  editUserName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  editSubscriptionType: {
    fontSize: 14,
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
    padding: 16,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
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
    fontSize: 14,
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
    fontSize: 14,
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
    fontSize: 12,
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
    fontSize: 14,
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
    marginBottom: 12,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  noUsersText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
  },
});
