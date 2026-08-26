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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import { apiService, CertificatoInfo } from '../services/api';

export const CERT_STATUS_UI: { [key: string]: { label: string; color: string; icon: any } } = {
  mancante: { label: 'NON CARICATO', color: '#FF9800', icon: 'alert-circle' },
  in_verifica: { label: 'IN VERIFICA', color: '#00C8FF', icon: 'hourglass' },
  rifiutato: { label: 'RIFIUTATO', color: '#FF4D6D', icon: 'close-circle' },
  scaduto: { label: 'SCADUTO', color: '#FF4D6D', icon: 'close-circle' },
  in_scadenza: { label: 'IN SCADENZA', color: '#FFB300', icon: 'time' },
  valido: { label: 'VALIDO', color: '#39FF14', icon: 'checkmark-circle' },
};

const OBBLIGO_DEFAULT = '2026-09-07';

export function todayRome(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
}

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

export type CertPopupVariant = 'bloccato' | 'countdown' | 'preObbligo';

export function getPopupVariant(info: CertificatoInfo, oggi: string): CertPopupVariant | null {
  if (!['mancante', 'rifiutato', 'scaduto'].includes(info.status)) return null;
  const blocco = info.blocco;
  if (blocco?.bloccato) return 'bloccato';
  if (blocco?.motivo && info.status !== 'mancante') return 'countdown';
  if (oggi < (info.obbligo_dal || OBBLIGO_DEFAULT)) return 'preObbligo';
  if (blocco?.motivo) return 'countdown';
  return null;
}

async function fileToBase64(file: File): Promise<{ base64: string; contentType: string; previewUrl: string | null }> {
  if (file.type === 'application/pdf') {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    return { base64: dataUrl.split(',')[1], contentType: 'application/pdf', previewUrl: null };
  }
  // Immagini: compressione ALTA QUALITÀ per leggibilità (max 2000px, JPEG 85%)
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new (window as any).Image();
      img.onload = () => {
        let { width, height } = img;
        const MAX = 2000;
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
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { base64: dataUrl.split(',')[1], contentType: 'image/jpeg', previewUrl: dataUrl };
}

export async function uploadCertificato(
  base64: string,
  contentType: string,
  fileName: string,
  scadenza: string | null,
  targetUserId: string | null,
  onProgress: (pct: number) => void
): Promise<any> {
  const CHUNK = 700000;
  const total = Math.max(1, Math.ceil(base64.length / CHUNK));
  onProgress(5);
  const startRes = await apiService.certUploadStart({
    file_name: fileName,
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
  const [picked, setPicked] = useState<{ base64: string; contentType: string; fileName: string; previewUrl: string | null } | null>(null);
  const [scadenzaInput, setScadenzaInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pickFile = (camera: boolean) => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = camera ? 'image/*' : 'application/pdf,image/jpeg,image/png,image/webp';
    if (camera) input.setAttribute('capture', 'environment');
    input.onchange = async (e: any) => {
      const f: File | undefined = e.target.files?.[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) {
        setError('File troppo grande (max 10 MB)');
        return;
      }
      setError(null);
      setProcessing(true);
      try {
        const { base64, contentType, previewUrl } = await fileToBase64(f);
        setPicked({ base64, contentType, fileName: f.name || 'certificato.jpg', previewUrl });
      } catch {
        setError('Impossibile leggere il file, riprova');
      } finally {
        setProcessing(false);
      }
    };
    input.click();
  };

  const handleUpload = async () => {
    if (!picked || uploading) return;
    if (!scadenzaInput.trim()) {
      setError('Inserisci la data di scadenza indicata sul certificato (GG/MM/AAAA)');
      return;
    }
    const scadIso = parseDataIt(scadenzaInput);
    if (!scadIso) {
      setError('Data non valida: usa il formato GG/MM/AAAA');
      return;
    }
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const res = await uploadCertificato(picked.base64, picked.contentType, picked.fileName, scadIso, targetUserId || null, setProgress);
      onDone(res);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore durante il caricamento, riprova');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      <View style={styles.pickRow}>
        <TouchableOpacity style={styles.pickBtn} onPress={() => pickFile(false)} disabled={uploading || processing} testID="cert-pick-file">
          <Ionicons name="document-attach-outline" size={20} color={COLORS.primary} />
          <Text style={styles.pickBtnText}>SCEGLI FILE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickBtn, { borderColor: '#FF1493' }]} onPress={() => pickFile(true)} disabled={uploading || processing} testID="cert-camera-btn">
          <Ionicons name="camera" size={20} color="#FF1493" />
          <Text style={[styles.pickBtnText, { color: '#FF1493' }]}>SCATTA FOTO</Text>
        </TouchableOpacity>
      </View>

      {processing && <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 12 }} />}

      {picked && (
        <View style={styles.previewBox}>
          {picked.previewUrl ? (
            <>
              <Image source={{ uri: picked.previewUrl }} style={styles.previewImg} resizeMode="contain" testID="cert-preview-img" />
              <View style={styles.previewHintRow}>
                <Ionicons name="eye" size={14} color="#FFEA00" />
                <Text style={styles.previewHint}>Controlla che sia ben leggibile prima di inviare!</Text>
              </View>
            </>
          ) : (
            <View style={styles.previewHintRow}>
              <Ionicons name="document-text" size={16} color={COLORS.primary} />
              <Text style={[styles.previewHint, { color: COLORS.text }]} numberOfLines={1}>{picked.fileName}</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.fieldLabel}>Scadenza indicata sul certificato *</Text>
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
        style={[styles.submitBtn, (!picked || !scadenzaInput.trim() || uploading) && { opacity: 0.5 }]}
        onPress={handleUpload}
        disabled={!picked || !scadenzaInput.trim() || uploading}
        testID="cert-submit-upload"
      >
        {uploading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.submitBtnText}>INVIA CERTIFICATO</Text>
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

  const handleDone = () => {
    setShowUpload(false);
    load();
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
  const blocco = info?.blocco;
  const preObbligo = todayRome() < (info?.obbligo_dal || OBBLIGO_DEFAULT);

  return (
    <View style={styles.section} testID="cert-card">
      <Text style={styles.sectionTitle}>Certificato Medico</Text>
      <View style={[styles.card, { borderLeftColor: ui.color }]}>
        <View style={styles.statusRow}>
          <Ionicons name={ui.icon} size={22} color={ui.color} />
          <Text style={[styles.statusText, { color: ui.color }]} testID="cert-status-badge">{ui.label}</Text>
          {info?.scadenza && status !== 'rifiutato' && (
            <Text style={styles.scadenzaText}>· scade il {formatDataIt(info.scadenza)}</Text>
          )}
        </View>
        {status === 'in_verifica' && (
          <Text style={styles.hintInfo}>⏳ In attesa della convalida di Daniele. Nel frattempo puoi prenotare normalmente!</Text>
        )}
        {status === 'rifiutato' && (
          <Text style={styles.hintError} testID="cert-motivo-rifiuto">Rifiutato da Daniele: {info?.motivo_rifiuto || 'documento non valido'}. Carica un nuovo documento.</Text>
        )}
        {status === 'in_scadenza' && info?.giorni_alla_scadenza != null && (
          <Text style={styles.hintWarn}>⏰ Mancano {info.giorni_alla_scadenza} giorni alla scadenza: ricordati di rinnovarlo!</Text>
        )}
        {status === 'scaduto' && (
          <Text style={styles.hintError}>Il certificato è scaduto: carica quello nuovo appena lo hai.</Text>
        )}
        {status === 'mancante' && preObbligo && (
          <Text style={styles.hintWarn}>📋 Dal 7 settembre il certificato medico è obbligatorio per la nuova stagione.</Text>
        )}
        {blocco?.bloccato && (
          <View style={styles.blockBanner} testID="cert-block-banner">
            <Ionicons name="lock-closed" size={16} color="#FF4D6D" />
            <Text style={styles.blockBannerText}>PRENOTAZIONI BLOCCATE — carica il certificato per sbloccarle</Text>
          </View>
        )}
        {!blocco?.bloccato && blocco?.motivo && (
          <Text style={styles.hintWarn} testID="cert-countdown-hint">⏳ Hai tempo fino al {formatDataIt(blocco.blocco_dal)} ({blocco.giorni_rimanenti} giorni), poi le prenotazioni si bloccano.</Text>
        )}
        {info?.file_name && (
          <Text style={styles.fileName} numberOfLines={1}>📎 {info.file_name}{info.uploaded_at ? ` · ${info.uploaded_at}` : ''}</Text>
        )}
        {(status === 'mancante' || status === 'rifiutato') && !info?.bonus_gia_dato && (
          <View style={styles.bonusBanner} testID="cert-bonus-banner">
            <Ionicons name="ticket" size={16} color="#FFEA00" />
            <Text style={styles.bonusBannerText}>+{info?.bonus_biglietti ?? 2} biglietti lotteria quando Daniele convalida il tuo primo certificato!</Text>
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
            <Text style={styles.uploadBtnText}>{status === 'mancante' ? 'CARICA' : status === 'rifiutato' ? 'RICARICA' : 'SOSTITUISCI'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showUpload} transparent animationType="fade" onRequestClose={() => setShowUpload(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} testID="cert-upload-modal">
            <Text style={styles.modalTitle}>CERTIFICATO MEDICO</Text>
            <Text style={styles.modalSubtitle}>Carica il certificato (PDF o foto, anche con la fotocamera). Daniele lo verificherà e convaliderà.</Text>
            <CertUploadForm onDone={handleDone} onCancel={() => setShowUpload(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ---------- Banner promemoria in Home ----------
export const CertificatoBanner: React.FC = () => {
  const { isAdmin, isIstruttore } = useAuth();
  const [info, setInfo] = useState<CertificatoInfo | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isAdmin || isIstruttore) return;
    apiService.getMioCertificato().then((res) => setInfo(res.data)).catch(() => {});
  }, [isAdmin, isIstruttore]);

  if (isAdmin || isIstruttore || !info) return null;
  if (info.status === 'valido' || info.status === 'in_verifica') return null;

  const preObbligo = todayRome() < (info.obbligo_dal || OBBLIGO_DEFAULT);
  const blocco = info.blocco;
  let cfg;
  if (blocco?.bloccato) {
    cfg = { color: '#FF4D6D', title: '⛔ PRENOTAZIONI BLOCCATE', msg: 'Carica il certificato medico dal profilo per sbloccarle, o contatta Daniele.' };
  } else if (info.status === 'rifiutato') {
    cfg = { color: '#FF4D6D', title: 'CERTIFICATO RIFIUTATO', msg: `${info.motivo_rifiuto || 'Documento non valido'} — tocca per ricaricarlo.` };
  } else if (info.status === 'scaduto') {
    cfg = { color: '#FF4D6D', title: 'CERTIFICATO MEDICO SCADUTO', msg: blocco?.giorni_rimanenti != null ? `Hai ${blocco.giorni_rimanenti} giorni per rinnovarlo, poi le prenotazioni si bloccano.` : 'Carica quello nuovo dal tuo profilo.' };
  } else if (info.status === 'in_scadenza') {
    cfg = { color: '#FFB300', title: 'CERTIFICATO IN SCADENZA', msg: `Scade il ${formatDataIt(info.scadenza)} — ricordati di rinnovarlo!` };
  } else if (preObbligo) {
    cfg = { color: '#FF9800', title: 'CERTIFICATO MEDICO — DAL 7 SETTEMBRE', msg: `Obbligatorio per la nuova stagione: caricalo ora, +${info.bonus_biglietti ?? 2} biglietti alla convalida!` };
  } else {
    cfg = { color: '#FF9800', title: 'CERTIFICATO MEDICO MANCANTE', msg: blocco?.giorni_rimanenti != null ? `Hai ${blocco.giorni_rimanenti} giorni per caricarlo, poi le prenotazioni si bloccano.` : 'Caricalo dal tuo profilo.' };
  }

  return (
    <TouchableOpacity
      style={[styles.banner, { borderColor: cfg.color }]}
      onPress={() => router.push({ pathname: '/profilo', params: { cert: String(Date.now()) } })}
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

// ---------- Popup obbligo certificato (ogni apertura app) ----------
export const CertificatoObbligoPopup: React.FC = () => {
  const { isAdmin, isIstruttore, user, loading: authLoading } = useAuth();
  const [info, setInfo] = useState<CertificatoInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    if (isAdmin || isIstruttore || user.archived) return;
    apiService.getMioCertificato().then((res) => {
      const d = res.data;
      const oggi = todayRome();
      const variant = getPopupVariant(d, oggi);
      if (!variant) return;
      if (variant === 'preObbligo' && Platform.OS === 'web') {
        // Pre-stagione (non bloccato): messaggio informativo UNA volta al giorno
        try {
          if (window.localStorage.getItem('cert_info_popup_date') === oggi) return;
        } catch {}
      }
      setInfo(d);
      setVisible(true);
    }).catch(() => {});
  }, [authLoading, user, isAdmin, isIstruttore]);

  if (isAdmin || isIstruttore || !visible || !info) return null;

  const oggi = todayRome();
  const variant = getPopupVariant(info, oggi);
  if (!variant) return null;
  const blocco = info.blocco;
  const bloccato = variant === 'bloccato';

  const dismiss = () => {
    if (variant === 'preObbligo' && Platform.OS === 'web') {
      try { window.localStorage.setItem('cert_info_popup_date', oggi); } catch {}
    }
    setVisible(false);
  };

  const goCarica = () => {
    dismiss();
    router.push({ pathname: '/profilo', params: { cert: String(Date.now()) } });
  };

  const motivoText =
    info.status === 'scaduto'
      ? `Il tuo certificato è scaduto il ${formatDataIt(info.scadenza)}.`
      : info.status === 'rifiutato'
      ? `Il tuo certificato è stato rifiutato${info.motivo_rifiuto ? `: ${info.motivo_rifiuto}` : ''}.`
      : 'Non hai ancora caricato il certificato medico.';

  const accent = bloccato ? '#FF4D6D' : variant === 'preObbligo' ? '#00C8FF' : '#FF9800';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { borderColor: accent, borderWidth: 1.5 }]} testID="cert-obbligo-popup">
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name={bloccato ? 'lock-closed' : 'medkit'} size={40} color={accent} />
          </View>
          {bloccato ? (
            <>
              <Text style={[styles.popupTitle, { color: accent }]}>PRENOTAZIONI BLOCCATE</Text>
              <Text style={styles.popupText}>{motivoText}{'\n\n'}Per tornare a prenotare le lezioni carica il certificato medico dal tuo profilo, oppure contatta Daniele.</Text>
            </>
          ) : variant === 'preObbligo' ? (
            <>
              <Text style={[styles.popupTitle, { color: accent }]}>NUOVA STAGIONE DAL 7 SETTEMBRE</Text>
              <Text style={styles.popupText}>Per la stagione 2026/27 servirà il <Text style={styles.popupBold}>certificato medico</Text>.{'\n\n'}Preparati in anticipo: caricalo già ora dal tuo profilo (PDF o foto) — alla convalida ricevi <Text style={styles.popupBold}>+{info.bonus_biglietti ?? 2} biglietti lotteria</Text>! 🎟️</Text>
            </>
          ) : (
            <>
              <Text style={[styles.popupTitle, { color: accent }]}>CERTIFICATO MEDICO</Text>
              <Text style={styles.popupText}>{motivoText}</Text>
              <View style={styles.countdownBox} testID="cert-popup-countdown">
                <Text style={[styles.countdownNum, { color: accent }]}>{blocco?.giorni_rimanenti ?? '–'}</Text>
                <Text style={styles.countdownLabel}>{blocco?.giorni_rimanenti === 1 ? 'GIORNO RIMASTO' : 'GIORNI RIMASTI'}</Text>
              </View>
              <Text style={styles.popupText}>Al termine dei giorni rimasti le <Text style={styles.popupBold}>prenotazioni verranno bloccate</Text>{blocco?.blocco_dal ? ` (dal ${formatDataIt(blocco.blocco_dal)})` : ''}.{blocco?.deroga_fino ? `\n🕐 Daniele ti ha concesso tempo extra fino al ${formatDataIt(blocco.deroga_fino)}.` : ''}</Text>
            </>
          )}
          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: accent, marginTop: 16 }]} onPress={goCarica} testID="cert-popup-cta">
            <Text style={styles.submitBtnText}>CARICA ORA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={dismiss} testID="cert-popup-dismiss">
            <Text style={styles.cancelBtnText}>{bloccato ? 'Chiudi' : variant === 'preObbligo' ? 'OK, mi preparo!' : 'Ricordamelo dopo'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ---------- Popup ADMIN: certificati in attesa di convalida (ad ogni apertura) ----------
export const CertificatiDaConvalidarePopup: React.FC = () => {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const [pending, setPending] = useState<{ user_id: string; nome: string; cognome: string; uploaded_at: string | null }[]>([]);
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user || !isAdmin) return;
    apiService.adminGetCertificatiDaConvalidare().then((res) => {
      if (res.data.length > 0) {
        setPending(res.data);
        setVisible(true);
      }
    }).catch(() => {});
  }, [authLoading, user, isAdmin]);

  if (!isAdmin || !visible || pending.length === 0) return null;

  const goTo = (uid: string) => {
    setVisible(false);
    router.push({ pathname: '/admin', params: { cert_user: uid, t: String(Date.now()) } });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { borderColor: '#00C8FF', borderWidth: 1.5 }]} testID="cert-admin-pending-popup">
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="medkit" size={40} color="#00C8FF" />
          </View>
          <Text style={[styles.popupTitle, { color: '#00C8FF' }]}>CERTIFICATI DA CONVALIDARE</Text>
          <Text style={styles.popupText}>
            {pending.length === 1
              ? 'Un cliente ha caricato il certificato medico. Tocca il nome per aprirlo e convalidarlo:'
              : `${pending.length} clienti hanno caricato il certificato medico. Tocca un nome per aprirlo e convalidarlo:`}
          </Text>
          {pending.map((p) => (
            <TouchableOpacity key={p.user_id} style={styles.pendingRow} onPress={() => goTo(p.user_id)} activeOpacity={0.85} testID={`cert-pending-row-${p.user_id}`}>
              <Ionicons name="person-circle-outline" size={22} color="#00C8FF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingName}>{p.nome} {p.cognome}</Text>
                {p.uploaded_at && <Text style={styles.pendingDate}>caricato il {p.uploaded_at}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#00C8FF" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setVisible(false)} testID="cert-admin-pending-close">
            <Text style={styles.cancelBtnText}>Più tardi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,200,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,200,255,0.35)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  pendingName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  pendingDate: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
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
  hintInfo: {
    marginTop: 8,
    fontSize: 12,
    color: '#00C8FF',
  },
  blockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,77,109,0.12)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  blockBannerText: {
    color: '#FF4D6D',
    fontSize: 12,
    fontWeight: '900',
    flex: 1,
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
    backgroundColor: 'rgba(0,0,0,0.78)',
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
  // Popup obbligo
  popupTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 10,
  },
  popupText: {
    fontSize: 13,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 19,
  },
  popupBold: {
    fontWeight: '900',
    color: '#FFEA00',
  },
  countdownBox: {
    alignItems: 'center',
    marginVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  countdownNum: {
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 48,
  },
  countdownLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    fontWeight: '700',
  },
  // Form
  pickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  pickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: 12,
    padding: 13,
  },
  pickBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  previewBox: {
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
  },
  previewImg: {
    width: '100%',
    height: 190,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  previewHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  previewHint: {
    color: '#FFEA00',
    fontSize: 12,
    fontWeight: '700',
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
