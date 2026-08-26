import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { COLORS } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import { apiService, CertificatoInfo } from '../services/api';
import { ConfettiBurst } from './ConfettiBurst';

export const CERT_STATUS_UI: { [key: string]: { label: string; color: string; icon: any } } = {
  mancante: { label: 'NON CARICATO', color: '#FF9800', icon: 'alert-circle' },
  scaduto: { label: 'SCADUTO', color: '#FF4D6D', icon: 'close-circle' },
  in_scadenza: { label: 'IN SCADENZA', color: '#FFB300', icon: 'time' },
  valido: { label: 'VALIDO', color: '#39FF14', icon: 'checkmark-circle' },
};

export function formatDataIt(iso?: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function parseDataIt(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isNaN(new Date(iso).getTime()) ? null : iso;
}

async function fileToBase64(file: File): Promise<{ base64: string; contentType: string }> {
  if (file.type === 'application/pdf') {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    return { base64: dataUrl.split(',')[1], contentType: 'application/pdf' };
  }
  // Immagini: compressione via canvas (max 1600px, JPEG 82%)
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new (window as any).Image();
      img.onload = () => {
        let { width, height } = img;
        const MAX = 1600;
        if (width > MAX || height > MAX) {
          const scale = Math.min(MAX / width, MAX / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas non disponibile'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { base64: dataUrl.split(',')[1], contentType: 'image/jpeg' };
}

export async function uploadCertificato(
  file: File,
  scadenza: string | null,
  targetUserId: string | null,
  onProgress: (pct: number) => void
): Promise<any> {
  const { base64, contentType } = await fileToBase64(file);
  const CHUNK = 700000;
  const total = Math.max(1, Math.ceil(base64.length / CHUNK));
  onProgress(5);
  const startRes = await apiService.certUploadStart({
    file_name: file.name,
    content_type: contentType,
    total_chunks: total,
    scadenza,
    target_user_id: targetUserId,
  });
  const uploadId = startRes.data.upload_id;
  for (let i = 0; i < total; i++) {
    await apiService.certUploadChunk({ upload_id: uploadId, index: i, data: base64.slice(i * CHUNK, (i + 1) * CHUNK) });
    onProgress(5 + Math.round(((i + 1) / total) * 85));
  }
  const finishRes = await apiService.certUploadFinish({ upload_id: uploadId });
  onProgress(100);
  return finishRes.data;
}

export async function openCertificatoBlob(userId?: string) {
  if (Platform.OS !== 'web') return;
  const res = userId ? await apiService.adminGetCertificatoBlob(userId) : await apiService.getMioCertificatoBlob();
  const url = URL.createObjectURL(res.data as Blob);
  window.open(url, '_blank');
}

// ---------- Form di caricamento (riusato da profilo cliente e modale admin) ----------
export const CertUploadForm: React.FC<{
  targetUserId?: string | null;
  onDone: (res: any) => void;
  onCancel: () => void;
}> = ({ targetUserId, onDone, onCancel }) => {
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [scadenzaInput, setScadenzaInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pickFile = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/jpeg,image/png,image/webp';
    input.onchange = (e: any) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) {
        setError('File troppo grande (max 10 MB)');
        return;
      }
      setError(null);
      setPickedFile(f);
    };
    input.click();
  };

  const handleUpload = async () => {
    if (!pickedFile || uploading) return;
    let scadIso: string | null = null;
    if (scadenzaInput.trim()) {
      scadIso = parseDataIt(scadenzaInput);
      if (!scadIso) {
        setError('Data non valida: usa il formato GG/MM/AAAA');
        return;
      }
    }
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const res = await uploadCertificato(pickedFile, scadIso, targetUserId || null, setProgress);
      onDone(res);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore durante il caricamento, riprova');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.pickBtn} onPress={pickFile} disabled={uploading} testID="cert-pick-file">
        <Ionicons name={pickedFile ? 'document-attach' : 'cloud-upload-outline'} size={22} color={COLORS.primary} />
        <Text style={styles.pickBtnText} numberOfLines={1}>
          {pickedFile ? pickedFile.name : 'Scegli file (PDF o foto)'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.fieldLabel}>Scadenza certificato (opzionale)</Text>
      <TextInput
        style={styles.dateInput}
        placeholder="GG/MM/AAAA"
        placeholderTextColor={COLORS.textSecondary}
        value={scadenzaInput}
        onChangeText={setScadenzaInput}
        editable={!uploading}
        testID="cert-scadenza-input"
      />
      {error && (
        <Text style={styles.errorText} testID="cert-upload-error">{error}</Text>
      )}
      {uploading && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.submitBtn, (!pickedFile || uploading) && { opacity: 0.5 }]}
        onPress={handleUpload}
        disabled={!pickedFile || uploading}
        testID="cert-submit-upload"
      >
        {uploading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.submitBtnText}>CARICA CERTIFICATO</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={uploading} testID="cert-cancel-upload">
        <Text style={styles.cancelBtnText}>Annulla</Text>
      </TouchableOpacity>
    </View>
  );
};

// ---------- Card nel profilo cliente ----------
export const CertificatoCard: React.FC = () => {
  const [info, setInfo] = useState<CertificatoInfo | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [bonusVinto, setBonusVinto] = useState(0);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiService.getMioCertificato();
      setInfo(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDone = (res: any) => {
    setShowUpload(false);
    setInfo((prev) => ({ ...(res.certificato || {}), bonus_gia_dato: true, bonus_biglietti: prev?.bonus_biglietti }));
    if (res.bonus_biglietti > 0) {
      setBonusVinto(res.bonus_biglietti);
      setConfetti((c) => c + 1);
    }
  };

  const handleView = async () => {
    if (opening) return;
    setOpening(true);
    try {
      await openCertificatoBlob();
    } catch {}
    setOpening(false);
  };

  const status = info?.status || 'mancante';
  const ui = CERT_STATUS_UI[status];

  return (
    <View style={styles.section} testID="cert-card">
      <Text style={styles.sectionTitle}>Certificato Medico</Text>
      <View style={[styles.card, { borderLeftColor: ui.color }]}>
        <View style={styles.statusRow}>
          <Ionicons name={ui.icon} size={22} color={ui.color} />
          <Text style={[styles.statusText, { color: ui.color }]} testID="cert-status-badge">{ui.label}</Text>
          {info?.scadenza && (
            <Text style={styles.scadenzaText}>· scade il {formatDataIt(info.scadenza)}</Text>
          )}
        </View>
        {status === 'in_scadenza' && info?.giorni_alla_scadenza != null && (
          <Text style={styles.hintWarn}>⏰ Mancano {info.giorni_alla_scadenza} giorni: ricordati di rinnovarlo!</Text>
        )}
        {status === 'scaduto' && (
          <Text style={styles.hintError}>Il certificato è scaduto: carica quello nuovo appena lo hai.</Text>
        )}
        {info?.file_name && (
          <Text style={styles.fileName} numberOfLines={1}>📎 {info.file_name}{info.uploaded_at ? ` · ${info.uploaded_at}` : ''}</Text>
        )}
        {status === 'mancante' && !info?.bonus_gia_dato && (
          <View style={styles.bonusBanner} testID="cert-bonus-banner">
            <Ionicons name="ticket" size={16} color="#FFEA00" />
            <Text style={styles.bonusBannerText}>+{info?.bonus_biglietti ?? 2} biglietti lotteria alla prima consegna!</Text>
          </View>
        )}
        {bonusVinto > 0 && (
          <View style={[styles.bonusBanner, { backgroundColor: 'rgba(57,255,20,0.12)' }]} testID="cert-bonus-won">
            <Ionicons name="trophy" size={16} color="#39FF14" />
            <Text style={[styles.bonusBannerText, { color: '#39FF14' }]}>GRANDE! Hai vinto +{bonusVinto} biglietti lotteria 🎉</Text>
          </View>
        )}
        <View style={styles.btnRow}>
          {status !== 'mancante' && (
            <TouchableOpacity style={styles.viewBtn} onPress={handleView} testID="cert-view-btn">
              {opening ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="eye" size={16} color={COLORS.primary} />
                  <Text style={styles.viewBtnText}>Visualizza</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.uploadBtn} onPress={() => setShowUpload(true)} testID="cert-upload-btn">
            <Ionicons name="cloud-upload" size={16} color="#FFF" />
            <Text style={styles.uploadBtnText}>{status === 'mancante' ? 'CARICA' : 'SOSTITUISCI'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showUpload} transparent animationType="fade" onRequestClose={() => setShowUpload(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} testID="cert-upload-modal">
            <Text style={styles.modalTitle}>CERTIFICATO MEDICO</Text>
            <Text style={styles.modalSubtitle}>Carica il tuo certificato (PDF o foto). Resterà archiviato e sempre disponibile.</Text>
            <CertUploadForm onDone={handleDone} onCancel={() => setShowUpload(false)} />
          </View>
        </View>
      </Modal>
      <ConfettiBurst trigger={confetti} />
    </View>
  );
};

// ---------- Banner promemoria in Home (solo clienti senza certificato valido) ----------
export const CertificatoBanner: React.FC = () => {
  const { isAdmin, isIstruttore } = useAuth();
  const [info, setInfo] = useState<CertificatoInfo | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isAdmin || isIstruttore) return;
    apiService.getMioCertificato().then((res) => setInfo(res.data)).catch(() => {});
  }, [isAdmin, isIstruttore]);

  if (isAdmin || isIstruttore || !info || info.status === 'valido') return null;

  const cfg =
    info.status === 'scaduto'
      ? { color: '#FF4D6D', title: 'CERTIFICATO MEDICO SCADUTO', msg: 'Carica quello nuovo dal tuo profilo per continuare ad allenarti tranquillo.' }
      : info.status === 'in_scadenza'
      ? { color: '#FFB300', title: 'CERTIFICATO IN SCADENZA', msg: `Scade il ${formatDataIt(info.scadenza)} — ricordati di rinnovarlo!` }
      : { color: '#FF9800', title: 'CERTIFICATO MEDICO MANCANTE', msg: `Caricalo dal tuo profilo: +${info.bonus_biglietti ?? 2} biglietti lotteria per te! 🎟️` };

  return (
    <TouchableOpacity
      style={[styles.banner, { borderColor: cfg.color }]}
      onPress={() => router.push('/profilo')}
      activeOpacity={0.85}
      testID="certificato-banner"
    >
      <Ionicons name="medkit" size={24} color={cfg.color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerTitle, { color: cfg.color }]}>{cfg.title}</Text>
        <Text style={styles.bannerMsg}>{cfg.msg}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={cfg.color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  scadenzaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  hintWarn: {
    marginTop: 8,
    fontSize: 12,
    color: '#FFB300',
  },
  hintError: {
    marginTop: 8,
    fontSize: 12,
    color: '#FF4D6D',
  },
  fileName: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  bonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,234,0,0.10)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  bonusBannerText: {
    color: '#FFEA00',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  viewBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  uploadBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  // Form
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  pickBtnText: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 12,
  },
  errorText: {
    color: '#FF4D6D',
    fontSize: 12,
    marginBottom: 10,
  },
  progressWrap: {
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 12,
    justifyContent: 'center',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
    borderRadius: 11,
  },
  progressText: {
    textAlign: 'center',
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  // Banner home
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bannerMsg: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
