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
import { useAuth } from '../../src/context/AuthContext';

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

function AdminMaestroPanel({ onPublished }: { onPublished: () => void }) {
  const [pool, setPool] = useState<MaestroItem[]>([]);
  const [settimana, setSettimana] = useState<string>('');
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadPool = async (sett?: string) => {
    setLoading(true);
    try {
      const res = await apiService.adminMaestroWeekPool(sett);
      setPool(res.data.questions || []);
      setSettimana(res.data.settimana || '');
      setRange({ from: res.data.from, to: res.data.to });
      setSelected(new Set());
    } catch (e) {
      console.error('admin maestro pool err', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPool(); }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  };

  const publish = async () => {
    if (selected.size === 0) { setMsg('Seleziona da 1 a 3 domande'); return; }
    setPublishing(true);
    setMsg(null);
    try {
      await apiService.adminMaestroPublishTop({ settimana, question_ids: Array.from(selected) });
      setMsg(`✓ Pubblicate ${selected.size} risposte per la ${settimana}`);
      onPublished();
    } catch (e: any) {
      setMsg('Errore: ' + (e?.response?.data?.detail || 'pubblicazione fallita'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={styles.adminBox} testID="admin-maestro-panel">
      <View style={styles.adminHeader}>
        <Ionicons name="settings" size={18} color="#FFD700" />
        <Text style={styles.adminTitle}>PANNELLO ADMIN — TOP SETTIMANALE</Text>
      </View>
      <Text style={styles.adminSub}>
        Settimana <Text style={styles.adminBold}>{settimana || '—'}</Text> ({range.from} → {range.to}). Seleziona da 1 a 3 domande da pubblicare in forma <Text style={styles.adminBold}>anonima</Text>.
      </Text>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 14 }} />
      ) : pool.length === 0 ? (
        <Text style={styles.adminEmpty}>Nessuna domanda in questa settimana.</Text>
      ) : (
        pool.map((q) => {
          const arg = ARGOMENTI.find((a) => a.key === q.argomento) || ARGOMENTI[0];
          const isSel = selected.has(q.id);
          return (
            <TouchableOpacity
              key={q.id}
              activeOpacity={0.85}
              onPress={() => toggle(q.id)}
              testID={`admin-q-${q.id}`}
              style={[
                styles.adminQCard,
                { borderColor: isSel ? '#FFD700' : COLORS.border, borderWidth: isSel ? 2 : 1 },
              ]}
            >
              <View style={styles.adminQHeader}>
                <View style={[styles.argBadge, { backgroundColor: arg.color + '22', borderColor: arg.color }]}>
                  <Ionicons name={arg.icon} size={11} color={arg.color} />
                  <Text style={[styles.argBadgeText, { color: arg.color }]}>{arg.label}</Text>
                </View>
                <Text style={styles.adminQUser}>{(q as any).user_nome || '—'}</Text>
                <Text style={styles.dateText}>{q.data}</Text>
                <View
                  style={[
                    styles.checkBox,
                    { backgroundColor: isSel ? '#FFD700' : 'transparent', borderColor: isSel ? '#FFD700' : COLORS.border },
                  ]}
                >
                  {isSel && <Ionicons name="checkmark" size={14} color="#000" />}
                </View>
              </View>
              <Text style={styles.qText} numberOfLines={2}>"{q.domanda}"</Text>
              <Text style={[styles.aText, { marginTop: 6 }]} numberOfLines={3}>{q.risposta}</Text>
            </TouchableOpacity>
          );
        })
      )}

      {msg && (
        <View style={[styles.errorBox, { marginTop: 8 }]}>
          <Text style={[styles.errorText, msg.startsWith('✓') && { color: '#00E676' }]}>{msg}</Text>
        </View>
      )}

      <View style={styles.adminActionsRow}>
        <TouchableOpacity
          onPress={() => loadPool()}
          style={[styles.adminSecondaryBtn]}
          testID="admin-reload-pool"
        >
          <Ionicons name="refresh" size={14} color={COLORS.text} />
          <Text style={styles.adminSecondaryText}>Ricarica</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={publishing || selected.size === 0}
          onPress={publish}
          testID="admin-publish-top"
          style={[
            styles.adminPrimaryBtn,
            (publishing || selected.size === 0) && { opacity: 0.5 },
          ]}
        >
          {publishing ? <ActivityIndicator color="#000" /> : (
            <>
              <Ionicons name="trophy" size={16} color="#000" />
              <Text style={styles.adminPrimaryText}>PUBBLICA TOP ({selected.size}/3)</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MaestroScreen() {
  const { isAdmin } = useAuth();
  const [argomento, setArgomento] = useState<Argomento | null>(null);
  const [domanda, setDomanda] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [today, setToday] = useState<MaestroItem | null>(null);
  const [canAsk, setCanAsk] = useState(true);
  const [fresh, setFresh] = useState(false);
  const [history, setHistory] = useState<MaestroItem[]>([]);
  const [topWeek, setTopWeek] = useState<{settimana: string; pubblicato_il: string | null; entries: any[]} | null>(null);
  const [bonusGiven, setBonusGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [t, h, top] = await Promise.all([
        apiService.maestroToday(),
        apiService.maestroHistory(),
        apiService.maestroTop().catch(() => ({ data: [] })),
      ]);
      setCanAsk(t.data.can_ask);
      setToday(t.data.today);
      setHistory(h.data || []);
      const tops: any[] = top.data || [];
      setTopWeek(tops.length > 0 ? tops[0] : null);
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

        {/* COME FUNZIONA — riepilogo regole */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setShowRules(!showRules)}
          style={styles.rulesHeader}
          testID="maestro-rules-toggle"
        >
          <Ionicons name="information-circle" size={20} color={COLORS.primary} />
          <Text style={styles.rulesHeaderText}>COME FUNZIONA</Text>
          <Ionicons name={showRules ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
        {showRules && (
          <View style={styles.rulesBox} testID="maestro-rules-box">
            <View style={styles.ruleRow}>
              <View style={styles.ruleNum}><Text style={styles.ruleNumText}>1</Text></View>
              <Text style={styles.ruleText}>
                Scegli uno dei <Text style={styles.ruleBold}>3 argomenti</Text> (Amore, Sesso, Lavoro) e scrivi la tua domanda. Massimo 250 caratteri.
              </Text>
            </View>
            <View style={styles.ruleRow}>
              <View style={[styles.ruleNum, { backgroundColor: '#FFD70022', borderColor: '#FFD700' }]}>
                <Ionicons name="ticket" size={14} color="#FFD700" />
              </View>
              <Text style={styles.ruleText}>
                Per ogni domanda fatta ricevi <Text style={[styles.ruleBold, { color: '#FFD700' }]}>+1 biglietto lotteria</Text> in regalo. Limite: <Text style={styles.ruleBold}>1 domanda al giorno</Text>.
              </Text>
            </View>
            <View style={styles.ruleRow}>
              <View style={[styles.ruleNum, { backgroundColor: '#FF3D7F22', borderColor: '#FF3D7F' }]}>
                <Ionicons name="trophy" size={14} color="#FF3D7F" />
              </View>
              <Text style={styles.ruleText}>
                Ogni <Text style={styles.ruleBold}>lunedì mattina</Text> il Maestro pubblica le <Text style={styles.ruleBold}>3 risposte più divertenti</Text> della settimana, in forma <Text style={[styles.ruleBold, { color: '#FF3D7F' }]}>completamente anonima</Text> (nessun nome).
              </Text>
            </View>
            <View style={styles.ruleRow}>
              <View style={[styles.ruleNum, { backgroundColor: '#00B0FF22', borderColor: '#00B0FF' }]}>
                <Ionicons name="flame" size={14} color="#00B0FF" />
              </View>
              <Text style={styles.ruleText}>
                Tono: <Text style={styles.ruleBold}>sarcasmo bastardo ma affettuoso</Text>. Domande fuori tema verranno respinte. Niente politica, calcio o ricette della nonna.
              </Text>
            </View>
          </View>
        )}

        {/* PANNELLO ADMIN — Cura Top Settimanale */}
        {isAdmin && <AdminMaestroPanel onPublished={load} />}

        {/* Risposta di oggi (se già fatta) — solo cliente */}
        {!isAdmin && !canAsk && today && (
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

        {/* Form domanda — solo cliente */}
        {!isAdmin && canAsk && (
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

        {/* TOP 3 della Settimana — pubblicate dal Maestro in forma anonima */}
        {topWeek && topWeek.entries && topWeek.entries.length > 0 && (
          <View style={styles.topSection} testID="maestro-top-week">
            <View style={styles.topHeader}>
              <Ionicons name="trophy" size={20} color="#FFD700" />
              <Text style={styles.topTitle}>TOP {topWeek.entries.length} DELLA SETTIMANA</Text>
            </View>
            <Text style={styles.topSub}>
              Le risposte più divertenti pubblicate dal Maestro · Anonime
            </Text>
            {topWeek.entries.map((e: any, idx: number) => {
              const arg = ARGOMENTI.find((a) => a.key === e.argomento) || ARGOMENTI[0];
              return (
                <View key={idx} style={[styles.topCard, { borderLeftColor: arg.color }]}>
                  <View style={styles.topCardHeader}>
                    <View style={[styles.medalCircle, { backgroundColor: '#FFD700' }]}>
                      <Text style={styles.medalText}>{idx + 1}</Text>
                    </View>
                    <View style={[styles.argBadge, { backgroundColor: arg.color + '22', borderColor: arg.color }]}>
                      <Ionicons name={arg.icon} size={11} color={arg.color} />
                      <Text style={[styles.argBadgeText, { color: arg.color }]}>{arg.label}</Text>
                    </View>
                    <View style={styles.anonBadge}>
                      <Ionicons name="eye-off" size={11} color={COLORS.textSecondary} />
                      <Text style={styles.anonText}>ANONIMO</Text>
                    </View>
                  </View>
                  <Text style={styles.qLabel}>DOMANDA</Text>
                  <Text style={styles.qText}>"{e.domanda}"</Text>
                  <View style={styles.divider} />
                  <Text style={styles.aLabel}>RISPOSTA DEL MAESTRO</Text>
                  <Text style={styles.aText}>{e.risposta}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Storico — solo cliente */}
        {!isAdmin && history.length > (canAsk ? 0 : 1) && (
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

  // Box "Come Funziona"
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface || '#141416',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  rulesHeaderText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 12,
    color: COLORS.text,
    letterSpacing: 1.6,
    flex: 1,
  },
  rulesBox: {
    backgroundColor: COLORS.surface || '#141416',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
    gap: 12,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruleNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '22',
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleNumText: { fontFamily: FONTS.bodyBlack, fontSize: 13, color: COLORS.primary },
  ruleText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, flex: 1 },
  ruleBold: { fontFamily: FONTS.bodyBlack, color: COLORS.text },

  // Top 3 della Settimana
  topSection: { marginTop: 28 },
  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  topTitle: { fontFamily: FONTS.headline, fontSize: 22, color: COLORS.text, letterSpacing: 1.4 },
  topSub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginBottom: 14 },
  topCard: {
    backgroundColor: COLORS.surface || '#141416',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  topCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  medalCircle: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  medalText: { fontFamily: FONTS.bodyBlack, fontSize: 13, color: '#000' },
  anonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  anonText: { fontFamily: FONTS.bodyBlack, fontSize: 9, color: COLORS.textSecondary, letterSpacing: 1.2 },

  // Admin panel
  adminBox: {
    backgroundColor: COLORS.surface || '#141416',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD70066',
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
    marginTop: 4,
    marginBottom: 18,
  },
  adminHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  adminTitle: { fontFamily: FONTS.headline, fontSize: 18, color: COLORS.text, letterSpacing: 1.4 },
  adminSub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 12 },
  adminBold: { fontFamily: FONTS.bodyBlack, color: COLORS.text },
  adminEmpty: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
  adminQCard: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  adminQHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  adminQUser: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.text, flex: 1 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminActionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  adminSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  adminSecondaryText: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.text, letterSpacing: 1 },
  adminPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFD700',
  },
  adminPrimaryText: { fontFamily: FONTS.bodyBlack, fontSize: 12, color: '#000', letterSpacing: 1.4 },
});
