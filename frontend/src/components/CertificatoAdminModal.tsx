import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { apiService, CertificatoInfo } from '../services/api';
import { CertUploadForm, CERT_STATUS_UI, formatDataIt, parseDataIt, openCertificatoBlob } from './CertificatoMedico';

interface Props {
  user: { id: string; nome: string; cognome: string } | null;
  onClose: (changed: boolean) => void;
}

export const CertificatoAdminModal: React.FC<Props> = ({ user, onClose }) => {
  const [info, setInfo] = useState<CertificatoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editScadenza, setEditScadenza] = useState(false);
  const [scadenzaInput, setScadenzaInput] = useState('');
  const [convalidaScadenza, setConvalidaScadenza] = useState('');
  const [showRifiuta, setShowRifiuta] = useState(false);
  const [motivoInput, setMotivoInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setInfo(null);
    setShowUpload(false);
    setEditScadenza(false);
    setShowRifiuta(false);
    setMotivoInput('');
    setError(null);
    setFeedback(null);
    setChanged(false);
    setLoading(true);
    apiService
      .adminGetCertificato(user.id)
      .then((res) => {
        setInfo(res.data);
        setConvalidaScadenza(res.data?.scadenza ? formatDataIt(res.data.scadenza) : '');
      })
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const status = info?.status || 'mancante';
  const ui = CERT_STATUS_UI[status];
  const blocco = info?.blocco;

  const handleUploadDone = (res: any) => {
    setShowUpload(false);
    setInfo((prev) => ({ ...res.certificato, blocco: prev?.blocco }));
    setChanged(true);
    setFeedback('Certificato caricato (auto-convalidato)');
  };

  const handleView = async () => {
    if (opening) return;
    setOpening(true);
    try {
      await openCertificatoBlob(user.id);
    } catch {
      setError('File non recuperabile al momento');
    }
    setOpening(false);
  };

  const handleConvalida = async (approva: boolean) => {
    if (busy) return;
    setError(null);
    let scadIso: string | null = null;
    if (approva && convalidaScadenza.trim()) {
      scadIso = parseDataIt(convalidaScadenza);
      if (!scadIso) {
        setError('Scadenza non valida: usa GG/MM/AAAA');
        return;
      }
    }
    if (!approva && !motivoInput.trim()) {
      setError('Indica il motivo del rifiuto');
      return;
    }
    setBusy(true);
    try {
      const res = await apiService.adminConvalidaCertificato(user.id, {
        approva,
        scadenza: approva ? scadIso : undefined,
        motivo: approva ? undefined : motivoInput.trim(),
      });
      setInfo(res.data.certificato);
      setChanged(true);
      setShowRifiuta(false);
      setFeedback(approva
        ? `✅ Convalidato!${res.data.bonus_biglietti ? ` +${res.data.bonus_biglietti} biglietti assegnati al cliente 🎟️` : ''}`
        : '❌ Rifiutato — il cliente ha ricevuto la notifica');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore, riprova');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveScadenza = async () => {
    let iso: string | null = null;
    if (scadenzaInput.trim()) {
      iso = parseDataIt(scadenzaInput);
      if (!iso) {
        setError('Data non valida: usa GG/MM/AAAA');
        return;
      }
    }
    try {
      const res = await apiService.adminUpdateCertScadenza(user.id, iso);
      setInfo((prev) => ({ ...res.data, blocco: prev?.blocco }));
      setEditScadenza(false);
      setError(null);
      setChanged(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore nel salvataggio');
    }
  };

  const handleDelete = async () => {
    const ok = Platform.OS === 'web' ? window.confirm(`Eliminare il certificato di ${user.nome} ${user.cognome}?`) : true;
    if (!ok) return;
    try {
      await apiService.adminDeleteCertificato(user.id);
      const res = await apiService.adminGetCertificato(user.id);
      setInfo(res.data);
      setChanged(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Errore nell'eliminazione");
    }
  };

  const handleDeroga = async (giorni: number | null) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiService.adminCertDeroga(user.id, giorni);
      setInfo((prev) => prev ? { ...prev, blocco: res.data.blocco } : prev);
      setChanged(true);
      setFeedback(giorni ? `🕐 Concessi ${giorni} giorni extra al cliente` : 'Deroga rimossa');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore, riprova');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onClose(changed)}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="cert-admin-modal">
          <View style={styles.header}>
            <Text style={styles.title}>CERTIFICATO MEDICO</Text>
            <TouchableOpacity onPress={() => onClose(changed)} testID="cert-admin-close">
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user.nome} {user.cognome}</Text>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
          ) : showUpload ? (
            <CertUploadForm targetUserId={user.id} onDone={handleUploadDone} onCancel={() => setShowUpload(false)} />
          ) : (
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <View style={styles.statusRow}>
                <Ionicons name={ui.icon} size={22} color={ui.color} />
                <Text style={[styles.statusText, { color: ui.color }]} testID="cert-admin-status">{ui.label}</Text>
                {info?.scadenza && status !== 'rifiutato' && <Text style={styles.detailText}>· scade il {formatDataIt(info.scadenza)}</Text>}
              </View>
              {status === 'rifiutato' && info?.motivo_rifiuto && (
                <Text style={[styles.detailText, { color: '#FF4D6D' }]}>Motivo rifiuto: {info.motivo_rifiuto}</Text>
              )}
              {info?.file_name && (
                <Text style={styles.detailText} numberOfLines={1}>
                  📎 {info.file_name}
                  {info.uploaded_at ? ` · caricato il ${info.uploaded_at}` : ''}
                  {info.uploaded_by ? ` (da ${info.uploaded_by === 'admin' ? 'te' : 'cliente'})` : ''}
                </Text>
              )}
              {feedback && <Text style={styles.feedbackText} testID="cert-admin-feedback">{feedback}</Text>}
              {error && <Text style={styles.errorText}>{error}</Text>}

              {/* CONVALIDA (solo se in verifica) */}
              {status === 'in_verifica' && (
                <View style={styles.convalidaBox} testID="cert-admin-convalida-box">
                  <Text style={styles.convalidaTitle}>DA CONVALIDARE</Text>
                  <Text style={styles.convalidaHint}>Apri il documento, controlla la data reale e conferma (o correggi) la scadenza.</Text>
                  <TouchableOpacity style={[styles.bigViewBtn]} onPress={handleView} testID="cert-admin-view">
                    {opening ? <ActivityIndicator color="#FFF" size="small" /> : (
                      <>
                        <Ionicons name="eye" size={18} color="#FFF" />
                        <Text style={styles.bigViewBtnText}>APRI DOCUMENTO</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.fieldLabel}>Scadenza verificata (GG/MM/AAAA)</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="GG/MM/AAAA"
                    placeholderTextColor={COLORS.textSecondary}
                    value={convalidaScadenza}
                    onChangeText={setConvalidaScadenza}
                    testID="cert-admin-convalida-scadenza"
                  />
                  {showRifiuta ? (
                    <>
                      <TextInput
                        style={styles.dateInput}
                        placeholder="Motivo del rifiuto (es. foto illeggibile)"
                        placeholderTextColor={COLORS.textSecondary}
                        value={motivoInput}
                        onChangeText={setMotivoInput}
                        testID="cert-admin-motivo-input"
                      />
                      <View style={styles.convalidaBtnRow}>
                        <TouchableOpacity style={[styles.convalidaBtn, { backgroundColor: '#FF4D6D' }]} onPress={() => handleConvalida(false)} disabled={busy} testID="cert-admin-rifiuta-conferma">
                          {busy ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.convalidaBtnText}>CONFERMA RIFIUTO</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.convalidaBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.textSecondary }]} onPress={() => setShowRifiuta(false)} disabled={busy}>
                          <Text style={[styles.convalidaBtnText, { color: COLORS.textSecondary }]}>Annulla</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <View style={styles.convalidaBtnRow}>
                      <TouchableOpacity style={[styles.convalidaBtn, { backgroundColor: '#2E7D32' }]} onPress={() => handleConvalida(true)} disabled={busy} testID="cert-admin-convalida">
                        {busy ? <ActivityIndicator color="#FFF" size="small" /> : (
                          <>
                            <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                            <Text style={styles.convalidaBtnText}>CONVALIDA</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.convalidaBtn, { backgroundColor: '#FF4D6D' }]} onPress={() => setShowRifiuta(true)} disabled={busy} testID="cert-admin-rifiuta">
                        <Ionicons name="close-circle" size={16} color="#FFF" />
                        <Text style={styles.convalidaBtnText}>RIFIUTA</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* STATO BLOCCO PRENOTAZIONI */}
              <View style={styles.blockBox} testID="cert-admin-blocco-box">
                <Text style={styles.blockTitle}>PRENOTAZIONI</Text>
                {blocco?.bloccato ? (
                  <Text style={[styles.blockText, { color: '#FF4D6D', fontWeight: '900' }]}>⛔ BLOCCATE dal {formatDataIt(blocco.blocco_dal)}</Text>
                ) : blocco?.motivo ? (
                  <Text style={[styles.blockText, { color: '#FFB300' }]}>⏳ Blocco dal {formatDataIt(blocco.blocco_dal)} ({blocco.giorni_rimanenti} giorni rimasti)</Text>
                ) : (
                  <Text style={[styles.blockText, { color: '#39FF14' }]}>✅ Nessun blocco</Text>
                )}
                {blocco?.deroga_fino && (
                  <Text style={styles.blockText}>🕐 Deroga attiva fino al {formatDataIt(blocco.deroga_fino)}</Text>
                )}
                {(blocco?.motivo || blocco?.deroga_fino) && (
                  <>
                    <Text style={styles.fieldLabel}>Concedi giorni extra (sblocca/proroga):</Text>
                    <View style={styles.derogaRow}>
                      {[7, 15, 30].map((g) => (
                        <TouchableOpacity key={g} style={styles.derogaBtn} onPress={() => handleDeroga(g)} disabled={busy} testID={`cert-admin-deroga-${g}`}>
                          <Text style={styles.derogaBtnText}>+{g}gg</Text>
                        </TouchableOpacity>
                      ))}
                      {blocco?.deroga_fino && (
                        <TouchableOpacity style={[styles.derogaBtn, { borderColor: '#FF4D6D' }]} onPress={() => handleDeroga(null)} disabled={busy} testID="cert-admin-deroga-remove">
                          <Text style={[styles.derogaBtnText, { color: '#FF4D6D' }]}>Rimuovi</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </View>

              {editScadenza && (
                <View style={styles.editRow}>
                  <TextInput
                    style={[styles.dateInput, { flex: 1, marginBottom: 0 }]}
                    placeholder="GG/MM/AAAA (vuoto = nessuna)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={scadenzaInput}
                    onChangeText={setScadenzaInput}
                    testID="cert-admin-scadenza-input"
                  />
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveScadenza} testID="cert-admin-scadenza-save">
                    <Text style={styles.saveBtnText}>Salva</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.actionsWrap}>
                {status !== 'mancante' && status !== 'in_verifica' && (
                  <TouchableOpacity style={styles.actionBtn} onPress={handleView} testID="cert-admin-view-2">
                    {opening ? (
                      <ActivityIndicator color={COLORS.primary} size="small" />
                    ) : (
                      <>
                        <Ionicons name="eye" size={16} color={COLORS.primary} />
                        <Text style={styles.actionText}>Visualizza</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#FFB300' }]}
                  onPress={() => setShowUpload(true)}
                  testID="cert-admin-upload"
                >
                  <Ionicons name="cloud-upload" size={16} color="#FFB300" />
                  <Text style={[styles.actionText, { color: '#FFB300' }]}>{status === 'mancante' ? 'Carica' : 'Sostituisci'}</Text>
                </TouchableOpacity>
                {status !== 'mancante' && status !== 'in_verifica' && (
                  <>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => {
                        setScadenzaInput(info?.scadenza ? formatDataIt(info.scadenza) : '');
                        setEditScadenza(!editScadenza);
                      }}
                      testID="cert-admin-edit-scadenza"
                    >
                      <Ionicons name="calendar" size={16} color={COLORS.primary} />
                      <Text style={styles.actionText}>Scadenza</Text>
                    </TouchableOpacity>
                  </>
                )}
                {status !== 'mancante' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: '#FF4D6D' }]}
                    onPress={handleDelete}
                    testID="cert-admin-delete"
                  >
                    <Ionicons name="trash" size={16} color="#FF4D6D" />
                    <Text style={[styles.actionText, { color: '#FF4D6D' }]}>Elimina</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 480,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
  },
  userName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  detailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  feedbackText: {
    color: '#39FF14',
    fontSize: 12,
    fontWeight: '700',
    marginVertical: 6,
  },
  errorText: {
    color: '#FF4D6D',
    fontSize: 12,
    marginVertical: 6,
  },
  convalidaBox: {
    borderWidth: 1.5,
    borderColor: '#00C8FF',
    backgroundColor: 'rgba(0,200,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  convalidaTitle: {
    color: '#00C8FF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  convalidaHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  bigViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 12,
    marginBottom: 14,
  },
  bigViewBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  convalidaBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  convalidaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 12,
  },
  convalidaBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  blockBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  blockTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  blockText: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 4,
  },
  derogaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  derogaBtn: {
    borderWidth: 1,
    borderColor: '#FFB300',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  derogaBtnText: {
    color: '#FFB300',
    fontWeight: '900',
    fontSize: 12,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 10,
    color: COLORS.text,
    fontSize: 13,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 6,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  actionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
});
