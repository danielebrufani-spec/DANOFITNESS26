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

  useEffect(() => {
    if (showLivello) {
      loadLivello();
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
        {showLivello && (
          <TouchableOpacity 
            style={styles.livelloCard} 
            onPress={() => setShowLivelloInfo(true)}
            activeOpacity={0.8}
          >
            {livelloData ? (
              <>
                {/* Livello Raggiunto - Settimana Precedente */}
                <Text style={styles.livelloTitolo}>🏆 Livello raggiunto ({livelloData.settimana_precedente})</Text>
                <View style={styles.livelloHeader}>
                  <Text style={styles.livelloIcona}>{livelloData.icona}</Text>
                  <View style={styles.livelloInfo}>
                    <Text style={styles.livelloNome}>{livelloData.nome}</Text>
                    <Text style={styles.livelloDescrizione}>{livelloData.descrizione}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowLivelloInfo(true)}>
                    <Ionicons name="information-circle-outline" size={24} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                {/* Divider */}
                <View style={styles.divider} />
                
                {/* Progresso Settimana Corrente */}
                <Text style={styles.progressTitle}>📈 Questa settimana ({livelloData.settimana_corrente})</Text>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.progressSegment,
                          i < livelloData.allenamenti_fatti && styles.progressSegmentFilled,
                          i >= livelloData.allenamenti_fatti && i < (livelloData.allenamenti_fatti + livelloData.allenamenti_prenotati) && styles.progressSegmentPrenotato
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.progressText}>
                    {livelloData.allenamenti_fatti} fatti {livelloData.allenamenti_prenotati > 0 ? `+ ${livelloData.allenamenti_prenotati} prenotati` : ''} / 6
                  </Text>
                </View>

                {livelloData.prossimo_livello && livelloData.allenamenti_fatti < 6 && (
                  <Text style={styles.prossimoLivello}>
                    Per salire: raggiungi {livelloData.prossimo_livello.icona} {livelloData.prossimo_livello.nome}
                  </Text>
                )}
              </>
            ) : (
              <ActivityIndicator color={COLORS.primary} />
            )}
          </TouchableOpacity>
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
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
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
});
