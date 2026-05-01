import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/utils/constants';
import { FONTS } from '../../src/theme';
import { apiService } from '../../src/services/api';

type Argomento = 'amore' | 'sesso' | 'lavoro';

const ARGOMENTI: { key: Argomento; label: string; icon: any; color: string }[] = [
  { key: 'amore', label: 'AMORE', icon: 'heart', color: '#FF3D7F' },
  { key: 'sesso', label: 'SESSO', icon: 'flame', color: '#FF4500' },
  { key: 'lavoro', label: 'LAVORO', icon: 'briefcase', color: '#00B0FF' },
];

interface MaestroItem {
  id: string;
  argomento: Argomento;
  domanda: string;
  risposta: string;
  data?: string;
  created_at?: string;
}

function ArgChip({
  arg,
  selected,
  onPress,
}: {
  arg: typeof ARGOMENTI[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      testID={`maestro-arg-${arg.key}`}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? arg.color : 'transparent',
          borderColor: arg.color,
        },
      ]}
    >
      <Ionicons name={arg.icon} size={18} color={selected ? '#fff' : arg.color} />
      <Text style={[styles.chipText, { color: selected ? '#fff' : arg.color }]}>{arg.label}</Text>
    </TouchableOpacity>
  );
}

function ResponseCard({ item, fresh }: { item: MaestroItem; fresh?: boolean }) {
  const fade = useRef(new Animated.Value(fresh ? 0 : 1)).current;
  const translate = useRef(new Animated.Value(fresh ? 18 : 0)).current;
  useEffect(() => {
    if (fresh) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translate, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [fresh, fade, translate]);

  const arg = ARGOMENTI.find((a) => a.key === item.argomento) || ARGOMENTI[0];

  return (
    <Animated.View
      style={[
        styles.responseCard,
        { borderLeftColor: arg.color, opacity: fade, transform: [{ translateY: translate }] },
      ]}
    >
      <View style={styles.responseHeader}>
        <View style={[styles.argBadge, { backgroundColor: arg.color + '22', borderColor: arg.color }]}>
          <Ionicons name={arg.icon} size={12} color={arg.color} />
          <Text style={[styles.argBadgeText, { color: arg.color }]}>{arg.label}</Text>
        </View>
        {item.data ? <Text style={styles.dateText}>{item.data}</Text> : null}
      </View>
      <Text style={styles.qLabel}>TU HAI CHIESTO</Text>
      <Text style={styles.qText}>"{item.domanda}"</Text>
      <View style={styles.divider} />
      <Text style={styles.aLabel}>IL MAESTRO RISPONDE</Text>
      <Text style={styles.aText}>{item.risposta}</Text>
    </Animated.View>
  );
}

export default function MaestroScreen() {
  const [argomento, setArgomento] = useState<Argomento | null>(null);
  const [domanda, setDomanda] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [today, setToday] = useState<MaestroItem | null>(null);
  const [canAsk, setCanAsk] = useState(true);
  const [fresh, setFresh] = useState(false);
  const [history, setHistory] = useState<MaestroItem[]>([]);
  const [bonusGiven, setBonusGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [t, h] = await Promise.all([
        apiService.maestroToday(),
        apiService.maestroHistory(),
      ]);
      setCanAsk(t.data.can_ask);
      setToday(t.data.today);
      setHistory(h.data || []);
    } catch (e) {
      console.error('maestro load err', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!argomento) { setError('Scegli prima un argomento.'); return; }
    if (domanda.trim().length < 5) { setError('Scrivi almeno 5 caratteri.'); return; }
    if (domanda.length > 250) { setError('Massimo 250 caratteri.'); return; }
    setSubmitting(true);
    try {
      const res = await apiService.maestroAsk(argomento, domanda.trim());
      setToday(res.data.item);
      setCanAsk(false);
      setFresh(true);
      setBonusGiven(res.data.biglietto_dato);
      setDomanda('');
      // Aggiorna storia in background
      apiService.maestroHistory().then((h) => setHistory(h.data || [])).catch(() => {});
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore. Riprova.';
      setError(msg);
    } finally {
      setSubmitting(false);
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
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.kicker}>UNA DOMANDA AL GIORNO</Text>
          <Text style={styles.title}>CHIEDI AL{'\n'}MAESTRO</Text>
          <View style={styles.accentBar} />
          <Text style={styles.subtitle}>
            Amore, sesso, lavoro. 3 argomenti, niente cazzate. Una domanda al giorno, +1 biglietto in regalo. Sii breve, sarò sarcastico.
          </Text>
        </View>

        {/* Risposta di oggi (se già fatta) */}
        {!canAsk && today && (
          <>
            {fresh && bonusGiven && (
              <View style={styles.bonusBanner}>
                <Ionicons name="ticket" size={20} color="#000" />
                <Text style={styles.bonusText}>+1 BIGLIETTO LOTTERIA SBLOCCATO</Text>
              </View>
            )}
            <ResponseCard item={today} fresh={fresh} />
            <View style={styles.lockedBox}>
              <Ionicons name="time-outline" size={20} color={COLORS.textSecondary} />
              <Text style={styles.lockedText}>
                Hai già fatto la tua domanda di oggi. Torna domani per un'altra dose di Maestro.
              </Text>
            </View>
          </>
        )}

        {/* Form domanda */}
        {canAsk && (
          <View style={styles.formBox}>
            <Text style={styles.label}>1. SCEGLI L'ARGOMENTO</Text>
            <View style={styles.chipsRow}>
              {ARGOMENTI.map((a) => (
                <ArgChip
                  key={a.key}
                  arg={a}
                  selected={argomento === a.key}
                  onPress={() => setArgomento(a.key)}
                />
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 18 }]}>2. SCRIVI LA DOMANDA</Text>
            <TextInput
              testID="maestro-input"
              style={styles.input}
              value={domanda}
              onChangeText={setDomanda}
              multiline
              placeholder="Es: Mi piace una collega ma è fidanzata, che faccio?"
              placeholderTextColor={COLORS.textSecondary}
              maxLength={250}
            />
            <Text style={styles.counter}>{domanda.length}/250</Text>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              testID="maestro-submit"
              disabled={submitting}
              onPress={handleSubmit}
              activeOpacity={0.85}
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={styles.submitText}>CHIEDI AL MAESTRO</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>+1 biglietto lotteria gratis • Risposta in 2-5 secondi</Text>
          </View>
        )}

        {/* Storico */}
        {history.length > (canAsk ? 0 : 1) && (
          <View style={{ marginTop: 30 }}>
            <Text style={styles.sectionTitle}>ARCHIVIO RISPOSTE</Text>
            {history
              .filter((h) => !today || h.id !== today.id)
              .map((h) => (
                <ResponseCard key={h.id} item={h} />
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 18, paddingBottom: 120 },

  header: { marginBottom: 22 },
  kicker: { fontFamily: FONTS.bodyBlack, fontSize: 11, color: COLORS.primary, letterSpacing: 3 },
  title: { fontFamily: FONTS.headline, fontSize: 44, color: COLORS.text, letterSpacing: 1.5, lineHeight: 46, marginTop: 4 },
  accentBar: { width: 60, height: 4, backgroundColor: COLORS.primary, marginTop: 10, marginBottom: 12 },
  subtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  formBox: { backgroundColor: COLORS.surface || '#141416', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  label: { fontFamily: FONTS.bodyBlack, fontSize: 11, color: COLORS.textSecondary, letterSpacing: 1.4, marginBottom: 10 },

  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 2,
  },
  chipText: { fontFamily: FONTS.bodyBlack, fontSize: 12, letterSpacing: 1.2 },

  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 14,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  counter: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary, alignSelf: 'flex-end', marginTop: 4 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  errorText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.error, flex: 1 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 14,
  },
  submitText: { fontFamily: FONTS.bodyBlack, fontSize: 14, color: '#fff', letterSpacing: 1.4 },
  hint: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary, textAlign: 'center', marginTop: 10 },

  bonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  bonusText: { fontFamily: FONTS.bodyBlack, fontSize: 13, color: '#000', letterSpacing: 1.5 },

  responseCard: {
    backgroundColor: COLORS.surface || '#141416',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  responseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  argBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  argBadgeText: { fontFamily: FONTS.bodyBlack, fontSize: 10, letterSpacing: 1.2 },
  dateText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary },
  qLabel: { fontFamily: FONTS.bodyBlack, fontSize: 10, color: COLORS.textSecondary, letterSpacing: 1.4, marginBottom: 4 },
  qText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, fontStyle: 'italic', lineHeight: 20 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  aLabel: { fontFamily: FONTS.bodyBlack, fontSize: 10, color: COLORS.primary, letterSpacing: 1.4, marginBottom: 4 },
  aText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 21 },

  lockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface || '#141416',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  lockedText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, flex: 1 },

  sectionTitle: { fontFamily: FONTS.headline, fontSize: 22, color: COLORS.text, letterSpacing: 1.4, marginBottom: 12 },
});
