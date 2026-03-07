import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/utils/constants';
import { apiService } from '../../src/services/api';

// Livelli per riferimento nel frontend
const LIVELLI_NOMI = [
  { livello: 0, nome: "Divano Vivente", icona: "🛋️" },
  { livello: 1, nome: "Schiappa in Ripresa", icona: "🐌" },
  { livello: 2, nome: "Scaldapanca", icona: "💦" },
  { livello: 3, nome: "Guerriero", icona: "⚔️" },
  { livello: 4, nome: "Bestia", icona: "🦁" },
  { livello: 5, nome: "Leggenda", icona: "🔥" },
  { livello: 6, nome: "Dio della Palestra", icona: "👑" },
];

export default function ProfiloScreen() {
  const { user, logout, isAdmin, isIstruttore, refreshUser } = useAuth();
  const router = useRouter();
  
  // Mostra livello solo per utenti normali (non admin/istruttori)
  const showLivello = !isAdmin && !isIstruttore;

  // Frasi motivazionali
  const frasiMotivazionali = [
    "Oggi spacchi tutto! 💪",
    "Il divano può aspettare, tu no! 🔥",
    "Suda oggi, brilla domani! ✨",
    "Niente scuse, solo risultati! 🎯",
    "Sei più forte di ieri! 💥",
    "La palestra ti chiama... rispondi! 📞",
    "Ogni goccia di sudore conta! 💦",
    "Il tuo corpo ti ringrazierà! 🙏",
    "Oggi è il giorno giusto! 🌟",
    "Fai invidia al te stesso di ieri! 😎",
    "I muscoli non crescono sul divano! 🛋️",
    "Sei una bestia, comportati da bestia! 🦁",
    "La fatica passa, i risultati restano! 🏆",
    "Allenati come se ti guardassero tutti! 👀",
    "Meno lamentele, più squat! 🍑",
  ];
  
  const [fraseMotivazionale] = useState(() => {
    const randomIndex = Math.floor(Math.random() * frasiMotivazionali.length);
    return frasiMotivazionali[randomIndex];
  });

  // Livello state
  const [livelloData, setLivelloData] = useState<{
    livello: number;
    nome: string;
    icona: string;
    descrizione: string;
    allenamenti_settimana_precedente: number;
    settimana_precedente: string;
    prossimo_livello: {livello: number; nome: string; icona: string; descrizione: string} | null;
    tutti_livelli: {livello: number; nome: string; icona: string; descrizione: string}[];
    settimana_corrente: string;
    allenamenti_fatti: number;
    allenamenti_prenotati: number;
    max_allenamenti: number;
  } | null>(null);
  const [showLivelloInfo, setShowLivelloInfo] = useState(false);

  // Medaglie state
  const [medaglieData, setMedaglieData] = useState<{
    totale: number;
    oro: number;
    argento: number;
    bronzo: number;
    medaglie: {
      settimana: string;
      posizione: number;
      medaglia: string;
      allenamenti: number;
      pari_merito: boolean;
    }[];
  } | null>(null);
  const [showMedaglieModal, setShowMedaglieModal] = useState(false);

  useEffect(() => {
    if (showLivello) {
      loadLivello();
      loadMedaglie();
    }
  }, [showLivello]);

  const loadLivello = async () => {
    try {
      const response = await apiService.getUserLivello();
      setLivelloData(response.data);
    } catch (error) {
      console.error('Error loading livello:', error);
    }
  };

  const loadMedaglie = async () => {
    try {
      const response = await apiService.getMyMedals();
      setMedaglieData(response.data);
    } catch (error) {
      console.error('Error loading medaglie:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profilo</Text>

        {/* Livello Settimanale Card - Solo per utenti normali */}
        {showLivello && livelloData && (
          <>
            {/* CARD 1: SETTIMANA IN CORSO - PIÙ IN EVIDENZA */}
            <View style={styles.currentWeekCard}>
              <View style={styles.currentWeekHeader}>
                <Text style={styles.currentWeekBadge}>⚡ IN CORSO</Text>
                <Text style={styles.currentWeekDates}>{livelloData.settimana_corrente}</Text>
              </View>
              
              <View style={styles.currentWeekContent}>
                <View style={styles.currentWeekStats}>
                  <Text style={styles.currentWeekNumber}>{livelloData.allenamenti_fatti}</Text>
                  <Text style={styles.currentWeekLabel}>allenamenti</Text>
                </View>
                
                <View style={styles.currentWeekProgress}>
                  <View style={styles.progressBarLarge}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.progressSegmentLarge,
                          i < livelloData.allenamenti_fatti && styles.progressSegmentLargeFilled,
                          i >= livelloData.allenamenti_fatti && i < (livelloData.allenamenti_fatti + livelloData.allenamenti_prenotati) && styles.progressSegmentLargePrenotato
                        ]}
                      >
                        <Text style={styles.progressSegmentNumber}>{i + 1}</Text>
                      </View>
                    ))}
                  </View>
                  {livelloData.allenamenti_prenotati > 0 && (
                    <Text style={styles.prenotatiText}>+ {livelloData.allenamenti_prenotati} prenotati</Text>
                  )}
                </View>
              </View>
              
              {/* Prossimo livello */}
              {livelloData.allenamenti_fatti < 6 && (
                <View style={styles.nextLevelBox}>
                  <Text style={styles.nextLevelText}>
                    {livelloData.allenamenti_fatti === 5 
                      ? "🔥 Ancora 1 per diventare DIO DELLA PALESTRA! 👑" 
                      : `Prossimo: ${LIVELLI_NOMI[livelloData.allenamenti_fatti + 1]?.icona || '🎯'} ${LIVELLI_NOMI[livelloData.allenamenti_fatti + 1]?.nome || ''}`
                    }
                  </Text>
                </View>
              )}
              {livelloData.allenamenti_fatti >= 6 && (
                <View style={styles.godModeBox}>
                  <Text style={styles.godModeText}>👑 SEI UN DIO! 6 SU 6! 👑</Text>
                </View>
              )}
            </View>

            {/* CARD 2: SETTIMANA PRECEDENTE - LIVELLO RAGGIUNTO */}
            <TouchableOpacity 
              style={styles.prevWeekCard} 
              onPress={() => setShowLivelloInfo(true)}
              activeOpacity={0.8}
            >
              <View style={styles.prevWeekHeader}>
                <Text style={styles.prevWeekTitle}>🏆 Livello Raggiunto</Text>
                <Text style={styles.prevWeekDates}>{livelloData.settimana_precedente}</Text>
              </View>
              <View style={styles.prevWeekContent}>
                <Text style={styles.prevWeekIcona}>{livelloData.icona}</Text>
                <View style={styles.prevWeekInfo}>
                  <Text style={styles.prevWeekNome}>{livelloData.nome}</Text>
                  <Text style={styles.prevWeekDescrizione}>{livelloData.descrizione}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              </View>
            </TouchableOpacity>

            {/* CARD 3: BACHECA MEDAGLIE */}
            {medaglieData && medaglieData.totale > 0 && (
              <TouchableOpacity 
                style={styles.medaglieCard} 
                onPress={() => setShowMedaglieModal(true)}
                activeOpacity={0.8}
              >
                <View style={styles.medaglieHeader}>
                  <Text style={styles.medaglieTitle}>🏅 Bacheca Medaglie</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </View>
                <View style={styles.medaglieContent}>
                  <View style={styles.medaglieRow}>
                    <View style={styles.medagliaItem}>
                      <Text style={styles.medagliaEmoji}>🥇</Text>
                      <Text style={styles.medagliaCount}>{medaglieData.oro}</Text>
                    </View>
                    <View style={styles.medagliaItem}>
                      <Text style={styles.medagliaEmoji}>🥈</Text>
                      <Text style={styles.medagliaCount}>{medaglieData.argento}</Text>
                    </View>
                    <View style={styles.medagliaItem}>
                      <Text style={styles.medagliaEmoji}>🥉</Text>
                      <Text style={styles.medagliaCount}>{medaglieData.bronzo}</Text>
                    </View>
                  </View>
                  <Text style={styles.medaglieTotale}>Totale: {medaglieData.totale} medaglie</Text>
                </View>
              </TouchableOpacity>
            )}
          </>
        )}
        
        {showLivello && !livelloData && (
          <View style={styles.livelloLoading}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        )}

        {/* User Info Card */}
        <View style={styles.userCard}>
          <Text style={styles.fraseMotivazionale}>{fraseMotivazionale}</Text>
          <Text style={styles.userName}>{user?.nome} {user?.cognome}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.text} />
              <Text style={styles.adminBadgeText}>Amministratore</Text>
            </View>
          )}
          {isIstruttore && (
            <View style={[styles.adminBadge, { backgroundColor: '#8B5CF6' }]}>
              <Ionicons name="fitness" size={14} color="#FFF" />
              <Text style={[styles.adminBadgeText, { color: '#FFF' }]}>Istruttore</Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informazioni</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Nome completo</Text>
                <Text style={styles.infoValue}>{user?.nome} {user?.cognome}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
            </View>
            {user?.telefono && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Telefono</Text>
                    <Text style={styles.infoValue}>{user?.telefono}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="fitness-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>App</Text>
                <Text style={styles.infoValue}>DanoFitness23</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Stagione</Text>
                <Text style={styles.infoValue}>Invernale 2025/26</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contatti</Text>
          <View style={styles.contactCard}>
            <Ionicons name="call" size={24} color={COLORS.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>Daniele</Text>
              <Text style={styles.contactNumber}>339 50 20 625</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Esci</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Info Livelli - Solo per utenti normali */}
      {showLivello && (
        <Modal
          visible={showLivelloInfo}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLivelloInfo(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🏆 Sistema Livelli</Text>
                <TouchableOpacity onPress={() => setShowLivelloInfo(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalDescription}>
                Il tuo livello si basa su quante volte ti alleni durante la settimana (Lun-Sab). Allenati di più per salire di livello! 💪
              </Text>

              <View style={styles.livelliList}>
                {livelloData?.tutti_livelli.map((liv) => (
                  <View 
                    key={liv.livello} 
                    style={[
                      styles.livelloRow,
                      livelloData.livello === liv.livello && styles.livelloRowActive
                    ]}
                  >
                    <Text style={styles.livelloRowIcona}>{liv.icona}</Text>
                    <View style={styles.livelloRowInfo}>
                      <Text style={styles.livelloRowNome}>{liv.nome}</Text>
                      <Text style={styles.livelloRowDesc}>{liv.descrizione}</Text>
                    </View>
                    <Text style={styles.livelloRowNum}>{liv.livello}/5</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowLivelloInfo(false)}
              >
                <Text style={styles.modalButtonText}>Ho capito!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal Bacheca Medaglie */}
      {showLivello && medaglieData && (
        <Modal
          visible={showMedaglieModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMedaglieModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🏅 Bacheca Medaglie</Text>
                <TouchableOpacity onPress={() => setShowMedaglieModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              {/* Riepilogo Medaglie */}
              <View style={styles.medaglieSummary}>
                <View style={styles.medagliaSummaryItem}>
                  <Text style={styles.medagliaSummaryEmoji}>🥇</Text>
                  <Text style={styles.medagliaSummaryCount}>{medaglieData.oro}</Text>
                  <Text style={styles.medagliaSummaryLabel}>Oro</Text>
                </View>
                <View style={styles.medagliaSummaryItem}>
                  <Text style={styles.medagliaSummaryEmoji}>🥈</Text>
                  <Text style={styles.medagliaSummaryCount}>{medaglieData.argento}</Text>
                  <Text style={styles.medagliaSummaryLabel}>Argento</Text>
                </View>
                <View style={styles.medagliaSummaryItem}>
                  <Text style={styles.medagliaSummaryEmoji}>🥉</Text>
                  <Text style={styles.medagliaSummaryCount}>{medaglieData.bronzo}</Text>
                  <Text style={styles.medagliaSummaryLabel}>Bronzo</Text>
                </View>
              </View>

              <Text style={styles.medaglieListTitle}>Storico Vittorie</Text>
              
              <ScrollView style={styles.medaglieScrollList} showsVerticalScrollIndicator={false}>
                {medaglieData.medaglie.length > 0 ? (
                  medaglieData.medaglie.map((m, index) => (
                    <View key={index} style={styles.medagliaHistoryRow}>
                      <Text style={styles.medagliaHistoryEmoji}>
                        {m.medaglia === 'oro' ? '🥇' : m.medaglia === 'argento' ? '🥈' : '🥉'}
                      </Text>
                      <View style={styles.medagliaHistoryInfo}>
                        <Text style={styles.medagliaHistoryWeek}>{m.settimana}</Text>
                        <Text style={styles.medagliaHistoryDetail}>
                          {m.posizione}° posto • {m.allenamenti} allenamenti
                          {m.pari_merito && ' • Pari merito'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noMedaglieText}>Nessuna medaglia ancora. Allenati per vincerne!</Text>
                )}
              </ScrollView>

              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowMedaglieModal(false)}
              >
                <Text style={styles.modalButtonText}>Chiudi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 24,
  },
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  fraseMotivazionale: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
    paddingHorizontal: 10,
  },
  userName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 10,
    color: COLORS.text,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
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
  contactName: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  contactNumber: {
    fontSize: 10,
    color: COLORS.primary,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.error,
  },
  errorText: {
    fontSize: 10,
    color: COLORS.error,
    marginTop: 8,
    textAlign: 'center',
  },
  // Livello Styles
  livelloCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  
  // CARD SETTIMANA IN CORSO
  currentWeekCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  currentWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentWeekBadge: {
    backgroundColor: COLORS.primary,
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  currentWeekDates: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  currentWeekContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  currentWeekStats: {
    alignItems: 'center',
  },
  currentWeekNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.primary,
  },
  currentWeekLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -4,
  },
  currentWeekProgress: {
    flex: 1,
  },
  progressBarLarge: {
    flexDirection: 'row',
    gap: 4,
  },
  progressSegmentLarge: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSegmentLargeFilled: {
    backgroundColor: COLORS.primary,
  },
  progressSegmentLargePrenotato: {
    backgroundColor: COLORS.primary + '50',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  progressSegmentNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  prenotatiText: {
    fontSize: 11,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 6,
  },
  nextLevelBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 10,
    marginTop: 16,
  },
  nextLevelText: {
    fontSize: 13,
    color: COLORS.text,
    textAlign: 'center',
  },
  godModeBox: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  godModeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },

  // CARD SETTIMANA PRECEDENTE
  prevWeekCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  prevWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  prevWeekTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  prevWeekDates: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  prevWeekContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prevWeekIcona: {
    fontSize: 32,
    marginRight: 12,
  },
  prevWeekInfo: {
    flex: 1,
  },
  prevWeekNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  prevWeekDescrizione: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  livelloLoading: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 40,
    marginBottom: 16,
    alignItems: 'center',
  },

  // Stili vecchi mantenuti per compatibilità
  livelloTitolo: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  livelloHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  livelloIcona: {
    fontSize: 40,
    marginRight: 12,
  },
  livelloInfo: {
    flex: 1,
  },
  livelloNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  livelloDescrizione: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  progressSegmentFilled: {
    backgroundColor: COLORS.primary,
  },
  progressSegmentPrenotato: {
    backgroundColor: COLORS.warning,
  },
  progressTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  prossimoLivello: {
    fontSize: 12,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  livelliList: {
    gap: 8,
  },
  livelloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 12,
  },
  livelloRowActive: {
    backgroundColor: COLORS.primary + '30',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  livelloRowIcona: {
    fontSize: 24,
    marginRight: 12,
  },
  livelloRowInfo: {
    flex: 1,
  },
  livelloRowNome: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  livelloRowDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  livelloRowNum: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Bacheca Medaglie Styles
  medaglieCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  medaglieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  medaglieTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  medaglieContent: {
    alignItems: 'center',
  },
  medaglieRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 8,
  },
  medagliaItem: {
    alignItems: 'center',
  },
  medagliaEmoji: {
    fontSize: 32,
  },
  medagliaCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 4,
  },
  medaglieTotale: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  // Modal Medaglie
  medaglieSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  medagliaSummaryItem: {
    alignItems: 'center',
  },
  medagliaSummaryEmoji: {
    fontSize: 36,
  },
  medagliaSummaryCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 4,
  },
  medagliaSummaryLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  medaglieListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  medaglieScrollList: {
    maxHeight: 300,
  },
  medagliaHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  medagliaHistoryEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  medagliaHistoryInfo: {
    flex: 1,
  },
  medagliaHistoryWeek: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  medagliaHistoryDetail: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  noMedaglieText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
