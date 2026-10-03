import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';
import { apiService } from '../services/api';

type CertRow = {
  user_id: string;
  nome: string;
  cognome: string;
  file_name?: string | null;
  scadenza?: string | null;
  stato_convalida: string;
  uploaded_at?: string | null;
  giorni_alla_scadenza?: number | null;
  file_eliminato?: boolean;
};

const fmtData = (iso?: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

export const ArchivioCertificati: React.FC = () => {
  const [attivi, setAttivi] = useState<CertRow[]>([]);
  const [scaduti, setScaduti] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiService.adminArchivioCertificati()
      .then((res) => {
        setAttivi(res.data.attivi);
        setScaduti(res.data.scaduti_recenti);
      })
      .catch(() => setError('Errore nel caricamento, riprova'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? attivi.filter((c) => c.nome.toLowerCase().includes(q) || c.cognome.toLowerCase().includes(q))
    : attivi;

  const getBlobUrl = async (c: CertRow) => {
    const res = await apiService.adminGetCertificatoBlob(c.user_id);
    return URL.createObjectURL(res.data as Blob);
  };

  const apri = async (c: CertRow) => {
    if (Platform.OS !== 'web' || busyId) return;
    setBusyId(c.user_id);
    setError(null);
    try {
      window.open(await getBlobUrl(c), '_blank');
    } catch {
      setError(`File di ${c.nome} ${c.cognome} non recuperabile al momento`);
    }
    setBusyId(null);
  };

  const scarica = async (c: CertRow) => {
    if (Platform.OS !== 'web' || busyId) return;
    setBusyId(c.user_id);
    setError(null);
    try {
      const url = await getBlobUrl(c);
      const ext = c.file_name && c.file_name.includes('.') ? c.file_name.slice(c.file_name.lastIndexOf('.')) : '';
      const a = document.createElement('a');
      a.href = url;
      a.download = `Certificato_${c.nome}_${c.cognome}${ext}`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setError(`File di ${c.nome} ${c.cognome} non recuperabile al momento`);
    }
    setBusyId(null);
  };

  const badge = (c: CertRow) => {
    if (c.stato_convalida === 'in_verifica') return { label: 'IN VERIFICA', color: '#00C8FF' };
    if (c.giorni_alla_scadenza == null) return { label: 'SENZA SCADENZA', color: COLORS.textMuted };
    if (c.giorni_alla_scadenza <= 30) return { label: `SCADE TRA ${c.giorni_alla_scadenza}G`, color: '#FF9800' };
    return { label: `VALIDO · ${fmtData(c.scadenza)}`, color: '#39FF14' };
  };

  return (
    <View style={styles.wrap} testID="archivio-certificati">
      <Text style={styles.title}>📄 ARCHIVIO CERTIFICATI</Text>
      <Text style={styles.subtitle}>
        Tutti i certificati medici dei clienti: aprili, scaricali e stampali quando vuoi.
        Quelli scaduti vengono rimossi automaticamente e ricevi un avviso.
      </Text>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca per nome o cognome..."
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          testID="cert-archivio-search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} testID="cert-archivio-search-clear">
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.errorText} testID="cert-archivio-error">{error}</Text>}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />
      ) : (
        <>
          <Text style={styles.countText} testID="cert-archivio-count">
            {filtered.length} certificat{filtered.length === 1 ? 'o' : 'i'}{q ? ` per "${query.trim()}"` : ' in archivio'}
          </Text>

          {filtered.length === 0 && (
            <Text style={styles.emptyText}>Nessun certificato trovato</Text>
          )}

          {filtered.map((c) => {
            const b = badge(c);
            return (
              <View key={c.user_id} style={styles.row} testID={`cert-archivio-row-${c.user_id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{c.cognome} {c.nome}</Text>
                  <View style={[styles.badge, { borderColor: b.color }]}>
                    <Text style={[styles.badgeText, { color: b.color }]}>{b.label}</Text>
                  </View>
                  {c.uploaded_at && <Text style={styles.rowMeta}>caricato il {c.uploaded_at}</Text>}
                </View>
                {busyId === c.user_id ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => apri(c)} testID={`cert-archivio-apri-${c.user_id}`}>
                      <Ionicons name="eye" size={19} color="#00C8FF" />
                      <Text style={[styles.actionText, { color: '#00C8FF' }]}>Apri</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: 'rgba(57,255,20,0.4)' }]} onPress={() => scarica(c)} testID={`cert-archivio-scarica-${c.user_id}`}>
                      <Ionicons name="download" size={19} color="#39FF14" />
                      <Text style={[styles.actionText, { color: '#39FF14' }]}>Scarica</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {scaduti.length > 0 && (
            <View style={styles.scadutiBox} testID="cert-archivio-scaduti">
              <Text style={styles.scadutiTitle}>⚠️ SCADUTI — RIMOSSI AUTOMATICAMENTE</Text>
              {scaduti.map((c) => (
                <View key={c.user_id} style={styles.scadutoRow}>
                  <Ionicons name="trash-outline" size={15} color="#FF4D6D" />
                  <Text style={styles.scadutoText}>
                    {c.cognome} {c.nome} — scaduto il {fmtData(c.scadenza)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 30,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 26,
    color: '#fff',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A4D',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    padding: 0,
  },
  countText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginVertical: 20,
  },
  errorText: {
    color: '#FF4D6D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginBottom: 8,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  rowMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,200,255,0.4)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scadutiBox: {
    backgroundColor: 'rgba(255,77,109,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.35)',
    padding: 14,
    marginTop: 16,
  },
  scadutiTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FF4D6D',
    letterSpacing: 1,
    marginBottom: 8,
  },
  scadutoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  scadutoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
