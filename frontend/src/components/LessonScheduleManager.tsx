import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';
import { apiService, Activity, Lesson } from '../services/api';

/**
 * Pannello Admin per gestire l'orario settimanale.
 * - Vista lista raggruppata per giorno (mobile-friendly)
 * - CRUD lezioni: crea, modifica, elimina
 * - CRUD attività (dinamiche): sotto-modale
 */

const GIORNI_ORDER: string[] = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
const GIORNI_LABEL: Record<string, string> = {
  lunedi: 'Lunedì',
  martedi: 'Martedì',
  mercoledi: 'Mercoledì',
  giovedi: 'Giovedì',
  venerdi: 'Venerdì',
  sabato: 'Sabato',
  domenica: 'Domenica',
};

const COLOR_PRESETS = ['#FF4500', '#FF6B00', '#FF1493', '#FFEA00', '#00C8FF', '#00E5FF', '#00E676', '#00B0FF', '#B388FF', '#9E9E9E'];

const alertFn = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(msg); else Alert.alert(title, msg);
};
const confirmFn = (msg: string): boolean => {
  if (Platform.OS === 'web') return window.confirm(msg);
  return true; // native path handles via Alert.alert async
};

export const LessonScheduleManager: React.FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  // Lesson form state
  const [fGiorno, setFGiorno] = useState<string>('lunedi');
  const [fOrario, setFOrario] = useState<string>('');
  const [fTipo, setFTipo] = useState<string>('');
  const [fCoach, setFCoach] = useState<string>('Daniele');
  const [fDesc, setFDesc] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [lessRes, actRes] = await Promise.all([
        apiService.getLessons(),
        apiService.listActivities(),
      ]);
      setLessons(lessRes.data);
      setActivities(actRes.data.activities || []);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Errore load schedule', e?.response?.data || e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const lessonsByDay = useMemo(() => {
    const map: Record<string, Lesson[]> = {};
    for (const g of GIORNI_ORDER) map[g] = [];
    for (const l of lessons) {
      const g = (l.giorno || '').toLowerCase();
      if (map[g]) map[g].push(l);
    }
    for (const g of GIORNI_ORDER) map[g].sort((a, b) => (a.orario || '').localeCompare(b.orario || ''));
    return map;
  }, [lessons]);

  const activityByKey = useMemo(() => {
    const m: Record<string, Activity> = {};
    for (const a of activities) m[a.key] = a;
    return m;
  }, [activities]);

  const openCreate = (giornoDefault?: string) => {
    setEditingLesson(null);
    setFGiorno(giornoDefault || 'lunedi');
    setFOrario('');
    setFTipo(activities[0]?.key || '');
    setFCoach('Daniele');
    setFDesc('');
    setShowLessonModal(true);
  };

  const openEdit = (l: Lesson) => {
    setEditingLesson(l);
    setFGiorno(l.giorno);
    setFOrario(l.orario);
    setFTipo(l.tipo_attivita);
    setFCoach(l.coach || 'Daniele');
    setFDesc(l.descrizione || '');
    setShowLessonModal(true);
  };

  const validateLesson = (): string | null => {
    if (!fGiorno) return 'Giorno obbligatorio';
    if (!/^\d{2}:\d{2}$/.test(fOrario)) return 'Orario formato non valido (HH:MM, es. 18:30)';
    if (!fTipo) return 'Attività obbligatoria';
    if (!fCoach.trim()) return 'Coach obbligatorio';
    return null;
  };

  const saveLesson = async () => {
    const err = validateLesson();
    if (err) { alertFn('Errore', err); return; }
    const payload = {
      giorno: fGiorno,
      orario: fOrario,
      tipo_attivita: fTipo,
      coach: fCoach.trim(),
      descrizione: fDesc.trim() || undefined,
    };
    try {
      setSaving(true);
      if (editingLesson) {
        await apiService.adminUpdateLesson(editingLesson.id, payload);
      } else {
        await apiService.adminCreateLesson(payload);
      }
      setShowLessonModal(false);
      await load();
    } catch (e: any) {
      alertFn('Errore', e?.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const deleteLesson = async (l: Lesson) => {
    const msg = `Eliminare la lezione ${GIORNI_LABEL[l.giorno] || l.giorno} ${l.orario} - ${activityByKey[l.tipo_attivita]?.nome || l.tipo_attivita}?`;
    if (Platform.OS === 'web' ? !window.confirm(msg) : false) return;
    if (Platform.OS !== 'web') {
      return Alert.alert('Elimina', msg, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: () => doDeleteLesson(l.id) },
      ]);
    }
    await doDeleteLesson(l.id);
  };

  const doDeleteLesson = async (id: string) => {
    try {
      await apiService.adminDeleteLesson(id);
      await load();
    } catch (e: any) {
      alertFn('Errore', e?.response?.data?.detail || 'Errore eliminazione');
    }
  };

  return (
    <View style={styles.container} testID="schedule-manager">
      {/* Header con azioni */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.actionsBtnPrimary}
          onPress={() => openCreate()}
          activeOpacity={0.85}
          testID="schedule-add-lesson"
        >
          <Ionicons name="add-circle" size={18} color="#000" />
          <Text style={styles.actionsBtnPrimaryText}>NUOVA LEZIONE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionsBtnSecondary}
          onPress={() => setShowActivitiesModal(true)}
          activeOpacity={0.85}
          testID="schedule-manage-activities"
        >
          <Ionicons name="pricetags-outline" size={18} color={COLORS.text} />
          <Text style={styles.actionsBtnSecondaryText}>Gestisci Attività</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.empty}>Caricamento…</Text>
      ) : (
        GIORNI_ORDER.map((g) => {
          const items = lessonsByDay[g] || [];
          return (
            <View key={g} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{GIORNI_LABEL[g]}</Text>
                <View style={styles.dayCount}>
                  <Text style={styles.dayCountText}>{items.length}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => openCreate(g)}
                  style={styles.dayAddBtn}
                  activeOpacity={0.7}
                  testID={`schedule-add-${g}`}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="add" size={18} color={COLORS.primary} />
                  <Text style={styles.dayAddBtnText}>Aggiungi</Text>
                </TouchableOpacity>
              </View>
              {items.length === 0 ? (
                <View style={styles.emptyDay}>
                  <Text style={styles.emptyDayText}>Nessuna lezione</Text>
                </View>
              ) : (
                items.map((l) => {
                  const act = activityByKey[l.tipo_attivita];
                  const color = act?.colore || '#666';
                  const nome = act?.nome || l.tipo_attivita;
                  return (
                    <View
                      key={l.id}
                      style={[styles.lessonCard, { borderLeftColor: color }]}
                      testID={`lesson-card-${l.id}`}
                    >
                      <View style={styles.lessonTop}>
                        <View style={styles.lessonTime}>
                          <Ionicons name="time" size={14} color={COLORS.textSecondary} />
                          <Text style={styles.lessonTimeText}>{l.orario}</Text>
                        </View>
                        <Text style={[styles.lessonActivity, { color }]}>{nome}</Text>
                      </View>
                      <View style={styles.lessonMid}>
                        <Ionicons name="person" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.lessonCoach}>{l.coach || 'Daniele'}</Text>
                      </View>
                      {l.descrizione ? (
                        <Text style={styles.lessonDesc} numberOfLines={2}>{l.descrizione}</Text>
                      ) : null}
                      <View style={styles.lessonActions}>
                        <TouchableOpacity
                          onPress={() => openEdit(l)}
                          style={[styles.lessonBtn, styles.lessonBtnEdit]}
                          activeOpacity={0.85}
                          testID={`lesson-edit-${l.id}`}
                        >
                          <Ionicons name="create-outline" size={14} color="#fff" />
                          <Text style={styles.lessonBtnText}>Modifica</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteLesson(l)}
                          style={[styles.lessonBtn, styles.lessonBtnDelete]}
                          activeOpacity={0.85}
                          testID={`lesson-delete-${l.id}`}
                        >
                          <Ionicons name="trash-outline" size={14} color="#fff" />
                          <Text style={styles.lessonBtnText}>Elimina</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          );
        })
      )}

      {/* Modal Nuova/Modifica Lezione */}
      <Modal visible={showLessonModal} transparent animationType="fade" onRequestClose={() => setShowLessonModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingLesson ? 'Modifica Lezione' : 'Nuova Lezione'}</Text>
              <TouchableOpacity onPress={() => setShowLessonModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              <Text style={styles.label}>Giorno</Text>
              <View style={styles.chipsWrap}>
                {GIORNI_ORDER.map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setFGiorno(g)}
                    style={[styles.chip, fGiorno === g && styles.chipActive]}
                    testID={`lesson-form-day-${g}`}
                  >
                    <Text style={[styles.chipText, fGiorno === g && styles.chipTextActive]}>
                      {GIORNI_LABEL[g].slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Orario (HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="18:30"
                placeholderTextColor={COLORS.textSecondary}
                value={fOrario}
                onChangeText={setFOrario}
                maxLength={5}
                testID="lesson-form-orario"
              />

              <Text style={styles.label}>Attività</Text>
              <View style={styles.chipsWrap}>
                {activities.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => setFTipo(a.key)}
                    style={[
                      styles.chip,
                      fTipo === a.key && { backgroundColor: `${a.colore}20`, borderColor: a.colore },
                    ]}
                    testID={`lesson-form-tipo-${a.key}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        fTipo === a.key && { color: a.colore, fontFamily: FONTS.bodyBlack },
                      ]}
                    >
                      {a.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
                {activities.length === 0 && (
                  <Text style={styles.helper}>Nessuna attività: aprire "Gestisci Attività".</Text>
                )}
              </View>

              <Text style={styles.label}>Coach / Istruttore</Text>
              <TextInput
                style={styles.input}
                placeholder="Es. Daniele, Davide, Elena…"
                placeholderTextColor={COLORS.textSecondary}
                value={fCoach}
                onChangeText={setFCoach}
                maxLength={50}
                testID="lesson-form-coach"
              />

              <Text style={styles.label}>Descrizione (opzionale)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Breve descrizione della lezione…"
                placeholderTextColor={COLORS.textSecondary}
                value={fDesc}
                onChangeText={setFDesc}
                multiline
                maxLength={200}
                testID="lesson-form-desc"
              />
            </ScrollView>

            <TouchableOpacity
              onPress={saveLesson}
              disabled={saving}
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              activeOpacity={0.85}
              testID="lesson-form-save"
            >
              <Ionicons name="save" size={20} color="#000" />
              <Text style={styles.saveBtnText}>{saving ? 'Salvataggio…' : 'SALVA LEZIONE'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Gestisci Attività */}
      <ActivitiesModal
        visible={showActivitiesModal}
        onClose={() => setShowActivitiesModal(false)}
        activities={activities}
        onChanged={load}
      />
    </View>
  );
};


// ================== Sotto-modale per gestire le attività ==================
interface ActivitiesModalProps {
  visible: boolean;
  onClose: () => void;
  activities: Activity[];
  onChanged: () => Promise<void>;
}

const ActivitiesModal: React.FC<ActivitiesModalProps> = ({ visible, onClose, activities, onChanged }) => {
  const [nome, setNome] = useState('');
  const [colore, setColore] = useState('#FF6B00');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const n = nome.trim();
    if (!n) { alertFn('Errore', 'Il nome è obbligatorio'); return; }
    const key = n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    try {
      setSaving(true);
      await apiService.adminCreateActivity({ key, nome: n, colore, icona: 'fitness-center' });
      setNome('');
      setColore('#FF6B00');
      await onChanged();
    } catch (e: any) {
      alertFn('Errore', e?.response?.data?.detail || 'Errore creazione attività');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Activity) => {
    const msg = `Eliminare l'attività "${a.nome}"?`;
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      return doRemove(a);
    }
    Alert.alert('Elimina', msg, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => doRemove(a) },
    ]);
  };

  const doRemove = async (a: Activity) => {
    try {
      await apiService.adminDeleteActivity(a.id);
      await onChanged();
    } catch (e: any) {
      alertFn('Errore', e?.response?.data?.detail || 'Errore eliminazione');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Gestisci Attività</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
            <Text style={styles.label}>Aggiungi nuova attività</Text>
            <TextInput
              style={styles.input}
              placeholder="Es. Zumba, Spinning…"
              placeholderTextColor={COLORS.textSecondary}
              value={nome}
              onChangeText={setNome}
              maxLength={40}
              testID="activity-form-nome"
            />
            <Text style={[styles.label, { marginTop: 10 }]}>Colore</Text>
            <View style={styles.colorRow}>
              {COLOR_PRESETS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColore(c)}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    colore === c && styles.colorSwatchActive,
                  ]}
                  testID={`activity-color-${c}`}
                >
                  {colore === c && <Ionicons name="checkmark" size={16} color="#000" />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={create}
              disabled={saving}
              style={[styles.smallSaveBtn, saving && { opacity: 0.5 }]}
              activeOpacity={0.85}
              testID="activity-form-save"
            >
              <Ionicons name="add-circle" size={16} color="#000" />
              <Text style={styles.smallSaveBtnText}>AGGIUNGI</Text>
            </TouchableOpacity>

            <View style={styles.divider} />
            <Text style={styles.label}>Attività esistenti ({activities.length})</Text>
            {activities.map((a) => (
              <View key={a.id} style={styles.activityRow} testID={`activity-row-${a.key}`}>
                <View style={[styles.activityDot, { backgroundColor: a.colore }]} />
                <Text style={styles.activityName}>{a.nome}</Text>
                {a.is_default && <Text style={styles.badgeDefault}>DEFAULT</Text>}
                <TouchableOpacity
                  onPress={() => remove(a)}
                  style={styles.activityDelete}
                  activeOpacity={0.7}
                  testID={`activity-delete-${a.key}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#B00020" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};


export default LessonScheduleManager;

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  actionsBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  actionsBtnPrimary: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  actionsBtnPrimaryText: { fontFamily: FONTS.bodyBlack, color: '#000', fontSize: 13, letterSpacing: 1 },
  actionsBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  actionsBtnSecondaryText: { fontFamily: FONTS.bodyBlack, color: COLORS.text, fontSize: 12, letterSpacing: 0.5 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 20 },
  daySection: { marginBottom: 18 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  dayLabel: {
    flex: 1,
    fontFamily: FONTS.headline,
    fontSize: 20,
    color: COLORS.text,
    letterSpacing: 1.5,
  },
  dayCount: {
    minWidth: 28,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    backgroundColor: `${COLORS.primary}22`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCountText: { fontFamily: FONTS.bodyBlack, fontSize: 11, color: COLORS.primary, letterSpacing: 0.5 },
  dayAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dayAddBtnText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.primary },
  emptyDay: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  emptyDayText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic' },
  lessonCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
  },
  lessonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  lessonTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lessonTimeText: { fontFamily: FONTS.bodyBlack, fontSize: 13, color: COLORS.text, letterSpacing: 0.5 },
  lessonActivity: {
    fontFamily: FONTS.headline,
    fontSize: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  lessonMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  lessonCoach: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text },
  lessonDesc: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, lineHeight: 17 },
  lessonActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  lessonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  lessonBtnEdit: { backgroundColor: '#0077B6' },
  lessonBtnDelete: { backgroundColor: '#B00020' },
  lessonBtnText: { fontFamily: FONTS.bodyBlack, fontSize: 11, color: '#fff', letterSpacing: 0.5 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
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
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: {
    backgroundColor: `${COLORS.primary}25`,
    borderColor: COLORS.primary,
  },
  chipText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text },
  chipTextActive: { fontFamily: FONTS.bodyBlack, color: COLORS.primary },
  helper: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' },
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
  saveBtnText: { fontFamily: FONTS.bodyBlack, fontSize: 15, color: '#000', letterSpacing: 1.4 },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchActive: { borderColor: COLORS.text },
  smallSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  smallSaveBtnText: { fontFamily: FONTS.bodyBlack, fontSize: 13, color: '#000', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityDot: { width: 12, height: 12, borderRadius: 6 },
  activityName: { flex: 1, fontFamily: FONTS.body, fontSize: 15, color: COLORS.text },
  badgeDefault: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 10,
    color: COLORS.textSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  activityDelete: { padding: 4 },
});
