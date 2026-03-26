import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { apiService, Subscription } from '../../src/services/api';
import { COLORS, formatDate } from '../../src/utils/constants';
import { useAuth } from '../../src/context/AuthContext';

interface LogEntry {
  numero: number;
  giorno: string;
  data: string;
  orario: string;
  tipo_attivita: string;
  coach: string;
}

// Mappa nomi pacchetti
const PACCHETTO_NOME: { [key: string]: string } = {
  'lezioni_8': '8 Lezioni',
  'lezioni_16': '16 Lezioni',
  'mensile': 'Mensile',
  'trimestrale': 'Trimestrale',
};

export default function AbbonamentoScreen() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [logIngressi, setLogIngressi] = useState<LogEntry[]>([]);
  const [lessonsCount, setLessonsCount] = useState<number>(0);
  const [showLog, setShowLog] = useState(false);

  const loadData = async (showLoading = true) => {
    try {
      // Don't show loading if we already have data
      if (showLoading && subscriptions.length === 0) {
        setLoading(true);
      }
      const response = await apiService.getMySubscriptions();
      setSubscriptions(response.data);
      
      // Cerca prima un abbonamento attivo
      const activeSub = response.data.find(s => s.attivo && !s.scaduto);
      
      // Se non c'è abbonamento attivo, prendi l'ultimo scaduto (più recente)
      let subForLog = activeSub;
      if (!subForLog) {
        // Ordina per data_scadenza decrescente e prendi il primo (più recente)
        const sortedExpired = response.data
          .filter(s => s.scaduto || !s.attivo)
          .sort((a, b) => {
            const dateA = new Date(a.data_scadenza || '1970-01-01');
            const dateB = new Date(b.data_scadenza || '1970-01-01');
            return dateB.getTime() - dateA.getTime();
          });
        subForLog = sortedExpired[0];
      }
      
      // Carica il log dall'abbonamento (attivo o ultimo scaduto)
      if (subForLog) {
        try {
          const logRes = await apiService.getSubscriptionLogIngressi(subForLog.id);
          setLogIngressi(logRes.data.log_ingressi);
          setLessonsCount(logRes.data.totale);
        } catch (e) {
          console.log('Log not available');
          setLogIngressi([]);
          setLessonsCount(0);
        }
      } else {
        setLogIngressi([]);
        setLessonsCount(0);
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
      // Don't show loading if we already have data
      loadData(false);
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activeSubscription = subscriptions.find((s) => s.attivo && !s.scaduto);
  const expiredSubscriptions = subscriptions.filter((s) => s.scaduto || !s.attivo);
  const isLezioniType = activeSubscription?.tipo?.includes('lezioni');

  // ===== CALCOLO WARNING SCADENZA =====
  const getSubscriptionWarningStatus = () => {
    if (!activeSubscription) return { isWarning: false, isExpired: true };
    
    const isLezioni = activeSubscription.tipo?.includes('lezioni');
    
    if (isLezioni) {
      // Abbonamento a LEZIONI: warning se 2 o meno lezioni rimanenti
      const lezioniRimanenti = activeSubscription.lezioni_rimanenti ?? 0;
      if (lezioniRimanenti <= 0) {
        return { isWarning: false, isExpired: true };
      }
      if (lezioniRimanenti <= 2) {
        return { isWarning: true, isExpired: false, message: `Solo ${lezioniRimanenti} ${lezioniRimanenti === 1 ? 'lezione' : 'lezioni'} rimaste!` };
      }
    } else {
      // Abbonamento a TEMPO: warning se 3 giorni o meno alla scadenza
      if (activeSubscription.data_scadenza) {
        const scadenza = new Date(activeSubscription.data_scadenza);
        const oggi = new Date();
        const diffTime = scadenza.getTime() - oggi.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) {
          return { isWarning: false, isExpired: true };
        }
        if (diffDays <= 3) {
          return { isWarning: true, isExpired: false, message: `Scade tra ${diffDays} ${diffDays === 1 ? 'giorno' : 'giorni'}!` };
        }
      }
    }
    
    return { isWarning: false, isExpired: false };
  };

  const warningStatus = getSubscriptionWarningStatus();

  const formatLogDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const giorni = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    return `${giorni[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Il Mio Abbonamento</Text>

        {/* PROVA GRATUITA ATTIVA */}
        {user?.prova_attiva && user?.prova_scadenza && (
          <View style={styles.trialCard} data-testid="trial-card">
            <View style={styles.trialHeader}>
              <Ionicons name="gift" size={24} color="#4CAF50" />
              <Text style={styles.trialTitle}>ABBONAMENTO DI PROVA</Text>
            </View>
            <View style={styles.trialDatesRow}>
              <View style={styles.trialDateBox}>
                <Text style={styles.trialDateLabel}>Inizio</Text>
                <Text style={styles.trialDateValue}>
                  {user.prova_inizio ? formatDate(user.prova_inizio) : 'Oggi'}
                </Text>
              </View>
              <View style={styles.trialDateDivider} />
              <View style={styles.trialDateBox}>
                <Text style={styles.trialDateLabel}>Scadenza</Text>
                <Text style={[styles.trialDateValue, { color: COLORS.error }]}>
                  {formatDate(user.prova_scadenza)}
                </Text>
              </View>
            </View>
            <View style={styles.trialInfoBox}>
              <Ionicons name="information-circle" size={18} color="#4CAF50" />
              <Text style={styles.trialInfoText}>
                Stai usando un periodo di prova gratuita. Al termine, per continuare ad usufruire di tutti i servizi dovrai sottoscrivere un abbonamento. Contatta Daniele!
              </Text>
            </View>
          </View>
        )}

        {/* STATO ABBONAMENTO */}
        <View style={styles.statusSection}>
          {activeSubscription ? (
            <>
              {/* Badge Stato */}
              <View style={[styles.statusBadge, !activeSubscription.pagato && { backgroundColor: '#f59e0b20', borderColor: '#f59e0b50' }]}>
                <Ionicons name={activeSubscription.pagato ? "checkmark-circle" : "alert-circle"} size={22} color={activeSubscription.pagato ? COLORS.success : '#f59e0b'} />
                <Text style={[styles.statusText, !activeSubscription.pagato && { color: '#f59e0b' }]}>
                  {activeSubscription.pagato ? 'Abbonamento Attivo' : 'Abbonamento da Saldare'}
                </Text>
              </View>

              {/* Avviso pagamento mancante */}
              {!activeSubscription.pagato && (
                <View style={{ backgroundColor: '#f59e0b15', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f59e0b40' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Ionicons name="wallet-outline" size={18} color="#f59e0b" />
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#f59e0b' }}>Abbonamento da saldare</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 }}>
                    Ciao! Il tuo abbonamento non risulta ancora saldato. Puoi regolarizzarlo quando ci vediamo in palestra!
                  </Text>
                </View>
              )}

              {/* Nome Pacchetto */}
              <View style={styles.packageNameCard}>
                <Text style={styles.packageNameText}>
                  {PACCHETTO_NOME[activeSubscription.tipo] || activeSubscription.tipo}
                </Text>
              </View>

              {/* Date */}
              <View style={styles.datesRow}>
                <View style={styles.dateBox}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.dateLabel} numberOfLines={1} adjustsFontSizeToFit>Inizio</Text>
                  <Text style={styles.dateValue} numberOfLines={1} adjustsFontSizeToFit>
                    {activeSubscription.data_inizio ? formatDate(activeSubscription.data_inizio) : 'N/D'}
                  </Text>
                </View>
                <View style={styles.dateDivider} />
                <View style={styles.dateBox}>
                  <Ionicons name="time-outline" size={14} color={COLORS.error} />
                  <Text style={styles.dateLabel} numberOfLines={1} adjustsFontSizeToFit>Fine</Text>
                  <Text style={styles.dateValue} numberOfLines={1} adjustsFontSizeToFit>
                    {activeSubscription.data_scadenza ? formatDate(activeSubscription.data_scadenza) : 'N/D'}
                  </Text>
                </View>
              </View>

              {/* Conteggio Lezioni - CON WARNING SCADENZA */}
              <View style={[
                styles.lessonsCard, 
                isLezioniType && styles.lessonsCardHighlight,
                warningStatus.isWarning && styles.lessonsCardWarning
              ]}>
                {/* Banner Warning se in scadenza */}
                {warningStatus.isWarning && (
                  <View style={styles.warningBanner}>
                    <Ionicons name="warning" size={18} color="#FFF" />
                    <Text style={styles.warningBannerText}>{warningStatus.message}</Text>
                  </View>
                )}
                
                {isLezioniType ? (
                  <>
                    <View style={[
                      styles.lessonsIconContainer,
                      warningStatus.isWarning && styles.lessonsIconWarning
                    ]}>
                      <Ionicons 
                        name={warningStatus.isWarning ? "alert-circle" : "fitness"} 
                        size={28} 
                        color={warningStatus.isWarning ? "#dc2626" : COLORS.primary} 
                      />
                    </View>
                    <Text style={styles.lessonsLabelBig}>LEZIONI RIMASTE</Text>
                    <Text style={[
                      styles.lessonsCountBig,
                      warningStatus.isWarning && styles.lessonsCountWarning
                    ]}>
                      {activeSubscription.lezioni_rimanenti ?? 0}
                    </Text>
                    <Text style={styles.lessonsSubtext}>su {activeSubscription.tipo === 'lezioni_8' ? '8' : '16'} totali</Text>
                  </>
                ) : (
                  <>
                    <View style={[
                      styles.lessonsIconContainer,
                      warningStatus.isWarning && styles.lessonsIconWarning
                    ]}>
                      <Ionicons 
                        name={warningStatus.isWarning ? "alert-circle" : "calendar-outline"} 
                        size={28} 
                        color={warningStatus.isWarning ? "#dc2626" : COLORS.success} 
                      />
                    </View>
                    <Text style={styles.lessonsLabelBig}>
                      {warningStatus.isWarning ? 'ABBONAMENTO IN SCADENZA' : 'LEZIONI EFFETTUATE'}
                    </Text>
                    <Text style={[
                      styles.lessonsCountBig, 
                      {color: warningStatus.isWarning ? "#dc2626" : COLORS.success}
                    ]}>
                      {lessonsCount}
                    </Text>
                    <Text style={styles.lessonsSubtext}>nel periodo abbonamento</Text>
                  </>
                )}

                {/* Messaggio urgente se in warning */}
                {warningStatus.isWarning && (
                  <View style={styles.renewMessage}>
                    <Ionicons name="call" size={16} color="#dc2626" />
                    <Text style={styles.renewMessageText}>
                      Contatta Daniele per rinnovare!
                    </Text>
                  </View>
                )}
              </View>

              {/* Log Ingressi */}
              <TouchableOpacity 
                style={styles.logToggle} 
                onPress={() => setShowLog(!showLog)}
                activeOpacity={0.7}
              >
                <Ionicons name="list" size={18} color={COLORS.primary} />
                <Text style={styles.logToggleText}>Log Ingressi</Text>
                <Ionicons name={showLog ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>

              {showLog && (
                <View style={styles.logContainer}>
                  {logIngressi.length > 0 ? (
                    logIngressi.map((entry, idx) => (
                      <View key={idx} style={[styles.logEntry, !activeSubscription.pagato && { borderLeftColor: '#f59e0b' }]}>
                        <View style={[styles.logNumber, !activeSubscription.pagato && { backgroundColor: '#f59e0b' }]}>
                          <Text style={styles.logNumberText}>{entry.numero}</Text>
                        </View>
                        <View style={styles.logDate}>
                          <Text style={styles.logDayText}>{entry.giorno}</Text>
                          <Text style={styles.logDateText}>{formatLogDate(entry.data)}</Text>
                        </View>
                        <View style={styles.logDetails}>
                          <Text style={styles.logTime}>{entry.orario}</Text>
                          <Text style={styles.logActivity}>{entry.tipo_attivita}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.logEmpty}>Nessun ingresso registrato</Text>
                  )}
                </View>
              )}
            </>
          ) : (
            /* ===== MESSAGGIO ABBONAMENTO SCADUTO - DAL MAESTRO (SIMPATICO) ===== */
            <View style={styles.expiredMainCard}>
              {/* Header con icona */}
              <View style={styles.expiredMainHeader}>
                <Text style={styles.maestroEmoji}>😱</Text>
                <Text style={styles.expiredMainTitle}>Ma dove sei finito?!</Text>
              </View>

              {/* Messaggio dal Maestro */}
              <View style={styles.thankYouBox}>
                <Text style={styles.thankYouTitle}>Ohhh ma sei ancora vivo? 😂</Text>
                <Text style={styles.thankYouText}>
                  Sono io, il Maestro! Sì, proprio quello che ti ha sopportato tutto questo tempo! 
                  Volevo solo dirti che mi manchi... e che la palestra senza di te è troppo silenziosa. 
                  Chi prendo in giro adesso?! 🤣
                </Text>
              </View>

              {/* Invito personale */}
              <View style={styles.renewInviteBox}>
                <Text style={styles.renewInviteEmoji}>🦄</Text>
                <Text style={styles.renewInviteTitle}>Lo sai che sei speciale, vero?</Text>
                <Text style={styles.renewInviteText}>
                  Dai, siamo sinceri: qui dentro siamo TUTTI un po' matti! 🤪{'\n\n'}
                  Fuori di qui ti guarderebbero strano... ma noi? Noi ti capiamo! 
                  Siamo quella banda di disagiati che suda insieme e si prende in giro.{'\n\n'}
                  La tua sedia è ancora calda (più o meno)... e il gruppo ti aspetta! 
                  Non farci venire a prenderti eh! 😏
                </Text>
              </View>

              {/* Contatto diretto */}
              <View style={styles.expiredContactCard}>
                <Ionicons name="call" size={22} color="#FFF" />
                <View style={styles.expiredContactInfo}>
                  <Text style={styles.expiredContactLabel}>Chiama il Maestro 📞</Text>
                  <Text style={styles.expiredContactNumber}>339 50 20 625</Text>
                </View>
              </View>

              {/* Firma */}
              <Text style={styles.maestroSignature}>
                Torna presto, scansafatiche! 💪😎{'\n'}Il tuo Maestro
              </Text>
            </View>
          )}
        </View>

        {/* STORICO */}
        {expiredSubscriptions.length > 0 && (
          <View style={styles.expiredSection}>
            <Text style={styles.expiredTitle}>Storico</Text>
            {expiredSubscriptions.map((sub) => (
              <View key={sub.id} style={styles.expiredCard}>
                <Text style={styles.expiredType}>
                  {PACCHETTO_NOME[sub.tipo] || sub.tipo}
                </Text>
                <Text style={styles.expiredDates}>
                  {formatDate(sub.data_inizio)} - {formatDate(sub.data_scadenza)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* PACCHETTI DISPONIBILI */}
        <View style={styles.packagesSection}>
          <Text style={styles.packagesTitle}>Pacchetti Disponibili</Text>
          
          <View style={styles.packagesRow}>
            <View style={styles.packageBox}>
              <Text style={styles.packageBoxName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>8 Lezioni</Text>
              <Text style={styles.packageBoxPrice}>55 €</Text>
            </View>
            <View style={styles.packageBox}>
              <Text style={styles.packageBoxName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>16 Lezioni</Text>
              <Text style={styles.packageBoxPrice}>95 €</Text>
            </View>
          </View>
          
          <View style={styles.packagesRow}>
            <View style={styles.packageBox}>
              <Text style={styles.packageBoxName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>Mensile</Text>
              <Text style={styles.packageBoxPrice}>65 €</Text>
            </View>
            <View style={styles.packageBox}>
              <Text style={styles.packageBoxName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>Trimestrale</Text>
              <Text style={styles.packageBoxPrice}>175 €</Text>
            </View>
          </View>
          
          <View style={styles.registrationNote}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.registrationText}>Iscrizione stagionale: 30 €</Text>
          </View>
        </View>

        {/* CONTATTO */}
        <View style={styles.contactCard}>
          <Ionicons name="call" size={20} color={COLORS.primary} />
          <View style={styles.contactInfo}>
            <Text style={styles.contactLabel}>Per acquisti e rinnovi</Text>
            <Text style={styles.contactNumber}>Daniele - 339 50 20 625</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 14, paddingBottom: 30 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },

  // Trial Card
  trialCard: {
    backgroundColor: '#4CAF5010',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4CAF5040',
  },
  trialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  trialTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    letterSpacing: 1,
  },
  trialDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  trialDateBox: {
    flex: 1,
    alignItems: 'center',
  },
  trialDateDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#4CAF5030',
  },
  trialDateLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  trialDateValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  trialInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#4CAF5010',
    borderRadius: 10,
    padding: 12,
  },
  trialInfoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // Status Section
  statusSection: { marginBottom: 20 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 150, 136, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  statusText: { fontSize: 14, fontWeight: 'bold', color: COLORS.success },

  // Package Name
  packageNameCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  packageNameText: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },

  // Dates
  datesRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  dateBox: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    minWidth: 80,
  },
  dateDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 8 },
  dateLabel: { 
    fontSize: 11, 
    color: COLORS.textSecondary, 
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  dateValue: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: COLORS.text, 
    textAlign: 'center',
  },

  // Lessons Card
  lessonsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  lessonsCardHighlight: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  // ===== STILI WARNING SCADENZA =====
  lessonsCardWarning: {
    borderColor: '#dc2626',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 3,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
    gap: 8,
  },
  warningBannerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  lessonsIconWarning: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
  },
  lessonsCountWarning: {
    color: '#dc2626',
  },
  renewMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  renewMessageText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  lessonsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  lessonsLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  lessonsLabelBig: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: COLORS.textSecondary, 
    letterSpacing: 1,
    marginBottom: 8,
  },
  lessonsCount: { fontSize: 40, fontWeight: 'bold', color: COLORS.primary },
  lessonsCountBig: { 
    fontSize: 56, 
    fontWeight: 'bold', 
    color: COLORS.primary,
    lineHeight: 60,
  },
  lessonsSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Log Toggle
  logToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  logToggleText: { flex: 1, marginLeft: 8, fontSize: 13, fontWeight: '500', color: COLORS.text },

  // Log Container
  logContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  logNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logNumberText: { fontSize: 12, fontWeight: 'bold', color: '#FFF' },
  logDate: {
    width: 80,
    marginRight: 10,
  },
  logDayText: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  logDateText: { fontSize: 10, color: COLORS.textSecondary },
  logDetails: { flex: 1, alignItems: 'flex-end' },
  logTime: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  logActivity: { fontSize: 10, color: COLORS.textSecondary },
  logEmpty: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 12 },

  // Log Toggle per abbonamento scaduto
  logToggleExpired: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 6,
    width: '100%',
  },
  logContainerExpired: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  logExpiredInfo: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  // No Subscription
  noSubCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  noSubTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.error, marginTop: 10 },
  noSubText: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 },

  // ===== MESSAGGIO ABBONAMENTO SCADUTO DAL MAESTRO =====
  expiredMainCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  expiredMainHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  maestroEmoji: {
    fontSize: 50,
  },
  expiredMainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 8,
  },
  thankYouBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  thankYouTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22c55e',
    textAlign: 'center',
    marginBottom: 8,
  },
  thankYouText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  renewInviteBox: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  renewInviteEmoji: {
    fontSize: 40,
  },
  renewInviteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 8,
    marginBottom: 6,
  },
  renewInviteText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  expiredContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
    width: '100%',
  },
  expiredContactInfo: {
    flex: 1,
  },
  expiredContactLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  expiredContactNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  maestroSignature: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Expired Section
  expiredSection: { marginBottom: 16 },
  expiredTitle: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  expiredCard: {
    backgroundColor: COLORS.card,
    borderRadius: 6,
    padding: 10,
    marginBottom: 4,
    opacity: 0.7,
  },
  expiredType: { fontSize: 12, fontWeight: '500', color: COLORS.text },
  expiredDates: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },

  // Packages Section
  packagesSection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  packagesTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 12, textAlign: 'center' },
  packagesRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  packageBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  packageBoxName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  packageBoxPrice: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginTop: 4 },
  packageBoxNote: { fontSize: 9, color: COLORS.textSecondary, marginTop: 2 },
  registrationNote: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  registrationText: { fontSize: 11, color: COLORS.textSecondary },

  // Contact
  contactCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 10, color: COLORS.textSecondary },
  contactNumber: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 1 },
});
