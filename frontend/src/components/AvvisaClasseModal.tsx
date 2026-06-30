import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';

interface Participant {
  nome?: string;
  cognome?: string;
  display_name?: string;
  telefono?: string;
  user_id?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  participants: Participant[];
  lessonInfo: { tipo: string; orario: string; data: string }; // es. { tipo: 'Funzionale', orario: '18:30', data: '01/07/2026' }
  loading?: boolean;
}

/** Normalizza il numero telefono in formato wa.me (solo cifre, prefisso 39 se manca) */
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let n = raw.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.substring(1);
  if (!n) return null;
  // Se non inizia con prefisso internazionale, assume Italia (39)
  if (!n.startsWith('39') && n.length === 10) n = '39' + n;
  return n;
}

export const AvvisaClasseModal: React.FC<Props> = ({ visible, onClose, participants, lessonInfo, loading }) => {
  const defaultMessage = `Ciao! La lezione di ${lessonInfo.tipo} delle ${lessonInfo.orario} del ${lessonInfo.data} è ANNULLATA.\n\nCi scusiamo per l'inconveniente.\n\nDaniele · DanoFitness23`;
  const [message, setMessage] = useState(defaultMessage);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setMessage(defaultMessage);
      setSentTo(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lessonInfo.tipo, lessonInfo.orario, lessonInfo.data]);

  const handleSend = (p: Participant) => {
    const phone = normalizePhone(p.telefono || '');
    if (!phone) return;
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${phone}?text=${encoded}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {});
    }
    setSentTo((prev) => {
      const next = new Set(prev);
      next.add(p.user_id || p.telefono || p.display_name || '');
      return next;
    });
  };

  const validParticipants = participants.filter(p => normalizePhone(p.telefono || ''));
  const skippedCount = participants.length - validParticipants.length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="avvisa-classe-modal">
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>AVVISA CLASSE</Text>
              <Text style={styles.title}>📱 Invio WhatsApp</Text>
              <Text style={styles.lessonInfo}>
                {lessonInfo.tipo} · {lessonInfo.orario} · {lessonInfo.data}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="avvisa-close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Editor messaggio */}
            <Text style={styles.label}>MESSAGGIO DA INVIARE</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              style={styles.input}
              placeholder="Scrivi il messaggio..."
              placeholderTextColor={COLORS.textSecondary}
              testID="avvisa-message-input"
            />
            <Text style={styles.hint}>
              💡 Modifica il messaggio come preferisci. Verrà aperto WhatsApp con questo testo pre-compilato.
            </Text>

            {/* Lista partecipanti */}
            <Text style={[styles.label, { marginTop: 18 }]}>
              {loading ? 'CARICAMENTO...' : `PARTECIPANTI (${validParticipants.length})`}
            </Text>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 14 }} />
            ) : validParticipants.length === 0 ? (
              <Text style={styles.emptyText}>Nessun partecipante con numero di telefono valido.</Text>
            ) : (
              validParticipants.map((p, i) => {
                const key = p.user_id || p.telefono || `${i}`;
                const isSent = sentTo.has(key);
                return (
                  <View key={key} style={[styles.partRow, isSent && styles.partRowSent]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partName}>
                        {p.display_name || `${p.nome || ''} ${p.cognome || ''}`.trim() || 'Utente'}
                      </Text>
                      <Text style={styles.partPhone}>📞 {p.telefono}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleSend(p)}
                      style={[styles.sendBtn, isSent && styles.sendBtnSent]}
                      testID={`avvisa-send-${i}`}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={isSent ? 'checkmark-done' : 'logo-whatsapp'}
                        size={16}
                        color={isSent ? '#000' : '#fff'}
                      />
                      <Text style={[styles.sendBtnText, isSent && { color: '#000' }]}>
                        {isSent ? 'INVIATO' : 'INVIA'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            {skippedCount > 0 && (
              <View style={styles.warnBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#FFEA00" />
                <Text style={styles.warnText}>
                  {skippedCount} partecipante/i senza numero di telefono — saltati.
                </Text>
              </View>
            )}

            {/* Progress */}
            {validParticipants.length > 0 && (
              <View style={styles.progressBox}>
                <Text style={styles.progressText}>
                  Inviati: <Text style={styles.progressNum}>{sentTo.size}/{validParticipants.length}</Text>
                </Text>
                {sentTo.size === validParticipants.length && (
                  <Text style={styles.doneText}>✅ Tutti avvisati!</Text>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={styles.doneBtn} testID="avvisa-done">
            <Text style={styles.doneBtnText}>CHIUDI</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default AvvisaClasseModal;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  kicker: { fontFamily: FONTS.bodyBlack, fontSize: 11, color: '#25D366', letterSpacing: 2.4, marginBottom: 4 },
  title: { fontFamily: FONTS.headline, fontSize: 22, color: COLORS.text, letterSpacing: 1 },
  lessonInfo: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  scroll: { padding: 18, paddingBottom: 30 },

  label: { fontFamily: FONTS.bodyBlack, fontSize: 11, color: COLORS.textSecondary, letterSpacing: 1.4, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  hint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 8 },

  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 14 },

  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  partRowSent: {
    borderColor: '#FFEA00',
    backgroundColor: 'rgba(255,234,0,0.08)',
  },
  partName: { fontFamily: FONTS.bodyBlack, fontSize: 14, color: COLORS.text },
  partPhone: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#25D366',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  sendBtnSent: { backgroundColor: '#FFEA00' },
  sendBtnText: { fontFamily: FONTS.bodyBlack, fontSize: 12, color: '#fff', letterSpacing: 1 },

  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,234,0,0.1)',
    borderWidth: 1,
    borderColor: '#FFEA00',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  warnText: { flex: 1, fontFamily: FONTS.body, fontSize: 12, color: '#FFEA00' },

  progressBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0,200,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,200,255,0.25)',
    alignItems: 'center',
    gap: 4,
  },
  progressText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text },
  progressNum: { fontFamily: FONTS.bodyBlack, color: '#00C8FF' },
  doneText: { fontFamily: FONTS.bodyBlack, fontSize: 14, color: '#39FF14', marginTop: 4 },

  doneBtn: {
    marginHorizontal: 18,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: { fontFamily: FONTS.bodyBlack, fontSize: 14, color: '#fff', letterSpacing: 1.5 },
});
