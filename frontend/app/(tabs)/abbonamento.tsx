import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { apiService, Subscription } from '../../src/services/api';
import { COLORS, ABBONAMENTO_INFO, formatDate } from '../../src/utils/constants';

export default function AbbonamentoScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const loadData = async () => {
    try {
      const response = await apiService.getMySubscriptions();
      setSubscriptions(response.data);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
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

  const activeSubscriptions = subscriptions.filter((s) => s.attivo && !s.scaduto);
  const expiredSubscriptions = subscriptions.filter((s) => s.scaduto);

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
        <Text style={styles.title}>Il Mio Abbonamento</Text>

        {/* Active Subscriptions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Abbonamenti Attivi</Text>
          {activeSubscriptions.length > 0 ? (
            activeSubscriptions.map((sub) => {
              const info = ABBONAMENTO_INFO[sub.tipo] || { nome: sub.tipo, prezzo: '' };
              const isLezioniType = sub.tipo === 'lezioni_8' || sub.tipo === 'lezioni_16';
              const isTempoType = sub.tipo === 'mensile' || sub.tipo === 'trimestrale';
              
              return (
                <View key={sub.id} style={styles.subscriptionCard}>
                  {/* Header con stato */}
                  <View style={styles.subscriptionHeader}>
                    <View style={styles.subscriptionBadge}>
                      <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                      <Text style={styles.subscriptionStatus}>ATTIVO</Text>
                    </View>
                    <View style={styles.tipoBadge}>
                      <Ionicons 
                        name={isLezioniType ? "fitness" : "calendar"} 
                        size={16} 
                        color={COLORS.text} 
                      />
                      <Text style={styles.tipoText}>
                        {isLezioniType ? 'A Lezioni' : 'A Tempo'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Nome abbonamento */}
                  <Text style={styles.subscriptionType}>{info.nome}</Text>
                  
                  {/* Dettagli specifici per tipo */}
                  <View style={styles.subscriptionDetails}>
                    {isLezioniType && (
                      <>
                        <View style={styles.lezioniBox}>
                          <Text style={styles.lezioniNumber}>{sub.lezioni_rimanenti}</Text>
                          <Text style={styles.lezioniLabel}>Lezioni Rimanenti</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                          <Text style={styles.infoText}>
                            Validità annuale - scade anche se non consumato
                          </Text>
                        </View>
                      </>
                    )}
                    
                    {isTempoType && (
                      <View style={styles.tempoBox}>
                        <Ionicons name="infinite" size={32} color={COLORS.primary} />
                        <Text style={styles.tempoText}>Lezioni Illimitate</Text>
                      </View>
                    )}
                    
                    {/* Date */}
                    <View style={styles.dateContainer}>
                      <View style={styles.dateRow}>
                        <View style={styles.dateItem}>
                          <Text style={styles.dateLabel}>Data Inizio</Text>
                          <Text style={styles.dateValue}>{formatDate(sub.data_inizio)}</Text>
                        </View>
                        <View style={styles.dateItem}>
                          <Text style={styles.dateLabel}>Data Scadenza</Text>
                          <Text style={[styles.dateValue, styles.scadenzaValue]}>
                            {formatDate(sub.data_scadenza)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="card-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>Nessun abbonamento attivo</Text>
              <Text style={styles.emptySubtext}>
                Contatta Daniele per acquistare un abbonamento
              </Text>
              <Text style={styles.emptyPhone}>📞 339 50 20 625</Text>
            </View>
          )}
        </View>

        {/* Expired Subscriptions */}
        {expiredSubscriptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Abbonamenti Scaduti</Text>
            {expiredSubscriptions.map((sub) => {
              const info = ABBONAMENTO_INFO[sub.tipo] || { nome: sub.tipo, prezzo: '' };
              const isLezioniType = sub.tipo === 'lezioni_8' || sub.tipo === 'lezioni_16';
              
              return (
                <View key={sub.id} style={[styles.subscriptionCard, styles.expiredCard]}>
                  <View style={styles.subscriptionHeader}>
                    <View style={[styles.subscriptionBadge, styles.expiredBadge]}>
                      <Ionicons name="close-circle" size={24} color={COLORS.error} />
                      <Text style={[styles.subscriptionStatus, styles.expiredStatus]}>SCADUTO</Text>
                    </View>
                  </View>
                  <Text style={styles.subscriptionType}>{info.nome}</Text>
                  
                  <View style={styles.subscriptionDetails}>
                    {isLezioniType && sub.lezioni_rimanenti !== null && sub.lezioni_rimanenti > 0 && (
                      <View style={styles.lezioniPerse}>
                        <Ionicons name="warning" size={18} color={COLORS.warning} />
                        <Text style={styles.lezioniPerseText}>
                          {sub.lezioni_rimanenti} lezioni non utilizzate (perse)
                        </Text>
                      </View>
                    )}
                    <View style={styles.dateRow}>
                      <View style={styles.dateItem}>
                        <Text style={styles.dateLabel}>Scaduto il</Text>
                        <Text style={[styles.dateValue, styles.expiredDateValue]}>
                          {formatDate(sub.data_scadenza)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Pricing Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pacchetti Disponibili</Text>
          <View style={styles.pricingGrid}>
            <View style={styles.pricingCard}>
              <Text style={styles.pricingName}>8 Lezioni</Text>
              <Text style={styles.pricingPrice}>55 €</Text>
              <Text style={styles.pricingNote}>Validità annuale</Text>
            </View>
            <View style={styles.pricingCard}>
              <Text style={styles.pricingName}>16 Lezioni</Text>
              <Text style={styles.pricingPrice}>95 €</Text>
              <Text style={styles.pricingNote}>Validità annuale</Text>
            </View>
            <View style={styles.pricingCard}>
              <Text style={styles.pricingName}>Mensile</Text>
              <Text style={styles.pricingPrice}>65 €</Text>
              <Text style={styles.pricingNote}>30 giorni</Text>
            </View>
            <View style={styles.pricingCard}>
              <Text style={styles.pricingName}>Trimestrale</Text>
              <Text style={styles.pricingPrice}>175 €</Text>
              <Text style={styles.pricingNote}>90 giorni</Text>
            </View>
          </View>
          <View style={styles.registrationFee}>
            <Ionicons name="information-circle" size={20} color={COLORS.primary} />
            <Text style={styles.registrationFeeText}>
              Quota iscrizione stagionale: 30 €
            </Text>
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.contactCard}>
          <Ionicons name="call" size={24} color={COLORS.primary} />
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Per acquistare o rinnovare</Text>
            <Text style={styles.contactText}>Daniele - 339 50 20 625</Text>
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
    padding: 12,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  subscriptionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  expiredCard: {
    borderColor: COLORS.error,
    opacity: 0.8,
  },
  subscriptionHeader: {
    marginBottom: 8,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expiredBadge: {},
  subscriptionStatus: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.success,
  },
  expiredStatus: {
    color: COLORS.error,
  },
  subscriptionType: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  subscriptionPrice: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 10,
  },
  subscriptionDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  detailHighlight: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 10,
  },
  expiredText: {
    color: COLORS.error,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  pricingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pricingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    width: '48%',
    alignItems: 'center',
  },
  pricingName: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  pricingPrice: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
  pricingNote: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  registrationFee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  registrationFeeText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  contactCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  contactText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
});
