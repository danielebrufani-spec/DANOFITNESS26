import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { apiService, User } from '../../src/services/api';
import {
  COLORS,
  ATTIVITA_INFO,
  GIORNI_DISPLAY,
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
  const [activeTab, setActiveTab] = useState<'presenze' | 'utenti'>('presenze');
  
  const [weeklyBookings, setWeeklyBookings] = useState<WeeklyBookings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const loadData = async () => {
    try {
      const [weeklyRes, usersRes] = await Promise.all([
        apiService.getWeeklyBookings(),
        apiService.getUsers(),
      ]);
      
      setWeeklyBookings(weeklyRes.data);
      setUsers(usersRes.data);
      
      // Auto-expand today
      const today = getTodayDateString();
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

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const toggleDay = (date: string) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDays(newExpanded);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      await apiService.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    if (!userSearchQuery) return true;
    const searchLower = userSearchQuery.toLowerCase();
    return (
      user.nome?.toLowerCase().includes(searchLower) ||
      user.cognome?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Caricamento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pannello Admin</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'presenze' && styles.activeTab]}
          onPress={() => setActiveTab('presenze')}
        >
          <Ionicons 
            name="calendar" 
            size={20} 
            color={activeTab === 'presenze' ? COLORS.primary : COLORS.textSecondary} 
          />
          <Text style={[styles.tabText, activeTab === 'presenze' && styles.activeTabText]}>
            Presenze
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'utenti' && styles.activeTab]}
          onPress={() => setActiveTab('utenti')}
        >
          <Ionicons 
            name="people" 
            size={20} 
            color={activeTab === 'utenti' ? COLORS.primary : COLORS.textSecondary} 
          />
          <Text style={[styles.tabText, activeTab === 'utenti' && styles.activeTabText]}>
            Utenti
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* PRESENZE TAB */}
        {activeTab === 'presenze' && weeklyBookings && (
          <View style={styles.section}>
            <Text style={styles.weekRange}>
              Settimana: {weeklyBookings.settimana_inizio} - {weeklyBookings.settimana_fine}
            </Text>
            
            {weeklyBookings.giorni.map((day) => {
              const isExpanded = expandedDays.has(day.data);
              const isToday = day.data === getTodayDateString();
              const totalBookings = day.lezioni.reduce((sum, l) => sum + l.totale_iscritti, 0);

              return (
                <View key={day.data} style={styles.dayCard}>
                  <TouchableOpacity
                    style={[styles.dayHeader, isToday && styles.todayHeader]}
                    onPress={() => toggleDay(day.data)}
                  >
                    <View style={styles.dayInfo}>
                      <Text style={[styles.dayName, isToday && styles.todayText]}>
                        {GIORNI_DISPLAY[day.giorno] || day.giorno}
                      </Text>
                      <Text style={styles.dayDate}>{day.data}</Text>
                    </View>
                    <View style={styles.dayStats}>
                      <Text style={styles.bookingCount}>{totalBookings} prenotazioni</Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.lessonsContainer}>
                      {day.lezioni.map((lesson) => {
                        const info = ATTIVITA_INFO[lesson.tipo_attivita] || {};
                        return (
                          <View key={lesson.lesson_id} style={styles.lessonCard}>
                            <View style={styles.lessonHeader}>
                              <View style={[styles.lessonColor, { backgroundColor: info.colore || COLORS.primary }]} />
                              <Text style={styles.lessonTime}>{lesson.orario}</Text>
                              <Text style={styles.lessonType}>{info.nome || lesson.tipo_attivita}</Text>
                              <Text style={styles.participantCount}>({lesson.totale_iscritti})</Text>
                            </View>
                            {lesson.partecipanti.length > 0 && (
                              <View style={styles.participantsList}>
                                {lesson.partecipanti.map((p) => (
                                  <Text key={p.booking_id} style={styles.participantName}>
                                    • {p.nome} {p.cognome}
                                  </Text>
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* UTENTI TAB */}
        {activeTab === 'utenti' && (
          <View style={styles.section}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cerca utente..."
                placeholderTextColor={COLORS.textSecondary}
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
              />
            </View>

            <Text style={styles.userCount}>{filteredUsers.length} utenti</Text>

            {filteredUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userInitials}>
                    {user.nome?.[0]}{user.cognome?.[0]}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.nome} {user.cognome}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
                {user.role !== 'admin' && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteUser(user.id, `${user.nome} ${user.cognome}`)}
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
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
  loadingText: {
    color: COLORS.text,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  refreshButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: COLORS.primary + '20',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 20,
  },
  weekRange: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  dayCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  todayHeader: {
    backgroundColor: COLORS.primary + '20',
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  todayText: {
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
    gap: 8,
  },
  bookingCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  lessonsContainer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  lessonCard: {
    marginBottom: 12,
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lessonColor: {
    width: 4,
    height: 24,
    borderRadius: 2,
  },
  lessonTime: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  lessonType: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  participantCount: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  participantsList: {
    marginLeft: 12,
    marginTop: 8,
  },
  participantName: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 16,
  },
  userCount: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitials: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
});
