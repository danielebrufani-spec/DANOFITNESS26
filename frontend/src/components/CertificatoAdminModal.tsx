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
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!user) return;
    setInfo(null);
    setShowUpload(false);
    setEditScadenza(false);
    setError(null);
    setChanged(false);
    setLoading(true);
    apiService
      .adminGetCertificato(user.id)
      .then((res) => setInfo(res.data))
      .catch(() => setError('Errore nel caricamento'))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const status = info?.status || 'mancante';
  const ui = CERT_STATUS_UI[status];

  const handleUploadDone = (res: any) => {
    setShowUpload(false);
    setInfo(res.certificato);
    setChanged(true);
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
      setInfo(res.data);
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
      setInfo({ status: 'mancante' } as CertificatoInfo);
      setChanged(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Errore nell'eliminazione");
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
            <>
              <View style={styles.statusRow}>
                <Ionicons name={ui.icon} size={22} color={ui.color} />
                <Text style={[styles.statusText, { color: ui.color }]} testID="cert-admin-status">{ui.label}</Text>
                {info?.scadenza && <Text style={styles.detailText}>· scade il {formatDataIt(info.scadenza)}</Text>}
              </View>
              {info?.file_name && (
                <Text style={styles.detailText} numberOfLines={1}>
                  📎 {info.file_name}
                  {info.uploaded_at ? ` · caricato il ${info.uploaded_at}` : ''}
                  {info.uploaded_by ? ` (da ${info.uploaded_by === 'admin' ? 'te' : 'cliente'})` : ''}
                </Text>
              )}
              {error && <Text style={styles.errorText}>{error}</Text>}

              {editScadenza ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.dateInput}
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
              ) : null}

              <View style={styles.actionsWrap}>
                {status !== 'mancante' && (
                  <TouchableOpacity style={styles.actionBtn} onPress={handleView} testID="cert-admin-view">
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
                {status !== 'mancante' && (
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
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: '#FF4D6D' }]}
                      onPress={handleDelete}
                      testID="cert-admin-delete"
                    >
                      <Ionicons name="trash" size={16} color="#FF4D6D" />
                      <Text style={[styles.actionText, { color: '#FF4D6D' }]}>Elimina</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
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
    maxWidth: 460,
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
    marginBottom: 16,
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
  errorText: {
    color: '#FF4D6D',
    fontSize: 12,
    marginVertical: 6,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 10,
    color: COLORS.text,
    fontSize: 13,
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
