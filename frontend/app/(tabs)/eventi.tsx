import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  StyleSheet,
  RefreshControl,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';
import { COLORS } from '../../src/utils/constants';
import { FONTS } from '../../src/theme';

const PISCINA_LOGO = 'https://customer-assets.emergentagent.com/job_120068e1-741e-430e-86ee-0f10594d3f2d/artifacts/ev4oef8e_LOGO%20CAMPING.png';

// Compress image (web canvas) — keeps aspect ratio, no crop
async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const maxSide = 1280;
        let { width, height } = img;
        if (width > height && width > maxSide) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else if (height > maxSide) {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface EventItem {
  id: string;
  titolo: string;
  testo: string;
  foto_base64?: string;
  data_evento?: string;
  attivo: boolean;
  created_at?: string;
}

function formatDate(s?: string) {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return s; }
}

export default function EventiScreen() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admin form
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [titolo, setTitolo] = useState('');
  const [testo, setTesto] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [dataEvento, setDataEvento] = useState('');
  const [attivo, setAttivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = isAdmin ? await apiService.adminListEvents() : await apiService.getEvents();
      setEvents(res.data);
    } catch (e) {
      console.error('events load err', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openCreate = () => {
    setEditing(null);
    setTitolo('');
    setTesto('');
    setFoto(null);
    setDataEvento('');
    setAttivo(true);
    setShowModal(true);
  };

  const openEdit = (e: EventItem) => {
    setEditing(e);
    setTitolo(e.titolo);
    setTesto(e.testo);
    setFoto(e.foto_base64 || null);
    setDataEvento(e.data_evento || '');
    setAttivo(e.attivo);
    setShowModal(true);
  };

  const handlePickFile = async () => {
    if (Platform.OS !== 'web') {
      window.alert('Caricamento foto disponibile da web');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (ev: any) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      try {
        const compressed = await compressImageFile(file);
        setFoto(compressed);
      } catch {
        window.alert('Errore caricamento immagine');
      }
    };
    input.click();
  };

  const handleSave = async () => {
    if (!titolo.trim()) {
      window.alert('Inserisci il titolo');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        titolo: titolo.trim(),
        testo: testo.trim(),
        foto_base64: foto,
        data_evento: dataEvento || null,
        attivo,
      };
      if (editing) {
        await apiService.adminUpdateEvent(editing.id, payload);
      } else {
        await apiService.adminCreateEvent(payload);
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      window.alert('Errore: ' + (e?.response?.data?.detail || 'Salvataggio fallito'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: EventItem) => {
    if (!window.confirm(`Eliminare l'evento "${e.titolo}"?`)) return;
    try {
      await apiService.adminDeleteEvent(e.id);
      load();
    } catch (err: any) {
      window.alert('Errore: ' + (err?.response?.data?.detail || 'Eliminazione fallita'));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Logo + slogan */}
        <View style={styles.headerBox}>
          <Image source={{ uri: PISCINA_LOGO }} style={styles.logo} resizeMode="contain" />
          <Text style={styles.slogan}>che Campeggio... che Campeggeria</Text>
        </View>

        {/* Admin: nuovo evento */}
        {isAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreate} data-testid="add-event-btn">
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Pubblica Nuovo Evento</Text>
          </TouchableOpacity>
        )}

        {/* Lista eventi */}
        {events.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {isAdmin ? 'Nessun evento pubblicato. Pubblicane uno!' : 'Nessun evento al momento. Torna presto! 🍹'}
            </Text>
          </View>
        ) : (
          events.map((e) => (
            <View key={e.id} style={styles.eventCard} data-testid={`event-${e.id}`}>
              {!e.attivo && (
                <View style={styles.draftBadge}>
                  <Text style={styles.draftBadgeText}>BOZZA</Text>
                </View>
              )}
              {e.foto_base64 ? (
                <View style={styles.imageWrap}>
                  <Image source={{ uri: e.foto_base64 }} style={styles.eventImage} resizeMode="contain" />
                </View>
              ) : null}
              <View style={styles.cardBody}>
                {e.data_evento ? (
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar" size={14} color={COLORS.primary} />
                    <Text style={styles.dateText}>{formatDate(e.data_evento)}</Text>
                  </View>
                ) : null}
                <Text style={styles.eventTitle}>{e.titolo}</Text>
                {e.testo ? <Text style={styles.eventText}>{e.testo}</Text> : null}
                {isAdmin && (
                  <View style={styles.adminActions}>
                    <TouchableOpacity
                      data-testid={`edit-event-${e.id}`}
                      style={[styles.smallBtn, { backgroundColor: COLORS.primary }]}
                      onPress={() => openEdit(e)}
                    >
                      <Ionicons name="create-outline" size={14} color="#fff" />
                      <Text style={styles.smallBtnText}>Modifica</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      data-testid={`delete-event-${e.id}`}
                      style={[styles.smallBtn, { backgroundColor: COLORS.error }]}
                      onPress={() => handleDelete(e)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                      <Text style={styles.smallBtnText}>Elimina</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal admin */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Modifica Evento' : 'Nuovo Evento'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.label}>Foto</Text>
              <TouchableOpacity style={styles.photoBox} onPress={handlePickFile}>
                {foto ? (
                  <Image source={{ uri: foto }} style={styles.photoPreview} resizeMode="contain" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="cloud-upload-outline" size={40} color="#FF6B00" />
                    <Text style={styles.photoHint}>Tocca per caricare (compressa automaticamente)</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.label}>Titolo</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: Serata Disco anni '90"
                placeholderTextColor={COLORS.textSecondary}
                value={titolo}
                onChangeText={setTitolo}
              />

              <Text style={styles.label}>Descrizione</Text>
              <TextInput
                style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
                multiline
                placeholder="Descrizione dell'evento, orari, dress code, prezzo..."
                placeholderTextColor={COLORS.textSecondary}
                value={testo}
                onChangeText={setTesto}
              />

              <Text style={styles.label}>Data Evento (opzionale)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-08-15"
                placeholderTextColor={COLORS.textSecondary}
                value={dataEvento}
                onChangeText={setDataEvento}
              />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Pubblicato</Text>
                  <Text style={styles.toggleHint}>Se OFF resta come bozza non visibile ai clienti</Text>
                </View>
                <Switch
                  value={attivo}
                  onValueChange={setAttivo}
                  trackColor={{ false: COLORS.border, true: '#FF6B00' }}
                />
              </View>

              <TouchableOpacity
                data-testid="save-event-btn"
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editing ? 'Salva Modifiche' : 'Pubblica Evento'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 100 },

  headerBox: { alignItems: 'center', marginBottom: 18 },
  logo: { width: 240, height: 240 },
  slogan: {
    fontFamily: FONTS.headline,
    fontSize: 22,
    color: '#FF6B00',
    letterSpacing: 1.5,
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'lowercase',
    fontStyle: 'italic',
    textShadowColor: 'rgba(255, 107, 0, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF6B00', padding: 14, borderRadius: 8, marginBottom: 18 },
  addBtnText: { fontFamily: FONTS.bodyBlack, fontSize: 14, color: '#fff', textTransform: 'uppercase', letterSpacing: 1.2 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },

  eventCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    position: 'relative',
  },
  draftBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: COLORS.warning, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, zIndex: 5 },
  draftBadgeText: { fontFamily: FONTS.bodyBlack, fontSize: 10, color: '#000', letterSpacing: 1 },
  imageWrap: {
    width: '100%',
    backgroundColor: '#000',
    paddingVertical: 8,
    alignItems: 'center',
  },
  eventImage: { width: '100%', height: 360 },
  cardBody: { padding: 14 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dateText: { fontFamily: FONTS.bodyBold, fontSize: 12, color: COLORS.primary, letterSpacing: 0.5 },
  eventTitle: { fontFamily: FONTS.headline, fontSize: 24, color: COLORS.text, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  eventText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },
  adminActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  smallBtnText: { fontFamily: FONTS.bodyBold, fontSize: 11, color: '#fff', textTransform: 'uppercase' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 18, maxHeight: '92%', borderTopWidth: 4, borderTopColor: '#FF6B00' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontFamily: FONTS.headline, fontSize: 26, color: COLORS.text, letterSpacing: 1.5, textTransform: 'uppercase' },
  label: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.textSecondary, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: COLORS.surfaceElevated, borderRadius: 6, padding: 12, fontFamily: FONTS.body, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  photoBox: { width: '100%', minHeight: 200, backgroundColor: '#000', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photoPreview: { width: '100%', height: 320 },
  photoPlaceholder: { alignItems: 'center', gap: 8, padding: 30 },
  photoHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 14, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  toggleLabel: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.text },
  toggleHint: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF6B00', padding: 16, borderRadius: 8, marginTop: 18, marginBottom: 30 },
  saveBtnText: { fontFamily: FONTS.bodyBlack, fontSize: 15, color: '#fff', textTransform: 'uppercase', letterSpacing: 1.2 },
});
