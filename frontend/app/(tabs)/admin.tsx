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
  Platform,
  Pressable,
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
  const [activeTab, setActiveTab] = useState<'riepilogo' | 'presenze' | 'abbonamenti' | 'insoluti' | 'utenti' | 'archiviati'>('riepilogo');
  
  const [weeklyBookings, setWeeklyBookings] = useState<WeeklyBookings | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [expiredSubscriptions, setExpiredSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [archivedUsers, setArchivedUsers] = useState<User[]>([]);  // Clienti archiviati
  const [unpaidSubscriptions, setUnpaidSubscriptions] = useState<Subscription[]>([]);
  
  // Daily stats
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Search
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [subSearchQuery, setSubSearchQuery] = useState<string>('');
  const [subscriptionUserSearch, setSubscriptionUserSearch] = useState<string>('');
  
  // Add subscription modal
  const [showAddSubscription, setShowAddSubscription] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('lezioni_8');
  const [customLessons, setCustomLessons] = useState<string>('');
  const [newSubPagato, setNewSubPagato] = useState<boolean>(true);
  const [addingSubscription, setAddingSubscription] = useState(false);

  // Edit subscription modal
  const [showEditSubscription, setShowEditSubscription] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [editLessons, setEditLessons] = useState<string>('');
  const [editExpiry, setEditExpiry] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit user modal
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserNome, setEditUserNome] = useState('');
  const [editUserCognome, setEditUserCognome] = useState('');
  const [editUserSoprannome, setEditUserSoprannome] = useState('');
  const [editUserTelefono, setEditUserTelefono] = useState('');
  const [savingUserEdit, setSavingUserEdit] = useState(false);

  // Reset password modal
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // Filtered subscriptions based on search
  const filteredSubscriptions = subscriptions.filter(sub => {
    if (!subSearchQuery.trim()) return true;
    const searchLower = subSearchQuery.toLowerCase();
    return (
      sub.user_nome?.toLowerCase().includes(searchLower) ||
      sub.user_cognome?.toLowerCase().includes(searchLower)
    );
  });

  const loadData = async (showLoading = true) => {
    try {
      // Don't show loading spinner if we already have data
      if (showLoading && weeklyBookings === null) {
        setLoading(true);
      }
      const [weeklyRes, subsRes, expiredRes, usersRes] = await Promise.all([
        apiService.getWeeklyBookings(),
        apiService.getAllSubscriptions(),
        apiService.getExpiredSubscriptions(),
        apiService.getAllUsers(),
      ]);
      
      // Carica utenti archiviati separatamente per evitare errori
      try {
        const archivedRes = await apiService.getArchivedUsers();
        setArchivedUsers(archivedRes.data);
      } catch (e) {
        setArchivedUsers([]);
      }
      
      // Carica pagamenti insoluti
      try {
        const unpaidRes = await apiService.getUnpaidSubscriptions();
        setUnpaidSubscriptions(unpaidRes.data);
      } catch (e) {
        setUnpaidSubscriptions([]);
      }
      
      setWeeklyBookings(weeklyRes.data);
      setSubscriptions(subsRes.data);
      setExpiredSubscriptions(expiredRes.data);
      setUsers(usersRes.data);
      
      // Auto-expand today
      const today = getTodayDateString();
      setExpandedDays(new Set([today]));
      
      // Carica le statistiche giornaliere
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

  // Auto-refresh every 30 seconds (reduced from 10s to improve performance)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[Admin] Auto-refresh triggered');
      loadData(false); // Don't show loading spinner on auto-refresh
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Don't show loading if we already have data
      loadData(false);
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
        pagato: newSubPagato,
      };
      
      if (customLessons && (selectedType === 'lezioni_8' || selectedType === 'lezioni_16')) {
        data.lezioni_rimanenti = parseInt(customLessons);
      }
      
      await apiService.createSubscription(data);
      setShowAddSubscription(false);
      setSelectedUser('');
      setCustomLessons('');
      setNewSubPagato(true);
      if (Platform.OS === 'web') {
        alert('Abbonamento creato!');
      } else {
        Alert.alert('Successo', 'Abbonamento creato');
      }
      await loadData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Errore durante la creazione';
      if (Platform.OS === 'web') {
        alert(errorMsg);
      } else {
        Alert.alert('Errore', errorMsg);
      }
    } finally {
      setAddingSubscription(false);
    }
  };

  const handleMarkPaid = async (subscriptionId: string) => {
    try {
      await apiService.markSubscriptionPaid(subscriptionId);
      if (Platform.OS === 'web') {
        alert('Pagamento registrato!');
      } else {
        Alert.alert('Successo', 'Pagamento registrato!');
      }
      await loadData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Errore';
      if (Platform.OS === 'web') {
        alert(errorMsg);
      } else {
        Alert.alert('Errore', errorMsg);
      }
    }
  };

  const handleTogglePayment = async (subscriptionId: string, pagato: boolean) => {
    try {
      await apiService.updateSubscription(subscriptionId, { pagato });
      await loadData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Errore';
      if (Platform.OS === 'web') {
        alert(errorMsg);
      } else {
        Alert.alert('Errore', errorMsg);
      }
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
      
      // Allow editing lessons for lesson-based subscriptions
      if (editLessons && editingSubscription.lezioni_rimanenti !== null) {
        const newLessons = parseInt(editLessons);
        if (!isNaN(newLessons) && newLessons >= 0) {
          updateData.lezioni_rimanenti = newLessons;
        }
      }
      
      // Always allow editing expiry date - use format without .000Z
      if (editExpiry && editExpiry.match(/^\d{4}-\d{2}-\d{2}$/)) {
        updateData.data_scadenza = editExpiry + 'T23:59:59';
      }
      
      if (Object.keys(updateData).length === 0) {
        if (Platform.OS === 'web') {
          alert('Nessuna modifica da salvare');
        } else {
          Alert.alert('Errore', 'Nessuna modifica da salvare');
        }
        setSavingEdit(false);
        return;
      }
      
      await apiService.updateSubscription(editingSubscription.id, updateData);
      setShowEditSubscription(false);
      setEditingSubscription(null);
      if (Platform.OS === 'web') {
        alert('Abbonamento aggiornato!');
      } else {
        Alert.alert('Successo', 'Abbonamento aggiornato');
      }
      await loadData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Errore durante l\'aggiornamento';
      if (Platform.OS === 'web') {
        alert(errorMsg);
      } else {
        Alert.alert('Errore', errorMsg);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{type: 'sub' | 'user', id: string, name: string} | null>(null);

  const handleDeleteSubscription = async (subscriptionId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Vuoi eliminare questo abbonamento?')) {
        try {
          await apiService.deleteSubscription(subscriptionId);
          loadData();
        } catch (error) {
          console.error('Errore eliminazione:', error);
          alert('Errore durante l\'eliminazione');
        }
      }
    } else {
      setDeleteConfirmModal({ type: 'sub', id: subscriptionId, name: 'questo abbonamento' });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Vuoi eliminare ${userName}?`)) {
        try {
          await apiService.deleteUser(userId);
          loadData();
        } catch (error) {
          console.error('Errore eliminazione:', error);
          alert('Errore durante l\'eliminazione');
        }
      }
    } else {
      setDeleteConfirmModal({ type: 'user', id: userId, name: userName });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmModal) return;
    try {
      if (deleteConfirmModal.type === 'sub') {
        await apiService.deleteSubscription(deleteConfirmModal.id);
      } else {
        await apiService.deleteUser(deleteConfirmModal.id);
      }
      setDeleteConfirmModal(null);
      loadData();
    } catch (error) {
      console.error('Errore eliminazione:', error);
      setDeleteConfirmModal(null);
    }
  };

  // Imposta ruolo utente (promuovi/degrada istruttore)
  const handleSetRole = async (userId: string, role: string, userName: string) => {
    const action = role === 'istruttore' ? 'promuovere a Istruttore' : 'riportare a Cliente';
    
    if (Platform.OS === 'web') {
      if (window.confirm(`Vuoi ${action} ${userName}?`)) {
        try {
          await apiService.setUserRole(userId, role);
          alert(`${userName} è ora ${role === 'istruttore' ? 'un Istruttore' : 'un Cliente'}`);
          loadData();
        } catch (error: any) {
          alert(`Errore: ${error.response?.data?.detail || 'Impossibile cambiare ruolo'}`);
        }
      }
    } else {
      Alert.alert(
        'Cambia Ruolo',
        `Vuoi ${action} ${userName}?`,
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Sì', 
            onPress: async () => {
              try {
                await apiService.setUserRole(userId, role);
                Alert.alert('Successo', `${userName} è ora ${role === 'istruttore' ? 'un Istruttore' : 'un Cliente'}`);
                loadData();
              } catch (error: any) {
                Alert.alert('Errore', error.response?.data?.detail || 'Impossibile cambiare ruolo');
              }
            }
          }
        ]
      );
    }
  };

  // Archivia cliente (lo mette in stato non attivo)
  const handleArchiveUser = async (userId: string, userName: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Vuoi archiviare ${userName}? Il cliente non verrà eliminato ma spostato nella sezione "Archiviati".`)) {
        try {
          await apiService.archiveUser(userId);
          alert(`${userName} è stato archiviato`);
          loadData();
        } catch (error: any) {
          alert(`Errore: ${error.response?.data?.detail || 'Impossibile archiviare'}`);
        }
      }
    } else {
      Alert.alert(
        'Archivia Cliente',
        `Vuoi archiviare ${userName}?\n\nIl cliente non verrà eliminato ma spostato nella sezione "Archiviati". Potrai riattivarlo in qualsiasi momento.`,
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Sì, Archivia', 
            onPress: async () => {
              try {
                await apiService.archiveUser(userId);
                Alert.alert('Archiviato', `${userName} è stato archiviato con successo`);
                loadData();
              } catch (error: any) {
                Alert.alert('Errore', error.response?.data?.detail || 'Impossibile archiviare');
              }
            }
          }
        ]
      );
    }
  };

  // Riattiva cliente archiviato
  const handleRestoreUser = async (userId: string, userName: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Vuoi riattivare ${userName}?`)) {
        try {
          await apiService.restoreUser(userId);
          alert(`${userName} è stato riattivato!`);
          loadData();
        } catch (error: any) {
          alert(`Errore: ${error.response?.data?.detail || 'Impossibile riattivare'}`);
        }
      }
    } else {
      Alert.alert(
        'Riattiva Cliente',
        `Vuoi riattivare ${userName}?`,
        [
          { text: 'No', style: 'cancel' },
          { 
            text: 'Sì, Riattiva', 
            style: 'default',
            onPress: async () => {
              try {
                await apiService.restoreUser(userId);
                Alert.alert('Successo! 🎉', `${userName} è stato riattivato e torna nella lista clienti`);
                loadData();
              } catch (error: any) {
                Alert.alert('Errore', error.response?.data?.detail || 'Impossibile riattivare');
              }
            }
          }
        ]
      );
    }
  };

  const openEditUserModal = (user: User) => {
    setEditingUser(user);
    setEditUserNome(user.nome || '');
    setEditUserCognome(user.cognome || '');
    setEditUserSoprannome(user.soprannome || '');
    setEditUserTelefono(user.telefono || '');
    setShowEditUser(true);
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    
    setSavingUserEdit(true);
    try {
      await apiService.updateUser(editingUser.id, {
        nome: editUserNome,
        cognome: editUserCognome,
        soprannome: editUserSoprannome || undefined,
        telefono: editUserTelefono || undefined,
      });
      setShowEditUser(false);
      setEditingUser(null);
      Alert.alert('Successo', 'Utente aggiornato');
      await loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante l\'aggiornamento');
    } finally {
      setSavingUserEdit(false);
    }
  };

  const openResetPasswordModal = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowResetPassword(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    
    if (newPassword.length < 6) {
      Alert.alert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Errore', 'Le password non coincidono');
      return;
    }
    
    setResettingPassword(true);
    try {
      await apiService.resetUserPassword(resetPasswordUser.id, newPassword);
      setShowResetPassword(false);
      setResetPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Successo', 'Password resettata con successo');
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il reset');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler eliminare questa prenotazione?')) {
        try {
          await apiService.cancelBooking(bookingId);
          await loadData();
        } catch (error) {
          console.error('Errore eliminazione prenotazione:', error);
          alert('Errore durante eliminazione');
        }
      }
    } else {
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
          style={[styles.tab, activeTab === 'riepilogo' && styles.tabActive]}
          onPress={() => setActiveTab('riepilogo')}
        >
          <Text style={[styles.tabText, activeTab === 'riepilogo' && styles.tabTextActive]}>
            Oggi
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
          style={[styles.tab, activeTab === 'insoluti' && styles.tabActive]}
          onPress={() => setActiveTab('insoluti')}
        >
          <Text style={[styles.tabText, activeTab === 'insoluti' && styles.tabTextActive]}>
            Insoluti{unpaidSubscriptions.length > 0 ? ` (${unpaidSubscriptions.length})` : ''}
          </Text>
          {unpaidSubscriptions.length > 0 && activeTab !== 'insoluti' && (
            <View style={styles.unpaidBadge} />
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
        <TouchableOpacity
          style={[styles.tab, activeTab === 'archiviati' && styles.tabActive, archivedUsers.length > 0 && styles.tabWithBadge]}
          onPress={() => setActiveTab('archiviati')}
        >
          <Text style={[styles.tabText, activeTab === 'archiviati' && styles.tabTextActive]}>
            📦 {archivedUsers.length > 0 ? `(${archivedUsers.length})` : ''}
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
                  <Text style={styles.totalLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>Presenze Totali Oggi</Text>
                </View>

                {/* Lezioni Scalate Card */}
                <View style={[styles.totalCard, { backgroundColor: COLORS.error + '20' }]}>
                  <Text style={[styles.totalNumber, { color: COLORS.error }]}>{dailyStats.lezioni_scalate}</Text>
                  <Text style={styles.totalLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>Lezioni Scalate</Text>
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
              </>
            ) : (
              <Text style={styles.noDataText}>Caricamento statistiche...</Text>
            )}
          </View>
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

            <Text style={styles.sectionTitle}>
              Tutti gli Abbonamenti ({filteredSubscriptions.length}{subSearchQuery ? ` di ${subscriptions.length}` : ''})
            </Text>
            
            {/* Search Bar Abbonamenti */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cerca cliente per nome..."
                placeholderTextColor={COLORS.textSecondary}
                value={subSearchQuery}
                onChangeText={setSubSearchQuery}
              />
              {subSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSubSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            
            {filteredSubscriptions.length === 0 && subSearchQuery ? (
              <Text style={styles.noResults}>Nessun abbonamento trovato per "{subSearchQuery}"</Text>
            ) : (
              filteredSubscriptions.map((sub) => {
              const info = ABBONAMENTO_INFO[sub.tipo] || { nome: sub.tipo };
              const isTimeBasedSub = sub.tipo === 'mensile' || sub.tipo === 'trimestrale';
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
                    {isTimeBasedSub && sub.lezioni_fatte !== undefined && (
                      <Text style={[styles.subscriptionLessons, { color: COLORS.success }]}>
                        {sub.lezioni_fatte} lezioni effettuate
                      </Text>
                    )}
                    <Text style={styles.subscriptionExpiry}>
                      Scadenza: {formatDate(sub.data_scadenza)}
                    </Text>
                    {sub.scaduto && (
                      <Text style={styles.expiredBadge}>SCADUTO</Text>
                    )}
                    {!sub.pagato && (
                      <Text style={styles.unpaidLabel}>DA SALDARE</Text>
                    )}
                  </View>
                  <View style={styles.iconActions}>
                    {sub.pagato ? (
                      <TouchableOpacity 
                        style={styles.markUnpaidBtn}
                        onPress={() => handleTogglePayment(sub.id, false)}
                      >
                        <Ionicons name="alert-circle" size={18} color="#f59e0b" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={styles.markPaidBtnSmall}
                        onPress={() => handleMarkPaid(sub.id)}
                      >
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={styles.iconBtn}
                      onPress={() => openEditModal(sub)}
                    >
                      <Ionicons name="pencil" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ padding: 12, backgroundColor: COLORS.error, borderRadius: 8, marginLeft: 8 }}
                      onPress={() => handleDeleteSubscription(sub.id)}
                    >
                      <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Elimina</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
            )}
          </>
        )}

        {/* INSOLUTI TAB */}
        {activeTab === 'insoluti' && (
          <>
            <Text style={styles.sectionTitle}>
              Pagamenti da Saldare ({unpaidSubscriptions.length})
            </Text>
            
            {unpaidSubscriptions.length === 0 ? (
              <View style={styles.emptyInsoluti}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                <Text style={styles.emptyInsolutiText}>Tutti i pagamenti sono in regola!</Text>
              </View>
            ) : (
              unpaidSubscriptions.map((sub) => {
                const info = ABBONAMENTO_INFO[sub.tipo] || { nome: sub.tipo, prezzo: '?' };
                return (
                  <View key={sub.id} style={styles.insolutiCard}>
                    <View style={styles.insolutiInfo}>
                      <Text style={styles.insolutiUser}>{sub.user_nome} {sub.user_cognome}</Text>
                      <Text style={styles.insolutiType}>{info.nome} — {info.prezzo}</Text>
                      <Text style={styles.insolutiDate}>Attivato: {formatDate(sub.data_inizio)}</Text>
                      <Text style={styles.insolutiDate}>Scadenza: {formatDate(sub.data_scadenza)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.markPaidButton}
                      onPress={() => handleMarkPaid(sub.id)}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.markPaidText}>Pagato</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
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
                <View style={styles.userMainRow}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {user.nome?.charAt(0)}{user.cognome?.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.userInfoCompact}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.soprannome ? `"${user.soprannome}" ` : ''}{user.nome} {user.cognome}
                    </Text>
                    <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                  </View>
                  {user.role === 'admin' ? (
                    <View style={styles.adminBadgeSmall}>
                      <Ionicons name="shield" size={14} color="#FFF" />
                    </View>
                  ) : user.role === 'istruttore' ? (
                    <TouchableOpacity 
                      style={styles.istruttoreBadgeSmall}
                      onPress={() => handleSetRole(user.id, 'client', `${user.nome} ${user.cognome}`)}
                    >
                      <Ionicons name="fitness" size={14} color="#FFF" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {user.role !== 'admin' && (
                  <View style={styles.userActionsRow}>
                    {user.role !== 'istruttore' && (
                      <TouchableOpacity 
                        style={styles.actionBtnSmall}
                        onPress={() => handleSetRole(user.id, 'istruttore', `${user.nome} ${user.cognome}`)}
                      >
                        <Ionicons name="fitness-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.actionBtnText}>Istruttore</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={styles.actionBtnSmall}
                      onPress={() => openEditUserModal(user)}
                    >
                      <Ionicons name="pencil" size={16} color={COLORS.primary} />
                      <Text style={styles.actionBtnText}>Modifica</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtnSmall, { backgroundColor: '#FF980020' }]}
                      onPress={() => openResetPasswordModal(user)}
                    >
                      <Ionicons name="key-outline" size={16} color="#FF9800" />
                      <Text style={[styles.actionBtnText, { color: '#FF9800' }]}>Reset PW</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtnSmall, { backgroundColor: '#6366f120' }]}
                      onPress={() => handleArchiveUser(user.id, `${user.nome} ${user.cognome}`)}
                    >
                      <Ionicons name="archive-outline" size={16} color="#6366f1" />
                      <Text style={[styles.actionBtnText, { color: '#6366f1' }]}>Archivia</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtnSmall, { backgroundColor: COLORS.error + '20' }]}
                      onPress={() => handleDeleteUser(user.id, `${user.nome} ${user.cognome}`)}
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
            {filteredUsers.length === 0 && userSearchQuery && (
              <Text style={styles.noResults}>Nessun utente trovato per "{userSearchQuery}"</Text>
            )}
          </>
        )}

        {/* TAB ARCHIVIATI - Clienti non attivi */}
        {activeTab === 'archiviati' && (
          <>
            <View style={styles.archivedHeader}>
              <Ionicons name="archive" size={24} color="#6366f1" />
              <Text style={styles.archivedTitle}>Clienti Archiviati</Text>
            </View>
            <Text style={styles.archivedSubtitle}>
              Questi clienti sono stati archiviati (es. abbonamento scaduto e non rinnovato). 
              Puoi riattivarliin qualsiasi momento.
            </Text>

            {archivedUsers.length === 0 ? (
              <View style={styles.emptyArchivedCard}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                <Text style={styles.emptyArchivedTitle}>Nessun cliente archiviato</Text>
                <Text style={styles.emptyArchivedText}>
                  Tutti i tuoi clienti sono attivi! 🎉
                </Text>
              </View>
            ) : (
              archivedUsers.map((user) => (
                <View key={user.id} style={styles.archivedUserCard}>
                  <View style={styles.userMainRow}>
                    <View style={[styles.userAvatar, { backgroundColor: '#6366f130' }]}>
                      <Text style={[styles.userAvatarText, { color: '#6366f1' }]}>
                        {user.nome?.charAt(0)}{user.cognome?.charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.userInfoCompact}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {user.soprannome ? `"${user.soprannome}" ` : ''}{user.nome} {user.cognome}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                      {user.telefono && (
                        <Text style={styles.userPhone}>{user.telefono}</Text>
                      )}
                    </View>
                    <View style={styles.archivedBadge}>
                      <Ionicons name="pause-circle" size={16} color="#6366f1" />
                    </View>
                  </View>
                  <View style={styles.archivedActionsRow}>
                    <TouchableOpacity 
                      style={styles.restoreButton}
                      onPress={() => handleRestoreUser(user.id, `${user.nome} ${user.cognome}`)}
                    >
                      <Ionicons name="refresh-circle" size={18} color="#FFF" />
                      <Text style={styles.restoreButtonText}>Riattiva Cliente</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.deleteArchivedButton}
                      onPress={() => handleDeleteUser(user.id, `${user.nome} ${user.cognome}`)}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
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
                setCustomLessons('');
                setNewSubPagato(true);
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
                autoCapitalize="none"
              />
              {subscriptionUserSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSubscriptionUserSearch('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            
            <ScrollView style={styles.userListHorizontal} horizontal showsHorizontalScrollIndicator={false}>
              {filteredUsersForSubscription.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[
                    styles.userOptionHorizontal,
                    selectedUser === user.id && styles.userOptionSelected,
                  ]}
                  onPress={() => setSelectedUser(user.id)}
                >
                  <Text
                    style={[
                      styles.userOptionText,
                      selectedUser === user.id && styles.userOptionTextSelected,
                    ]}
                    numberOfLines={1}
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

            <Text style={styles.modalLabel}>Stato Pagamento</Text>
            <View style={styles.paymentToggle}>
              <TouchableOpacity
                style={[styles.paymentOption, newSubPagato && styles.paymentOptionActive]}
                onPress={() => setNewSubPagato(true)}
              >
                <Ionicons name="checkmark-circle" size={20} color={newSubPagato ? '#fff' : COLORS.success} />
                <Text style={[styles.paymentOptionText, newSubPagato && styles.paymentOptionTextActive]}>Pagato</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentOption, !newSubPagato && styles.paymentOptionUnpaid]}
                onPress={() => setNewSubPagato(false)}
              >
                <Ionicons name="alert-circle" size={20} color={!newSubPagato ? '#fff' : COLORS.error} />
                <Text style={[styles.paymentOptionText, !newSubPagato && styles.paymentOptionTextActive]}>Da Saldare</Text>
              </TouchableOpacity>
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

      {/* Edit User Modal */}
      <Modal
        visible={showEditUser}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditUser(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifica Utente</Text>
              <TouchableOpacity onPress={() => setShowEditUser(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {editingUser && (
              <>
                <Text style={styles.modalLabel}>Nome</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Nome"
                    placeholderTextColor={COLORS.textSecondary}
                    value={editUserNome}
                    onChangeText={setEditUserNome}
                  />
                </View>

                <Text style={styles.modalLabel}>Cognome</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Cognome"
                    placeholderTextColor={COLORS.textSecondary}
                    value={editUserCognome}
                    onChangeText={setEditUserCognome}
                  />
                </View>

                <Text style={styles.modalLabel}>Soprannome</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Soprannome (opzionale)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={editUserSoprannome}
                    onChangeText={setEditUserSoprannome}
                  />
                </View>

                <Text style={styles.modalLabel}>Telefono</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Telefono"
                    placeholderTextColor={COLORS.textSecondary}
                    value={editUserTelefono}
                    onChangeText={setEditUserTelefono}
                    keyboardType="phone-pad"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, savingUserEdit && styles.modalButtonDisabled]}
                  onPress={handleSaveUserEdit}
                  disabled={savingUserEdit}
                >
                  {savingUserEdit ? (
                    <ActivityIndicator color={COLORS.text} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color={COLORS.text} />
                      <Text style={styles.modalButtonText}>Salva</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Conferma Eliminazione */}
      <Modal
        visible={deleteConfirmModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 24 }]}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16, textAlign: 'center' }}>
              Conferma Eliminazione
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 24, textAlign: 'center' }}>
              Vuoi eliminare {deleteConfirmModal?.name}?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={{ flex: 1, padding: 14, backgroundColor: COLORS.cardLight, borderRadius: 10, alignItems: 'center' }}
                onPress={() => setDeleteConfirmModal(null)}
              >
                <Text style={{ color: COLORS.text, fontWeight: '600' }}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, padding: 14, backgroundColor: COLORS.error, borderRadius: 10, alignItems: 'center' }}
                onPress={confirmDelete}
              >
                <Text style={{ color: '#FFF', fontWeight: '600' }}>Sì, Elimina</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={showResetPassword}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowResetPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setShowResetPassword(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {resetPasswordUser && (
              <View style={styles.resetPasswordInfo}>
                <Ionicons name="person-circle-outline" size={40} color={COLORS.primary} />
                <Text style={styles.resetPasswordName}>
                  {resetPasswordUser.nome} {resetPasswordUser.cognome}
                </Text>
                <Text style={styles.resetPasswordEmail}>{resetPasswordUser.email}</Text>
              </View>
            )}

            <Text style={styles.modalLabel}>Nuova Password</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Minimo 6 caratteri"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!showNewPassword}
              />
              <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                <Ionicons name={showNewPassword ? 'eye-outline' : 'eye-off-outline'} size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>Conferma Password</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Ripeti la password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!showConfirmPassword}
              />
              <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, resettingPassword && styles.modalButtonDisabled]}
              onPress={handleResetPassword}
              disabled={resettingPassword}
            >
              {resettingPassword ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.modalButtonText}>Resetta Password</Text>
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
    padding: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  weekRange: {
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '600',
  },
  spinning: {
    opacity: 0.6,
  },
  scrollContent: {
    padding: 10,
    paddingTop: 0,
    paddingBottom: 100,
  },
  statsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
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
    marginBottom: 10,
    padding: 8,
    backgroundColor: COLORS.card,
    borderRadius: 8,
  },
  autoProcessText: {
    fontSize: 12,
    color: COLORS.success,
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  processButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  dayCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  dayCardPast: {
    opacity: 0.7,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  dayNameToday: {
    color: COLORS.primary,
  },
  dayDate: {
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  lessonType: {
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    color: COLORS.textSecondary,
    width: 24,
  },
  participantName: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
  },
  participantNameConfirmed: {
    color: COLORS.success,
    fontWeight: '600',
  },
  removeButton: {
    padding: 4,
  },
  noParticipants: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 16,
  },
  noLessons: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  subscriptionType: {
    fontSize: 12,
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
    padding: 12,
    marginBottom: 8,
  },
  userMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  userAvatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  userInfoCompact: {
    flex: 1,
    marginRight: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  userPhone: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  userActionsRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  actionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
  },
  adminBadgeSmall: {
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  istruttoreBadgeSmall: {
    backgroundColor: '#8B5CF6',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminBadge: {
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  istruttoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  istruttoreBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  promoteBtn: {
    padding: 8,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 4,
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
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  userOptionTextSelected: {
    color: COLORS.text,
    fontWeight: '600',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeOption: {
    width: '48%',
    backgroundColor: COLORS.cardLight,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  typeOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  typeOptionName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  typeOptionTextSelected: {
    color: COLORS.text,
  },
  typeOptionPrice: {
    fontSize: 12,
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
    height: 44,
    color: COLORS.text,
    fontSize: 14,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  quickButton: {
    flex: 1,
    backgroundColor: COLORS.cardLight,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  editUserInfo: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  editUserName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  editSubscriptionType: {
    fontSize: 12,
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
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  resetPasswordInfo: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 16,
  },
  resetPasswordName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  resetPasswordEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  passwordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '600',
  },
  expiredBadge: {
    backgroundColor: COLORS.error,
    color: COLORS.text,
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    color: COLORS.text,
  },
  noUsersText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  userListHorizontal: {
    marginBottom: 8,
    maxHeight: 44,
  },
  userOptionHorizontal: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.cardLight,
    borderRadius: 20,
    marginRight: 8,
  },
  // Riepilogo Giornaliero Styles
  riepilogoContainer: {
    paddingHorizontal: 16,
  },
  riepilogoTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  riepilogoDate: {
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 10,
  },
  totalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
    minWidth: '100%',
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
    textAlign: 'center',
  },
  riepilogoSectionTitle: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  lessonStatType: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  lessonStatUnit: {
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  noDataText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
  },

  // Lotteria Admin
  lotterySection: {
    padding: 16,
  },
  lotterySectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  lotteryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  lotteryCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 12,
  },
  currentPrizeBox: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  currentPrizeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  currentPrizeDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  noPrize: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  lotteryInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lotteryButton: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  lotteryButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: 'bold',
  },
  lotteryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  lotteryInfoText: {
    fontSize: 13,
    color: COLORS.text,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  winnerMedal: {
    fontSize: 22,
    marginRight: 10,
  },
  winnerInfo: {
    flex: 1,
  },
  winnerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  winnerMonth: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  winnerTickets: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  winnerStatsBox: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  noWinners: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  
  // ===== STILI SEZIONE ARCHIVIATI =====
  tabWithBadge: {
    // Evidenzia tab se ci sono archiviati
  },
  archivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  archivedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  archivedSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyArchivedCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.success + '30',
  },
  emptyArchivedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.success,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyArchivedText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  archivedUserCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#6366f130',
  },
  archivedBadge: {
    backgroundColor: '#6366f120',
    borderRadius: 12,
    padding: 6,
  },
  archivedActionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
    alignItems: 'center',
  },
  restoreButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  restoreButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteArchivedButton: {
    backgroundColor: COLORS.error + '15',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  // Pagamento toggle nel modal
  paymentToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.cardLight,
    backgroundColor: COLORS.cardLight,
  },
  paymentOptionActive: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
  paymentOptionUnpaid: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error,
  },
  paymentOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  paymentOptionTextActive: {
    color: '#fff',
  },
  // Badge insoluto nella card abbonamento
  unpaidLabel: {
    backgroundColor: '#f59e0b',
    color: '#000',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  // Pallino rosso nel tab
  unpaidBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  // Sezione insoluti
  emptyInsoluti: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyInsolutiText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  insolutiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  insolutiInfo: {
    flex: 1,
  },
  insolutiUser: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  insolutiType: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  insolutiDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  markPaidText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  markUnpaidBtn: {
    padding: 10,
    backgroundColor: '#f59e0b20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  markPaidBtnSmall: {
    padding: 10,
    backgroundColor: COLORS.success,
    borderRadius: 8,
  },
});
