import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, SafeAreaView, Platform, Alert, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';

const COLORS = {
  background: '#0a0a0a',
  card: '#1a1a1a',
  cardLight: '#252525',
  primary: '#4ECDC4',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  border: '#333333',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  accent: '#FF6B6B',
};

const OBIETTIVI = [
  { key: 'dimagrire', label: 'Perdere Peso', icon: 'trending-down-outline' as const, color: '#4ECDC4' },
  { key: 'mantenimento', label: 'Mantenimento', icon: 'swap-horizontal-outline' as const, color: '#F59E0B' },
  { key: 'massa', label: 'Massa Muscolare', icon: 'trending-up-outline' as const, color: '#FF6B6B' },
];

const INTOLLERANZE_OPTIONS = ['Glutine', 'Lattosio', 'Uova', 'Frutta secca', 'Vegano', 'Vegetariano'];

export default function AlimentazioneScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [sesso, setSesso] = useState('F');
  const [eta, setEta] = useState('');
  const [peso, setPeso] = useState('');
  const [altezza, setAltezza] = useState('');
  const [obiettivo, setObiettivo] = useState('');
  const [intolleranze, setIntolleranze] = useState<string[]>([]);
  const [alimentiEsclusi, setAlimentiEsclusi] = useState('');
  const [note, setNote] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const loadData = async () => {
    try {
      const res = await apiService.getNutritionPlan();
      const data = res.data;
      setHasSubscription(data.has_subscription);
      setProfile(data.profile);
      setPlan(data.plan);
      
      if (data.profile) {
        setSesso(data.profile.sesso || 'F');
        setEta(String(data.profile.eta || ''));
        setPeso(String(data.profile.peso || ''));
        setAltezza(String(data.profile.altezza || ''));
        setObiettivo(data.profile.obiettivo || '');
        setIntolleranze(data.profile.intolleranze || []);
        setAlimentiEsclusi(data.profile.alimenti_esclusi || '');
        setNote(data.profile.note || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const toggleIntolleranza = (item: string) => {
    setIntolleranze(prev => 
      prev.includes(item.toLowerCase()) 
        ? prev.filter(i => i !== item.toLowerCase())
        : [...prev, item.toLowerCase()]
    );
  };

  const handleSaveProfile = async () => {
    if (!eta || !peso || !altezza || !obiettivo) {
      Alert.alert('Attenzione', 'Compila tutti i campi obbligatori');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await apiService.saveNutritionProfile({
        sesso, eta: parseInt(eta), peso: parseFloat(peso),
        altezza: parseFloat(altezza), obiettivo, intolleranze,
        alimenti_esclusi: alimentiEsclusi || null, note: note || null,
      });
      setProfile(res.data);
      setShowForm(false);
      Alert.alert('Profilo Salvato!', 'Ora puoi generare il tuo piano alimentare');
    } catch (e: any) {
      Alert.alert('Errore', e.response?.data?.detail || 'Impossibile salvare');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGeneratePlan = async () => {
    Alert.alert(
      'Genera Piano',
      'Vuoi generare il piano alimentare per questo mese? Potrai generarne uno nuovo il prossimo mese.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Genera', onPress: async () => {
          setGenerating(true);
          try {
            const res = await apiService.generateMealPlan();
            setPlan(res.data);
            Alert.alert('Piano Generato!', 'Il tuo piano alimentare mensile è pronto!');
          } catch (e: any) {
            Alert.alert('Errore', e.response?.data?.detail || 'Impossibile generare il piano');
          } finally {
            setGenerating(false);
          }
        }},
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!hasSubscription) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lockedContainer}>
          <Ionicons name="lock-closed" size={50} color={COLORS.textSecondary} />
          <Text style={styles.lockedTitle}>Funzione Riservata</Text>
          <Text style={styles.lockedText}>
            Il piano alimentare personalizzato è disponibile solo per i clienti con abbonamento attivo.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <Text style={styles.header}>Piano Alimentare</Text>
        <Text style={styles.subheader}>Personalizzato per te ogni mese</Text>

        {/* SPIEGAZIONE */}
        {!profile && !showForm && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Come Funziona</Text>
            <View style={styles.infoStep}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>1</Text></View>
              <Text style={styles.stepText}>
                <Text style={styles.bold}>Compila il tuo profilo</Text> — inserisci i tuoi dati (peso, altezza, obiettivo, intolleranze)
              </Text>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>2</Text></View>
              <Text style={styles.stepText}>
                <Text style={styles.bold}>Calcolo scientifico</Text> — calcoliamo il tuo fabbisogno calorico e i macronutrienti con la formula Mifflin-St Jeor
              </Text>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>3</Text></View>
              <Text style={styles.stepText}>
                <Text style={styles.bold}>Piano AI personalizzato</Text> — un'intelligenza artificiale genera 4 settimane di pasti con alternative, lista della spesa e consigli sugli allenamenti
              </Text>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>4</Text></View>
              <Text style={styles.stepText}>
                <Text style={styles.bold}>Rinnovo mensile</Text> — ogni 1° del mese puoi generare un nuovo piano aggiornato
              </Text>
            </View>
            <TouchableOpacity style={styles.startButton} onPress={() => setShowForm(true)}>
              <Text style={styles.startButtonText}>Inizia Ora</Text>
              <Ionicons name="arrow-forward" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        {/* FORM PROFILO */}
        {(showForm || (profile && !plan)) && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{profile ? 'Modifica Profilo' : 'Il Tuo Profilo'}</Text>

            {/* Sesso */}
            <Text style={styles.label}>Sesso</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity style={[styles.toggleBtn, sesso === 'M' && styles.toggleActive]} onPress={() => setSesso('M')}>
                <Text style={[styles.toggleText, sesso === 'M' && styles.toggleTextActive]}>Uomo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, sesso === 'F' && styles.toggleActive]} onPress={() => setSesso('F')}>
                <Text style={[styles.toggleText, sesso === 'F' && styles.toggleTextActive]}>Donna</Text>
              </TouchableOpacity>
            </View>

            {/* Età, Peso, Altezza */}
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Età</Text>
                <TextInput style={styles.input} value={eta} onChangeText={setEta} keyboardType="numeric" placeholder="30" placeholderTextColor={COLORS.textSecondary} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Peso (kg)</Text>
                <TextInput style={styles.input} value={peso} onChangeText={setPeso} keyboardType="decimal-pad" placeholder="70" placeholderTextColor={COLORS.textSecondary} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Altezza (cm)</Text>
                <TextInput style={styles.input} value={altezza} onChangeText={setAltezza} keyboardType="numeric" placeholder="170" placeholderTextColor={COLORS.textSecondary} />
              </View>
            </View>

            {/* Obiettivo */}
            <Text style={styles.label}>Obiettivo</Text>
            <View style={styles.obiettivi}>
              {OBIETTIVI.map(ob => (
                <TouchableOpacity key={ob.key} style={[styles.obiettivoBtn, obiettivo === ob.key && { borderColor: ob.color, backgroundColor: ob.color + '20' }]} onPress={() => setObiettivo(ob.key)}>
                  <Ionicons name={ob.icon} size={22} color={obiettivo === ob.key ? ob.color : COLORS.textSecondary} />
                  <Text style={[styles.obiettivoText, obiettivo === ob.key && { color: ob.color }]}>{ob.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Intolleranze */}
            <Text style={styles.label}>Intolleranze / Preferenze</Text>
            <View style={styles.chipRow}>
              {INTOLLERANZE_OPTIONS.map(item => (
                <TouchableOpacity key={item} style={[styles.chip, intolleranze.includes(item.toLowerCase()) && styles.chipActive]} onPress={() => toggleIntolleranza(item)}>
                  <Text style={[styles.chipText, intolleranze.includes(item.toLowerCase()) && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Alimenti esclusi */}
            <Text style={styles.label}>Alimenti da evitare (opzionale)</Text>
            <TextInput style={styles.textArea} value={alimentiEsclusi} onChangeText={setAlimentiEsclusi} placeholder="Es: funghi, peperoni, fegato..." placeholderTextColor={COLORS.textSecondary} multiline />

            {/* Note */}
            <Text style={styles.label}>Note (opzionale)</Text>
            <TextInput style={styles.textArea} value={note} onChangeText={setNote} placeholder="Es: mangio spesso fuori a pranzo..." placeholderTextColor={COLORS.textSecondary} multiline />

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? <ActivityIndicator color="#000" /> : (
                <>
                  <Text style={styles.saveButtonText}>Salva Profilo</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#000" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* RISULTATI CALCOLO */}
        {profile && !showForm && (
          <View style={styles.calcCard}>
            <View style={styles.calcHeader}>
              <Text style={styles.calcTitle}>Il Tuo Fabbisogno</Text>
              <TouchableOpacity onPress={() => setShowForm(true)}>
                <Ionicons name="pencil" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.calcGrid}>
              <View style={styles.calcItem}>
                <Text style={styles.calcValue}>{Math.round(profile.calorie_giornaliere)}</Text>
                <Text style={styles.calcLabel}>Kcal/giorno</Text>
              </View>
              <View style={styles.calcItem}>
                <Text style={[styles.calcValue, { color: '#FF6B6B' }]}>{Math.round(profile.proteine_g)}g</Text>
                <Text style={styles.calcLabel}>Proteine</Text>
              </View>
              <View style={styles.calcItem}>
                <Text style={[styles.calcValue, { color: '#F59E0B' }]}>{Math.round(profile.carboidrati_g)}g</Text>
                <Text style={styles.calcLabel}>Carboidrati</Text>
              </View>
              <View style={styles.calcItem}>
                <Text style={[styles.calcValue, { color: '#4ECDC4' }]}>{Math.round(profile.grassi_g)}g</Text>
                <Text style={styles.calcLabel}>Grassi</Text>
              </View>
            </View>

            <View style={styles.lessonAdvice}>
              <Ionicons name="fitness-outline" size={20} color={COLORS.primary} />
              <Text style={styles.lessonAdviceText}>
                Consiglio: <Text style={styles.bold}>{profile.lezioni_consigliate} lezioni/settimana</Text> per raggiungere il tuo obiettivo
              </Text>
            </View>
          </View>
        )}

        {/* GENERA PIANO o MOSTRA PIANO */}
        {profile && !plan && !showForm && (
          <TouchableOpacity style={styles.generateButton} onPress={handleGeneratePlan} disabled={generating}>
            {generating ? (
              <View style={styles.generatingContent}>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.generateButtonText}>Sto creando il tuo piano...</Text>
                <Text style={styles.generatingSubtext}>Potrebbe richiedere un minuto</Text>
              </View>
            ) : (
              <>
                <Ionicons name="sparkles" size={24} color="#000" />
                <Text style={styles.generateButtonText}>Genera Piano Mensile</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {plan && !showForm && (
          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <Ionicons name="restaurant-outline" size={22} color={COLORS.primary} />
              <Text style={styles.planTitle}>Il Tuo Piano — {plan.mese || ''}</Text>
            </View>
            <Text style={styles.planContent}>{plan.piano}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginTop: 10 },
  subheader: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  
  // Locked
  lockedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  lockedTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  lockedText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Info card
  infoCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, gap: 14, borderWidth: 1, borderColor: COLORS.border },
  infoTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 },
  infoStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary + '20', justifyContent: 'center', alignItems: 'center' },
  stepNum: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
  stepText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  bold: { fontWeight: 'bold', color: COLORS.text },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, marginTop: 6 },
  startButtonText: { fontSize: 16, fontWeight: 'bold', color: '#000' },

  // Form
  formCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  toggleActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '20' },
  toggleText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: COLORS.primary },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputGroup: { flex: 1 },
  input: { backgroundColor: COLORS.cardLight, borderRadius: 10, padding: 12, fontSize: 16, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  obiettivi: { gap: 8 },
  obiettivoBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border },
  obiettivoText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardLight },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '20' },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary, fontWeight: '600' },
  textArea: { backgroundColor: COLORS.cardLight, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, minHeight: 60, textAlignVertical: 'top' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, marginTop: 20 },
  saveButtonText: { fontSize: 16, fontWeight: 'bold', color: '#000' },

  // Calcolo
  calcCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  calcHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  calcTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  calcGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  calcItem: { alignItems: 'center', gap: 4 },
  calcValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary },
  calcLabel: { fontSize: 11, color: COLORS.textSecondary },
  lessonAdvice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary + '15', padding: 12, borderRadius: 10, marginTop: 14 },
  lessonAdviceText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },

  // Generate button
  generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.primary, padding: 18, borderRadius: 16 },
  generateButtonText: { fontSize: 17, fontWeight: 'bold', color: '#000' },
  generatingContent: { alignItems: 'center', gap: 6 },
  generatingSubtext: { fontSize: 12, color: '#000', opacity: 0.6 },

  // Plan
  planCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  planTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  planContent: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
});
