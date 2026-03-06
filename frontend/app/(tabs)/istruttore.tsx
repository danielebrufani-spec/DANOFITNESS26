import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';
import { COLORS, ATTIVITA_INFO } from '../../src/utils/constants';

interface Partecipante {
  nome: string;
  soprannome: string;
  lezione_scalata: boolean;
}

interface Lezione {
  id: string;
  orario: string;
  tipo_attivita: string;
  coach: string;
  partecipanti: Partecipante[];
  totale_iscritti: number;
}

interface Giorno {
  data: string;
  giorno: string;
  lezioni: Lezione[];
}

interface LezioniData {
  settimana: string;
  giorni: Giorno[];
}

export default function IstruttoreScreen() {
  const { user, isIstruttore, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<LezioniData | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const response = await apiService.getIstruttoreLezioni();
      setData(response.data);
      
      // Espandi il giorno corrente di default
      const today = new Date().toISOString().split('T')[0];
      setExpandedDays(new Set([today]));
    } catch (error) {
      console.error('Errore caricamento lezioni:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const toggleDay = (data: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(data)) {
        newSet.delete(data);
      } else {
        newSet.add(data);
      }
      return newSet;
    });
  };

  // Verifica accesso
  if (!isIstruttore && !isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={48} color={COLORS.error} />
          <Text style={styles.accessDeniedTitle}>Accesso Riservato</Text>
          <Text style={styles.accessDeniedText}>
            Questa sezione è riservata agli istruttori.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Lezioni della Settimana</Text>
          <Text style={styles.subtitle}>{data?.settimana}</Text>
        </View>

        {data?.giorni.map((giorno) => {
          const isExpanded = expandedDays.has(giorno.data);
          const totaleIscritti = giorno.lezioni.reduce((sum, l) => sum + l.totale_iscritti, 0);
          const today = new Date().toISOString().split('T')[0];
          const isToday = giorno.data === today;

          return (
            <View key={giorno.data} style={[styles.dayCard, isToday && styles.dayCardToday]}>
              <TouchableOpacity
                style={styles.dayHeader}
                onPress={() => toggleDay(giorno.data)}
              >
                <View style={styles.dayInfo}>
                  <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                    {giorno.giorno}
                  </Text>
                  <Text style={styles.dayDate}>{giorno.data}</Text>
                </View>
                <View style={styles.dayStats}>
                  <View style={styles.badge}>
                    <Ionicons name="people" size={14} color={COLORS.primary} />
                    <Text style={styles.badgeText}>{totaleIscritti}</Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.lessonsContainer}>
                  {giorno.lezioni.length > 0 ? (
                    giorno.lezioni.map((lezione) => {
                      const info = ATTIVITA_INFO[lezione.tipo_attivita] || {};
                      return (
                        <View key={lezione.id} style={styles.lessonCard}>
                          <View style={styles.lessonHeader}>
                            <View style={[styles.lessonColor, { backgroundColor: info.colore || COLORS.primary }]} />
                            <View style={styles.lessonInfo}>
                              <Text style={styles.lessonTime}>{lezione.orario}</Text>
                              <Text style={styles.lessonType}>{info.nome || lezione.tipo_attivita}</Text>
                            </View>
                            <View style={styles.participantsBadge}>
                              <Ionicons name="people" size={16} color={COLORS.primary} />
                              <Text style={styles.participantsCount}>{lezione.totale_iscritti}</Text>
                            </View>
                          </View>

                          {lezione.partecipanti.length > 0 ? (
                            <View style={styles.participantsList}>
                              {lezione.partecipanti.map((p, idx) => (
                                <View key={idx} style={styles.participantRow}>
                                  <Text style={styles.participantNumber}>{idx + 1}.</Text>
                                  <Text style={[
                                    styles.participantName,
                                    p.lezione_scalata && styles.participantConfirmed
                                  ]}>
                                    {p.soprannome || p.nome}
                                  </Text>
                                  {p.lezione_scalata && (
                                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
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
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  dayCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dayCardToday: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dayStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  lessonsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  lessonCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  lessonHeader: {
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
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  participantsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  participantsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  participantsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  participantNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    width: 20,
  },
  participantName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  participantConfirmed: {
    color: COLORS.success,
    fontWeight: '600',
  },
  noParticipants: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  noLessons: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
