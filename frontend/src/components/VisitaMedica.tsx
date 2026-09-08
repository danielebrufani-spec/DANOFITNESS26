import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';

const VISITA_DATA_LIMITE = '2026-10-03';

const oggiStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const visitaPassata = () => oggiStr() > VISITA_DATA_LIMITE;

type Slot = { orario: string; occupato: boolean; mio: boolean };
type AdminSlot = { orario: string; occupato: boolean; nome: string | null; telefono: string | null; manuale: boolean };

const InfoHeader = () => (
  <View style={styles.infoBox}>
    <Text style={styles.infoDate}>📅 SABATO 3 OTTOBRE</Text>
    <Text style={styles.infoText}>
      Visita per <Text style={styles.infoBold}>certificato medico non agonistico</Text> con{' '}
      <Text style={styles.infoBold}>elettrocardiogramma</Text>.
    </Text>
    <View style={styles.priceRow}>
      <Ionicons name="cash-outline" size={18} color="#FFD700" />
      <Text style={styles.priceText}>30€ da pagare direttamente al dottore in contanti</Text>
    </View>
  </View>
);

const splitSlots = <T extends { orario: string }>(slots: T[]) => ({
  mattina: slots.filter((s) => s.orario < '13:00'),
  pomeriggio: slots.filter((s) => s.orario >= '13:00'),
});

// ==================== CLIENTE ====================
export const VisitaMedicaBanner: React.FC = () => {
  const { isAdmin, isIstruttore, user } = useAuth();
  const [open, setOpen] = useState(false);

  if (isAdmin || isIstruttore || user?.archived || visitaPassata()) return null;

  return (
    <>
      <TouchableOpacity style={styles.banner} onPress={() => setOpen(true)} activeOpacity={0.85} testID="visita-medica-banner">
        <View style={styles.bannerIcon}>
          <Ionicons name="medkit" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>PRENOTA LA VISITA MEDICA</Text>
          <Text style={styles.bannerSub}>
            Certificato non agonistico con elettrocardiogramma · Sabato 3 ottobre · 30€ in contanti al dottore
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#00E5FF" />
      </TouchableOpacity>
      {open && <VisitaMedicaModal onClose={() => setOpen(false)} />}
    </>
  );
};

const VisitaMedicaModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [telefono, setTelefono] = useState('');
  const [telefonoSalvato, setTelefonoSalvato] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    apiService.getVisitaSlots().then((res) => {
      setSlots(res.data.slots);
      setTelefonoSalvato(res.data.telefono);
      if (res.data.telefono) setTelefono(res.data.telefono);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const conferma = async () => {
    if (!selected || saving) return;
    if (!telefono.trim()) {
      setError('Inserisci il tuo numero di telefono');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (selected.mio) {
        await apiService.cancellaVisita(selected.orario);
        setSuccess('Prenotazione cancellata.');
      } else {
        await apiService.prenotaVisita(selected.orario, telefono.trim());
        setSuccess(`✅ Visita prenotata! Sabato 3 ottobre ore ${selected.orario}`);
      }
      setSelected(null);
      load();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Errore, riprova');
      load();
    } finally {
      setSaving(false);
    }
  };

  const { mattina, pomeriggio } = splitSlots(slots);

  const renderChip = (s: Slot) => (
    <TouchableOpacity
      key={s.orario}
      style={[
        styles.chip,
        s.mio ? styles.chipMio : s.occupato ? styles.chipOccupato : styles.chipLibero,
        selected?.orario === s.orario && styles.chipSelected,
      ]}
      disabled={s.occupato && !s.mio}
      onPress={() => { setSelected(s); setError(null); setSuccess(null); }}
      testID={`visita-slot-${s.orario.replace(':', '')}`}
    >
      <Text style={[styles.chipText, s.mio && { color: '#39FF14' }, s.occupato && !s.mio && { color: COLORS.textMuted }]}>
        {s.orario}
      </Text>
      {s.mio && <Ionicons name="checkmark-circle" size={13} color="#39FF14" />}
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="visita-medica-modal">
          <View style={styles.headerRow}>
            <Text style={styles.title}>VISITA MEDICA</Text>
            <TouchableOpacity onPress={onClose} testID="visita-medica-close">
              <Ionicons name="close" size={26} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <InfoHeader />
            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />
            ) : (
              <>
                <Text style={styles.sectionLabel}>🌅 MATTINA</Text>
                <View style={styles.grid}>{mattina.map(renderChip)}</View>
                <Text style={styles.sectionLabel}>🌇 POMERIGGIO</Text>
                <View style={styles.grid}>{pomeriggio.map(renderChip)}</View>

                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: 'rgba(0,229,255,0.6)' }]} /><Text style={styles.legendText}>Libero</Text>
                  <View style={[styles.legendDot, { backgroundColor: '#39FF14' }]} /><Text style={styles.legendText}>Tuo</Text>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.textMuted }]} /><Text style={styles.legendText}>Occupato</Text>
                </View>
              </>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          {success && !selected && (
            <View style={styles.successBox} testID="visita-success-box">
              <Ionicons name="checkmark-circle" size={20} color="#39FF14" />
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          {selected && !loading && (
            <View style={styles.confirmBox} testID="visita-confirm-box">
              {selected.mio ? (
                <Text style={styles.confirmText}>Vuoi cancellare la tua visita delle <Text style={styles.confirmBold}>{selected.orario}</Text>?</Text>
              ) : (
                <>
                  <Text style={styles.confirmText}>Confermi la visita di sabato 3 ottobre alle <Text style={styles.confirmBold}>{selected.orario}</Text>?</Text>
                  {!telefonoSalvato && (
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="Il tuo numero di telefono *"
                      placeholderTextColor={COLORS.textMuted}
                      value={telefono}
                      onChangeText={setTelefono}
                      keyboardType="phone-pad"
                      testID="visita-telefono-input"
                    />
                  )}
                </>
              )}
              {error && <Text style={styles.errorText}>{error}</Text>}
              <View style={styles.confirmBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.cancelBtnText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, selected.mio && { backgroundColor: '#FF2D55' }]}
                  onPress={conferma}
                  disabled={saving}
                  testID="visita-confirm-btn"
                >
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                    <Text style={styles.confirmBtnText}>{selected.mio ? 'CANCELLA VISITA' : 'PRENOTA'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ==================== ADMIN ====================
export const VisitaMedicaAdminBanner: React.FC = () => {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isAdmin || visitaPassata()) return null;

  return (
    <>
      <TouchableOpacity style={[styles.banner, { borderColor: '#FFD700' }]} onPress={() => setOpen(true)} activeOpacity={0.85} testID="visita-medica-admin-banner">
        <View style={[styles.bannerIcon, { backgroundColor: '#B8860B' }]}>
          <Ionicons name="medkit" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: '#FFD700' }]}>VISITE MEDICHE — SABATO 3 OTTOBRE</Text>
          <Text style={styles.bannerSub}>Gestisci le prenotazioni: vedi nomi e telefoni, aggiungi o cancella</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFD700" />
      </TouchableOpacity>
      {open && <VisitaMedicaAdminModal onClose={() => setOpen(false)} />}
    </>
  );
};

const VisitaMedicaAdminModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [totale, setTotale] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminSlot | null>(null);
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiService.adminGetVisite().then((res) => {
      setSlots(res.data.slots);
      setTotale(res.data.totale_prenotati);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const azione = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (selected.occupato) {
        await apiService.adminCancellaVisita(selected.orario);
      } else {
        if (!nome.trim()) {
          setError('Inserisci il nome');
          setSaving(false);
          return;
        }
        await apiService.adminPrenotaVisita(selected.orario, nome.trim(), telefono.trim());
      }
      setSelected(null);
      setNome('');
      setTelefono('');
      load();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Errore, riprova');
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="visita-medica-admin-modal">
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: '#FFD700' }]}>VISITE — 3 OTTOBRE</Text>
            <TouchableOpacity onPress={onClose} testID="visita-admin-close">
              <Ionicons name="close" size={26} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.adminCount}>{totale} prenotazioni su {slots.length} posti</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color="#FFD700" style={{ marginVertical: 30 }} />
            ) : (
              slots.map((s) => (
                <View key={s.orario}>
                  <TouchableOpacity
                    style={[styles.adminRow, s.occupato && styles.adminRowOccupato, selected?.orario === s.orario && styles.adminRowSelected]}
                    onPress={() => { setSelected(selected?.orario === s.orario ? null : s); setError(null); setNome(''); setTelefono(''); }}
                    activeOpacity={0.8}
                    testID={`visita-admin-slot-${s.orario.replace(':', '')}`}
                  >
                    <Text style={styles.adminOrario}>{s.orario}</Text>
                    {s.occupato ? (
                      <View style={{ flex: 1 }}>
                        <Text style={styles.adminNome}>{s.nome}{s.manuale ? ' ✍️' : ''}</Text>
                        <Text style={styles.adminTel}>{s.telefono ? `📞 ${s.telefono}` : 'nessun telefono'}</Text>
                      </View>
                    ) : (
                      <Text style={styles.adminLibero}>LIBERO</Text>
                    )}
                    <Ionicons name={s.occupato ? 'person' : 'add-circle-outline'} size={20} color={s.occupato ? '#FFD700' : COLORS.textMuted} />
                  </TouchableOpacity>

                  {selected?.orario === s.orario && (
                    <View style={styles.adminActionBox}>
                      {!s.occupato && (
                        <>
                          <TextInput
                            style={styles.phoneInput}
                            placeholder="Nome e cognome *"
                            placeholderTextColor={COLORS.textMuted}
                            value={nome}
                            onChangeText={setNome}
                            testID="visita-admin-nome-input"
                          />
                          <TextInput
                            style={styles.phoneInput}
                            placeholder="Telefono (opzionale)"
                            placeholderTextColor={COLORS.textMuted}
                            value={telefono}
                            onChangeText={setTelefono}
                            keyboardType="phone-pad"
                            testID="visita-admin-telefono-input"
                          />
                        </>
                      )}
                      {error && <Text style={styles.errorText}>{error}</Text>}
                      <TouchableOpacity
                        style={[styles.confirmBtn, s.occupato && { backgroundColor: '#FF2D55' }]}
                        onPress={azione}
                        disabled={saving}
                        testID="visita-admin-action-btn"
                      >
                        {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                          <Text style={styles.confirmBtnText}>{s.occupato ? 'CANCELLA PRENOTAZIONE' : 'PRENOTA MANUALMENTE'}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    padding: 14,
    marginBottom: 12,
    ...Platform.select({ web: { boxShadow: '0 0 16px rgba(0,229,255,0.2)' }, default: {} }),
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0077B6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: {
    fontFamily: FONTS.headline,
    fontSize: 18,
    color: '#00E5FF',
    letterSpacing: 1.2,
  },
  bannerSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0A0A0C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: '#262633',
    padding: 18,
    maxHeight: '92%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 26,
    color: '#00E5FF',
    letterSpacing: 2,
  },
  infoBox: {
    backgroundColor: '#121216',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262633',
    padding: 14,
    marginBottom: 14,
  },
  infoDate: {
    fontFamily: FONTS.headline,
    fontSize: 20,
    color: '#fff',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  infoBold: {
    color: '#fff',
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: 8,
    padding: 8,
  },
  priceText: {
    flex: 1,
    fontSize: 13,
    color: '#FFD700',
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    minWidth: 72,
    justifyContent: 'center',
  },
  chipLibero: {
    borderColor: 'rgba(0,229,255,0.55)',
    backgroundColor: 'rgba(0,229,255,0.06)',
  },
  chipOccupato: {
    borderColor: '#262633',
    backgroundColor: '#121216',
    opacity: 0.45,
  },
  chipMio: {
    borderColor: '#39FF14',
    backgroundColor: 'rgba(57,255,20,0.08)',
  },
  chipSelected: {
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255,59,48,0.12)',
  },
  chipText: {
    fontFamily: FONTS.headline,
    fontSize: 17,
    color: '#fff',
    letterSpacing: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  legendText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  confirmBox: {
    backgroundColor: '#121216',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    padding: 14,
    marginTop: 10,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(57,255,20,0.08)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#39FF14',
    padding: 14,
    marginTop: 10,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#39FF14',
  },
  confirmText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 10,
    lineHeight: 19,
  },
  confirmBold: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  phoneInput: {
    backgroundColor: '#0A0A0C',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A4D',
    color: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  errorText: {
    color: '#FF2D55',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A4D',
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.5,
    fontSize: 13,
  },
  adminCount: {
    fontSize: 13,
    color: '#FFD700',
    fontWeight: '800',
    marginBottom: 10,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#121216',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262633',
    padding: 12,
    marginBottom: 6,
  },
  adminRowOccupato: {
    borderColor: 'rgba(255,215,0,0.45)',
  },
  adminRowSelected: {
    borderColor: '#FF3B30',
  },
  adminOrario: {
    fontFamily: FONTS.headline,
    fontSize: 20,
    color: '#fff',
    letterSpacing: 1,
    width: 62,
  },
  adminNome: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  adminTel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  adminLibero: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  adminActionBox: {
    backgroundColor: '#121216',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    padding: 12,
    marginBottom: 8,
    marginTop: -2,
  },
});
