import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';
import { apiService, Announcement, AnnouncementColor, AnnouncementPayload } from '../services/api';

/**
 * Pannello Admin per gestire i popup "Avvisi del Giorno" mostrati ai clienti
 * all'apertura dell'app. Consente di creare/modificare/attivare/disattivare/eliminare.
 */

const COLOR_OPTIONS: { key: AnnouncementColor; label: string; hex: string }[] = [
  { key: 'orange', label: 'Arancio', hex: '#FF6B00' },
  { key: 'red',    label: 'Rosso',   hex: '#FF4D6D' },
  { key: 'yellow', label: 'Giallo',  hex: '#FFEA00' },
  { key: 'blue',   label: 'Blu',     hex: '#00C8FF' },
  { key: 'green',  label: 'Verde',   hex: '#00E676' },
];

function isoWithZ(d: Date): string {
  // Manda al backend un ISO con timezone locale (verrà normalizzato lato server)
  const tzMinutes = -d.getTimezoneOffset();
  const sign = tzMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(tzMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${hh}:${mm}`;
}

function formatScadenza(iso: string | null | undefined): string {
  if (!iso) return 'Nessuna scadenza';
  try {
    const d = new Date(iso);
    return d.toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return 'Data non valida';
  }
}

export const AdminAnnouncementsPanel: React.FC = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  // form state
  const [fTitolo, setFTitolo] = useState('');
  const [fMessaggio, setFMessaggio] = useState('');
  const [fColore, setFColore] = useState<AnnouncementColor>('orange');
  const [fLampeggiante, setFLampeggiante] = useState(false);
  const [fAttivo, setFAttivo] = useState(true);
  const [fScadenzaData, setFScadenzaData] = useState(''); // YYYY-MM-DD
  const [fScadenzaOra, setFScadenzaOra] = useState('');   // HH:MM
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiService.adminListAnnouncements();
      setItems(res.data.announcements || []);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Errore load annunci', e?.response?.data || e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setFTitolo('');
    setFMessaggio('');
    setFColore('orange');
    setFLampeggiante(false);
    setFAttivo(true);
    setFScadenzaData('');
    setFScadenzaOra('');
    setShowModal(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setFTitolo(a.titolo);
    setFMessaggio(a.messaggio);
    setFColore(a.colore);
    setFLampeggiante(a.lampeggiante);
    setFAttivo(a.attivo);
    if (a.scadenza) {
      const d = new Date(a.scadenza);
      const pad = (n: number) => String(n).padStart(2, '0');
      setFScadenzaData(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setFScadenzaOra(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else {
      setFScadenzaData('');
      setFScadenzaOra('');
    }
    setShowModal(true);
  };

  const validateForm = (): string | null => {
    if (!fTitolo.trim()) return 'Il titolo è obbligatorio';
    if (!fMessaggio.trim()) return 'Il messaggio è obbligatorio';
    if ((fScadenzaData && !fScadenzaOra) || (!fScadenzaData && fScadenzaOra)) {
      return 'Compila sia data che ora scadenza, oppure lasciale entrambe vuote';
    }
    if (fScadenzaData) {
      // Valida formato YYYY-MM-DD e HH:MM
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fScadenzaData)) return 'Data scadenza formato non valido (YYYY-MM-DD)';
      if (!/^\d{2}:\d{2}$/.test(fScadenzaOra)) return 'Ora scadenza formato non valido (HH:MM)';
    }
    return null;
  };

  const save = async () => {
    const err = validateForm();
    if (err) {
      if (Platform.OS === 'web') window.alert(err); else Alert.alert('Errore', err);
      return;
    }

    let scadenzaIso: string | null = null;
    if (fScadenzaData && fScadenzaOra) {
      const [y, mo, d] = fScadenzaData.split('-').map(Number);
      const [h, mi] = fScadenzaOra.split(':').map(Number);
      const dt = new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, 0);
      scadenzaIso = isoWithZ(dt);
    }

    const payload: AnnouncementPayload = {
      titolo: fTitolo.trim(),
      messaggio: fMessaggio.trim(),
      colore: fColore,
      lampeggiante: fLampeggiante,
      attivo: fAttivo,
      scadenza: scadenzaIso,
    };

    try {
      setSaving(true);
      if (editing) {
        await apiService.adminUpdateAnnouncement(editing.id, {
          ...payload,
          scadenza_clear: !scadenzaIso ? true : undefined,
        });
      } else {
        await apiService.adminCreateAnnouncement(payload);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore durante il salvataggio';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Errore', msg);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string) => {
    try {
      await apiService.adminToggleAnnouncement(id);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore toggle';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Errore', msg);
    }
  };

  const confirmDelete = (a: Announcement) => {
    const message = `Sicuro di voler eliminare l'avviso "${a.titolo}"?`;
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (!window.confirm(message)) return;
      doDelete(a.id);
    } else {
      Alert.alert(
        'Elimina avviso',
        message,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Elimina', style: 'destructive', onPress: () => doDelete(a.id) },
        ],
      );
    }
  };

  const doDelete = async (id: string) => {
    try {
      await apiService.adminDeleteAnnouncement(id);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore eliminazione';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Errore', msg);
    }
  };

  return (
    <View style={styles.container} testID="admin-announcements-panel">
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Avvisi Popup</Text>
          <Text style={styles.subtitle}>
            Messaggi che compaiono ai clienti all'apertura dell'app. Li puoi attivare/disattivare in qualunque momento.
          </Text>
        </View>
        <TouchableOpacity
          onPress={openCreate}
          style={styles.newBtn}
          activeOpacity={0.85}
          testID="announcements-new-btn"
        >
          <Ionicons name="add-circle" size={22} color="#000" />
          <Text style={styles.newBtnText}>NUOVO</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.emptyText}>Caricamento…</Text>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="megaphone-outline" size={36} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Nessun avviso configurato</Text>
          <Text style={styles.emptyText}>Clicca "NUOVO" per creare il primo popup.</Text>
        </View>
      ) : (
        items.map((a) => {
          const palette = COLOR_OPTIONS.find(o => o.key === a.colore) || COLOR_OPTIONS[0];
          const isExpired = !!(a.scadenza && new Date(a.scadenza) < new Date());
          return (
            <View
              key={a.id}
              style={[styles.card, { borderLeftColor: palette.hex }]}
              testID={`announcement-card-${a.id}`}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.dot, { backgroundColor: palette.hex }]} />
                <Text style={styles.cardTitle} numberOfLines={1}>{a.titolo}</Text>
                <View style={[styles.statusBadge, a.attivo && !isExpired ? styles.statusOn : styles.statusOff]}>
                  <Text style={[styles.statusText, a.attivo && !isExpired ? styles.statusTextOn : styles.statusTextOff]}>
                    {isExpired ? 'SCADUTO' : (a.attivo ? 'ATTIVO' : 'OFF')}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardMsg} numberOfLines={3}>{a.messaggio}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="color-palette-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{palette.label}</Text>
                </View>
                {a.lampeggiante && (
                  <View style={styles.metaItem}>
                    <Ionicons name="flash-outline" size={14} color="#FFEA00" />
                    <Text style={[styles.metaText, { color: '#FFEA00' }]}>Lampeggiante</Text>
                  </View>
                )}
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{formatScadenza(a.scadenza)}</Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  onPress={() => toggle(a.id)}
                  style={[styles.actionBtn, a.attivo ? styles.btnOff : styles.btnOn]}
                  activeOpacity={0.85}
                  testID={`announcement-toggle-${a.id}`}
                >
                  <Ionicons name={a.attivo ? 'pause' : 'play'} size={14} color="#fff" />
                  <Text style={styles.actionText}>{a.attivo ? 'Disattiva' : 'Attiva'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openEdit(a)}
                  style={[styles.actionBtn, styles.btnEdit]}
                  activeOpacity={0.85}
                  testID={`announcement-edit-${a.id}`}
                >
                  <Ionicons name="create-outline" size={14} color="#fff" />
                  <Text style={styles.actionText}>Modifica</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(a)}
                  style={[styles.actionBtn, styles.btnDelete]}
                  activeOpacity={0.85}
                  testID={`announcement-delete-${a.id}`}
                >
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                  <Text style={styles.actionText}>Elimina</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Form Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Modifica Avviso' : 'Nuovo Avviso'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <Text style={styles.label}>Titolo *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es. AVVISO IMPORTANTE"
                placeholderTextColor={COLORS.textSecondary}
                value={fTitolo}
                onChangeText={setFTitolo}
                maxLength={80}
                testID="announcement-input-title"
              />

              <Text style={styles.label}>Messaggio *</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Scrivi qui il messaggio da mostrare ai clienti…"
                placeholderTextColor={COLORS.textSecondary}
                value={fMessaggio}
                onChangeText={setFMessaggio}
                multiline
                numberOfLines={4}
                maxLength={500}
                testID="announcement-input-message"
              />

              <Text style={styles.label}>Colore tema</Text>
              <View style={styles.colorGrid}>
                {COLOR_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setFColore(c.key)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c.hex },
                      fColore === c.key && styles.colorSwatchActive,
                    ]}
                    testID={`announcement-color-${c.key}`}
                  >
                    {fColore === c.key && (
                      <Ionicons name="checkmark" size={20} color="#000" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Effetto lampeggiante ✨</Text>
                <Switch
                  value={fLampeggiante}
                  onValueChange={setFLampeggiante}
                  thumbColor={fLampeggiante ? COLORS.primary : '#888'}
                  trackColor={{ false: '#333', true: `${COLORS.primary}55` }}
                  testID="announcement-switch-blink"
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Attivo (mostralo ai clienti)</Text>
                <Switch
                  value={fAttivo}
                  onValueChange={setFAttivo}
                  thumbColor={fAttivo ? '#00E676' : '#888'}
                  trackColor={{ false: '#333', true: '#00E67655' }}
                  testID="announcement-switch-active"
                />
              </View>

              <Text style={styles.label}>Scadenza automatica (opzionale)</Text>
              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textSecondary}
                  value={fScadenzaData}
                  onChangeText={setFScadenzaData}
                  maxLength={10}
                  testID="announcement-input-scadenza-data"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="HH:MM"
                  placeholderTextColor={COLORS.textSecondary}
                  value={fScadenzaOra}
                  onChangeText={setFScadenzaOra}
                  maxLength={5}
                  testID="announcement-input-scadenza-ora"
                />
              </View>
              <Text style={styles.helper}>
                Lascia vuoto per non impostare scadenza. Oltre questa data l'avviso non verrà più mostrato.
              </Text>
            </ScrollView>

            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              activeOpacity={0.85}
              testID="announcement-save-btn"
            >
              <Ionicons name="save" size={20} color="#000" />
              <Text style={styles.saveBtnText}>{saving ? 'Salvataggio…' : 'SALVA'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AdminAnnouncementsPanel;

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 22,
    color: COLORS.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newBtnText: { fontFamily: FONTS.bodyBlack, fontSize: 13, color: '#000', letterSpacing: 1 },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 15,
    color: COLORS.text,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: {
    flex: 1,
    fontFamily: FONTS.bodyBlack,
    fontSize: 15,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusOn: { backgroundColor: '#00E67622' },
  statusOff: { backgroundColor: '#88888822' },
  statusText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 10,
    letterSpacing: 1,
  },
  statusTextOn: { color: '#00E676' },
  statusTextOff: { color: '#888' },
  cardMsg: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 10,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 88,
    justifyContent: 'center',
  },
  actionText: { fontFamily: FONTS.bodyBlack, fontSize: 12, color: '#fff', letterSpacing: 0.5 },
  btnOn: { backgroundColor: '#00A852' },
  btnOff: { backgroundColor: '#666' },
  btnEdit: { backgroundColor: '#0077B6' },
  btnDelete: { backgroundColor: '#B00020' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: FONTS.headline,
    fontSize: 20,
    color: COLORS.text,
    letterSpacing: 1,
  },
  label: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 13,
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  colorGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchActive: { borderColor: COLORS.text },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  switchLabel: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text },
  rowInputs: { flexDirection: 'row' },
  helper: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  saveBtnText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 15,
    color: '#000',
    letterSpacing: 1.4,
  },
});
