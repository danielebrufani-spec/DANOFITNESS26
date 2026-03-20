import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, SafeAreaView, Platform, Alert, RefreshControl, Image
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
  const isAdmin = user?.role === 'admin';
  const isIstruttore = user?.role === 'istruttore';
  const isPrivileged = isAdmin || isIstruttore;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  // Admin state
  const [activeView, setActiveView] = useState<'mio' | 'clienti'>(isPrivileged ? 'clienti' : 'mio');
  const [nutritionData, setNutritionData] = useState<any>(null);
  const [nutritionSearch, setNutritionSearch] = useState('');

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
      
      // Se il piano è in generazione, inizia il polling
      if (data.plan && data.plan.status === 'generating') {
        setPlan(null);
        setGenerating(true);
        pollForPlan();
      } else if (data.plan && data.plan.piano) {
        setPlan(data.plan);
      } else {
        setPlan(null);
      }
      
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

  const loadAdminData = async () => {
    if (!isPrivileged) return;
    try {
      const res = await apiService.getAdminNutritionPlans();
      setNutritionData(res.data);
    } catch { setNutritionData(null); }
  };

  useEffect(() => { loadData(); loadAdminData(); }, []);

  const toggleIntolleranza = (item: string) => {
    setIntolleranze(prev => 
      prev.includes(item.toLowerCase()) 
        ? prev.filter(i => i !== item.toLowerCase())
        : [...prev, item.toLowerCase()]
    );
  };

  const handleSaveProfile = async () => {
    if (!eta || !peso || !altezza || !obiettivo) {
      if (typeof window !== 'undefined') window.alert('Compila tutti i campi obbligatori');
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
      if (typeof window !== 'undefined') window.alert('Profilo Salvato! Ora puoi generare il tuo piano alimentare');
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Impossibile salvare';
      if (typeof window !== 'undefined') window.alert('Errore: ' + msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGeneratePlan = async () => {
    const conferma = typeof window !== 'undefined' 
      ? window.confirm('Vuoi generare il piano alimentare per questo mese? Ci vorranno circa 30-60 secondi.')
      : true;
    
    if (!conferma) return;
    
    setGenerating(true);
    try {
      const res = await apiService.generateMealPlan();
      
      // Se la generazione è in background, inizia il polling
      if (res.data.status === 'generating') {
        pollForPlan();
      } else if (res.data.piano) {
        setPlan(res.data);
        setGenerating(false);
      }
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Impossibile generare il piano';
      if (typeof window !== 'undefined') {
        window.alert('Errore: ' + msg);
      }
      setGenerating(false);
    }
  };

  const pollForPlan = () => {
    let attempts = 0;
    const maxAttempts = 30; // 30 x 3s = 90 secondi max
    
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await apiService.getNutritionPlan();
        const data = res.data;
        
        if (data.plan && data.plan.piano) {
          clearInterval(interval);
          setPlan(data.plan);
          setGenerating(false);
          if (typeof window !== 'undefined') {
            window.alert('Piano Generato! Il tuo piano alimentare è pronto!');
          }
        } else if (data.plan && data.plan.status === 'error') {
          clearInterval(interval);
          setGenerating(false);
          if (typeof window !== 'undefined') {
            window.alert('Errore nella generazione. Riprova.');
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setGenerating(false);
          if (typeof window !== 'undefined') {
            window.alert('La generazione sta impiegando più del previsto. Ricarica la pagina tra qualche minuto.');
          }
        }
      } catch {
        // Ignora errori di polling, continua a provare
      }
    }, 3000);
  };

  const handleResetPlan = async () => {
    const conferma = typeof window !== 'undefined'
      ? window.confirm('Sei sicuro di voler azzerare il piano? Potrai rigenerarlo con nuove indicazioni (verrà consumato un credito).')
      : true;
    if (!conferma) return;
    
    try {
      await apiService.resetMealPlan();
      setPlan(null);
      if (typeof window !== 'undefined') {
        window.alert('Piano azzerato! Ora puoi modificare il profilo e rigenerare.');
      }
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Errore durante l\'azzeramento';
      if (typeof window !== 'undefined') window.alert('Errore: ' + msg);
    }
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
        {/* Header con Logo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <View>
            <Text style={styles.header}>Piano Alimentare</Text>
            <Text style={styles.subheader}>Personalizzato per te ogni mese</Text>
          </View>
          <Image source={require('../../assets/images/logo.jpg')} style={{ width: 56, height: 56, borderRadius: 28 }} resizeMode="contain" />
        </View>

        {/* Tab Admin/Istruttore: Il mio Piano | Piani Clienti */}
        {isPrivileged && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <TouchableOpacity
              style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: activeView === 'clienti' ? COLORS.primary : COLORS.card,
                borderWidth: 1, borderColor: activeView === 'clienti' ? COLORS.primary : COLORS.border }}
              onPress={() => setActiveView('clienti')}
            >
              <Text style={{ color: activeView === 'clienti' ? '#000' : COLORS.text, fontWeight: '600', fontSize: 13 }}>
                Piani Clienti
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: activeView === 'mio' ? COLORS.primary : COLORS.card,
                borderWidth: 1, borderColor: activeView === 'mio' ? COLORS.primary : COLORS.border }}
              onPress={() => setActiveView('mio')}
            >
              <Text style={{ color: activeView === 'mio' ? '#000' : COLORS.text, fontWeight: '600', fontSize: 13 }}>
                Il mio Piano
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* === SEZIONE ADMIN: PIANI CLIENTI === */}
        {isPrivileged && activeView === 'clienti' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Ionicons name="people" size={24} color={COLORS.accent} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.text }}>Piani Alimentari Clienti</Text>
            </View>

            {nutritionData && (
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: COLORS.accent }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.text }}>{nutritionData.profili_totali || 0}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>Profili Creati</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: COLORS.primary }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: COLORS.primary }}>{nutritionData.piani_generati || 0}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>Piani Generati ({nutritionData.mese})</Text>
                </View>
              </View>
            )}

            {/* Barra di ricerca */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border }}>
              <Ionicons name="search" size={18} color={COLORS.textSecondary} />
              <TextInput
                data-testid="search-nutrition-plans"
                style={{ flex: 1, padding: 12, color: COLORS.text, fontSize: 14 }}
                placeholder="Cerca cliente per nome..."
                placeholderTextColor={COLORS.textSecondary}
                value={nutritionSearch}
                onChangeText={setNutritionSearch}
              />
              {nutritionSearch ? (
                <TouchableOpacity onPress={() => setNutritionSearch('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Lista clienti con piano */}
            {(() => {
              const plans = nutritionData?.plans || [];
              const filtered = nutritionSearch.trim()
                ? plans.filter((p: any) =>
                    `${p.user_nome} ${p.user_cognome}`.toLowerCase().includes(nutritionSearch.toLowerCase())
                  )
                : plans;

              if (filtered.length === 0) {
                return (
                  <View style={{ alignItems: 'center', padding: 32, gap: 10 }}>
                    <Ionicons name="restaurant-outline" size={48} color={COLORS.textSecondary} />
                    <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>
                      {nutritionSearch ? 'Nessun cliente trovato' : 'Nessun piano generato questo mese'}
                    </Text>
                  </View>
                );
              }

              return filtered.map((planItem: any, idx: number) => {
                const prof = planItem.profile_at_generation || {};
                return (
                  <View key={idx} data-testid={`nutrition-plan-card-${idx}`}
                    style={{ backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF6B6B20', justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="person" size={18} color={COLORS.accent} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>{planItem.user_nome} {planItem.user_cognome}</Text>
                          <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>
                            Generato: {new Date(planItem.generated_at || planItem.created_at).toLocaleDateString('it-IT')}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        data-testid={`reset-plan-${planItem.user_id}`}
                        style={{ padding: 10, borderRadius: 8, backgroundColor: '#FF6B6B10', borderWidth: 1, borderColor: '#FF6B6B30' }}
                        onPress={async () => {
                          const ok = typeof window !== 'undefined'
                            ? window.confirm(`Azzerare il piano di ${planItem.user_nome} ${planItem.user_cognome}? Potrà rigenerarlo.`)
                            : true;
                          if (!ok) return;
                          try {
                            await apiService.adminResetUserPlan(planItem.user_id);
                            if (typeof window !== 'undefined') window.alert('Piano azzerato!');
                            loadAdminData();
                          } catch (err: any) {
                            if (typeof window !== 'undefined') window.alert('Errore: ' + (err.response?.data?.detail || 'Impossibile azzerare'));
                          }
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color={COLORS.accent} />
                      </TouchableOpacity>
                    </View>

                    {(prof.sesso || prof.eta || prof.peso) ? (
                      <>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {prof.sesso ? <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, gap: 4 }}><Ionicons name={prof.sesso === 'M' ? 'male' : 'female'} size={12} color={COLORS.primary} /><Text style={{ fontSize: 11, color: COLORS.text, fontWeight: '500' }}>{prof.sesso === 'M' ? 'Uomo' : 'Donna'}</Text></View> : null}
                          {prof.eta ? <View style={{ backgroundColor: COLORS.cardLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ fontSize: 11, color: COLORS.text, fontWeight: '500' }}>{prof.eta} anni</Text></View> : null}
                          {prof.altezza ? <View style={{ backgroundColor: COLORS.cardLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ fontSize: 11, color: COLORS.text, fontWeight: '500' }}>{prof.altezza} cm</Text></View> : null}
                          {prof.peso ? <View style={{ backgroundColor: COLORS.cardLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ fontSize: 11, color: COLORS.text, fontWeight: '500' }}>{prof.peso} kg</Text></View> : null}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                          <Ionicons name="flag" size={13} color={COLORS.accent} />
                          <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600', marginLeft: 5 }}>{prof.obiettivo || '—'}</Text>
                          <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 8 }}>{Math.round(prof.calorie_giornaliere || 0)} kcal/giorno</Text>
                        </View>
                        {(prof.proteine_g || prof.carboidrati_g || prof.grassi_g) ? (
                          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
                            <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: '600' }}>P: {Math.round(prof.proteine_g || 0)}g</Text>
                            <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '600' }}>C: {Math.round(prof.carboidrati_g || 0)}g</Text>
                            <Text style={{ fontSize: 11, color: '#22c55e', fontWeight: '600' }}>G: {Math.round(prof.grassi_g || 0)}g</Text>
                          </View>
                        ) : null}
                        {prof.intolleranze && prof.intolleranze.length > 0 ? (
                          <Text style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Intolleranze: {prof.intolleranze.join(', ')}</Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontStyle: 'italic' }}>Dati profilo non disponibili</Text>
                    )}
                  </View>
                );
              });
            })()}
          </>
        )}

        {/* === SEZIONE PERSONALE === */}
        {(!isPrivileged || activeView === 'mio') && (<>

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
        {showForm && (
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

            {/* Pulsanti Copia & Stampa */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                data-testid="copy-plan-button"
                style={styles.copyButton}
                onPress={async () => {
                  try {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText(plan.piano);
                      if (Platform.OS === 'web') window.alert('Piano copiato negli appunti!');
                      else Alert.alert('Copiato!', 'Piano copiato negli appunti');
                    } else {
                      // Fallback per dispositivi senza clipboard API
                      const textArea = document.createElement('textarea');
                      textArea.value = plan.piano;
                      textArea.style.position = 'fixed';
                      textArea.style.opacity = '0';
                      document.body.appendChild(textArea);
                      textArea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textArea);
                      if (Platform.OS === 'web') window.alert('Piano copiato negli appunti!');
                      else Alert.alert('Copiato!', 'Piano copiato negli appunti');
                    }
                  } catch {
                    if (Platform.OS === 'web') window.alert('Impossibile copiare. Seleziona il testo manualmente.');
                    else Alert.alert('Errore', 'Impossibile copiare');
                  }
                }}
              >
                <Ionicons name="copy-outline" size={18} color="#000" />
                <Text style={styles.copyButtonText}>Copia Piano</Text>
              </TouchableOpacity>

              {Platform.OS === 'web' && (
                <TouchableOpacity
                  data-testid="print-plan-button"
                  style={[styles.copyButton, { backgroundColor: '#6366f1' }]}
                  onPress={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html><head><title>Piano Alimentare - ${plan.mese || ''}</title>
                        <style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.7;color:#222;max-width:800px;margin:0 auto}h1{color:#4ECDC4;border-bottom:2px solid #4ECDC4;padding-bottom:8px}pre{white-space:pre-wrap;font-family:inherit;font-size:14px}</style>
                        </head><body><h1>Piano Alimentare — ${plan.mese || ''}</h1><pre>${plan.piano}</pre></body></html>
                      `);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}
                >
                  <Ionicons name="print-outline" size={18} color="#fff" />
                  <Text style={[styles.copyButtonText, { color: '#fff' }]}>Stampa</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        </>)}
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
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FF6B6B40', backgroundColor: '#FF6B6B10' },
  resetButtonText: { fontSize: 14, fontWeight: '600', color: '#FF6B6B' },

  // Copy & Print
  copyButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, padding: 12, borderRadius: 12 },
  copyButtonText: { fontSize: 14, fontWeight: '600', color: '#000' },
});
