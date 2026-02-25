import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { apiService, Subscription, StoricoLezioni } from '../../src/services/api';
import { COLORS, ABBONAMENTO_INFO, formatDate } from '../../src/utils/constants';

export default function AbbonamentoScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [storico, setStorico] = useState<StoricoLezioni | null>(null);
  const [showStorico, setShowStorico] = useState(false);

  const loadData = async () => {
    try {
      const [subsRes, storicoRes] = await Promise.all([
        apiService.getMySubscriptions(),
        apiService.getMyStoricoLezioni().catch(() => null)
      ]);
      setSubscriptions(subsRes.data);
      if (storicoRes) {
        setStorico(storicoRes.data);
      }
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

        {/* Alert Abbonamento Scaduto */}
        {activeSubscriptions.length === 0 && (
          <View style={styles.expiredAlert}>
            <Ionicons name="warning" size={28} color="#fff" />
            <View style={styles.expiredAlertContent}>
              <Text style={styles.expiredAlertTitle}>Abbonamento Scaduto!</Text>
              <Text style={styles.expiredAlertText}>
                Per continuare a prenotare le lezioni, contatta Daniele per rinnovare il tuo abbonamento.
              </Text>
              <TouchableOpacity 
                style={styles.expiredAlertButton}
                onPress={() => Linking.openURL('tel:+393395020625')}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.expiredAlertButtonText}>Chiama 339 50 20 625</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
                    
                    {/* Log Ingressi / Storico */}
                    {storico && (
                      <View style={styles.storicoSection}>
                        <TouchableOpacity 
                          style={styles.storicoHeader}
                          onPress={() => setShowStorico(!showStorico)}
                        >
                          <View style={styles.storicoHeaderLeft}>
                            <Ionicons name="list" size={20} color={COLORS.primary} />
                            <Text style={styles.storicoTitle}>
                              {isLezioniType ? 'Log Ingressi' : 'Presenze Effettuate'}
                            </Text>
                          </View>
                          <View style={styles.storicoHeaderRight}>
                            <View style={styles.storicoBadge}>
                              <Text style={styles.storicoBadgeText}>{storico.totale_presenze}</Text>
                            </View>
                            <Ionicons 
                              name={showStorico ? 'chevron-up' : 'chevron-down'} 
                              size={20} 
                              color={COLORS.textSecondary} 
                            />
                          </View>
                        </TouchableOpacity>
                        
                        {showStorico && (
                          <View style={styles.storicoContent}>
                            {isLezioniType && (
                              <View style={styles.storicoSummary}>
                                <View style={styles.storicoSummaryItem}>
                                  <Text style={styles.storicoSummaryNumber}>{storico.lezioni_totali}</Text>
                                  <Text style={styles.storicoSummaryLabel}>Pacchetto</Text>
                                </View>
                                <View style={styles.storicoSummaryDivider} />
                                <View style={styles.storicoSummaryItem}>
                                  <Text style={styles.storicoSummaryNumber}>{storico.totale_presenze}</Text>
                                  <Text style={styles.storicoSummaryLabel}>Effettuate</Text>
                                </View>
                                <View style={styles.storicoSummaryDivider} />
                                <View style={styles.storicoSummaryItem}>
                                  <Text style={[styles.storicoSummaryNumber, { color: COLORS.success }]}>
                                    {storico.lezioni_residue}
                                  </Text>
                                  <Text style={styles.storicoSummaryLabel}>Residue</Text>
                                </View>
                              </View>
                            )}
                            
                            {isTempoType && (
                              <View style={styles.storicoTempoInfo}>
                                <Text style={styles.storicoTempoText}>
                                  Hai frequentato {storico.totale_presenze} lezioni durante questo abbonamento
                                </Text>
                              </View>
                            )}
                            
                            {/* Lista lezioni effettuate - solo per abbonamenti a lezioni */}
                            {isLezioniType && storico.lezioni_effettuate.length > 0 && (
                              <View style={styles.storicoList}>
                                <Text style={styles.storicoListTitle}>Dettaglio Lezioni</Text>
                                {storico.lezioni_effettuate.map((lezione, idx) => (
                                  <View key={idx} style={styles.storicoItem}>
                                    <View style={styles.storicoItemLeft}>
                                      <Text style={styles.storicoItemData}>
                                        {formatDate(lezione.data)}
                                      </Text>
                                      <Text style={styles.storicoItemGiorno}>
                                        {lezione.giorno}
                                      </Text>
                                    </View>
                                    <View style={styles.storicoItemRight}>
                                      <Text style={styles.storicoItemOrario}>{lezione.orario}</Text>
                                      <Text style={styles.storicoItemAttivita}>{lezione.tipo_attivita}</Text>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            )}
                            
                            {storico.lezioni_effettuate.length === 0 && (
                              <Text style={styles.storicoEmpty}>
                                Nessuna lezione effettuata ancora
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    )}
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
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 20,
  },
  // Alert Abbonamento Scaduto
  expiredAlert: {
    backgroundColor: COLORS.error,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  expiredAlertContent: {
    flex: 1,
  },
  expiredAlertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  expiredAlertText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    marginBottom: 16,
  },
  expiredAlertButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  expiredAlertButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subscriptionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  expiredCard: {
    borderColor: COLORS.error,
    opacity: 0.7,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expiredBadge: {},
  subscriptionStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  expiredStatus: {
    color: COLORS.error,
  },
  tipoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tipoText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  subscriptionType: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  subscriptionDetails: {
    gap: 12,
  },
  lezioniBox: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  lezioniNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  lezioniLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: 4,
  },
  tempoBox: {
    backgroundColor: COLORS.success + '20',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  tempoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.warning + '15',
    padding: 10,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 11,
    color: COLORS.warning,
    flex: 1,
  },
  dateContainer: {
    marginTop: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateItem: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 10,
  },
  dateLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  scadenzaValue: {
    color: COLORS.warning,
  },
  expiredDateValue: {
    color: COLORS.error,
  },
  lezioniPerse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.warning + '20',
    padding: 12,
    borderRadius: 8,
  },
  lezioniPerseText: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyPhone: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 8,
  },
  pricingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pricingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
  },
  pricingName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  pricingPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
  pricingNote: {
    fontSize: 11,
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
    fontSize: 12,
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
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  contactText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
});
