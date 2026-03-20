import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
  Linking,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../src/utils/constants';
import { apiService } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

// Array di curiosità sportive realmente accadute
const CURIOSITA_SPORTIVE = [
  { titolo: "Il gol più veloce della storia", testo: "Nel 2009, Nawaf Al-Abed segnò dopo soli 2 secondi dall'inizio della partita nella Saudi Premier League. Ricevette palla dal calcio d'inizio e tirò dalla sua metà campo!", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Usain Bolt e i chicken nuggets", testo: "Durante le Olimpiadi di Pechino 2008, Usain Bolt mangiò circa 1000 chicken nuggets in 10 giorni perché non si fidava del cibo cinese. Vinse comunque 3 ori!", categoria: "Atletica", emoji: "🏃" },
  { titolo: "La partita più lunga di tennis", testo: "Nel 2010 a Wimbledon, Isner e Mahut giocarono per 11 ore e 5 minuti, distribuite in 3 giorni. Il punteggio finale fu 70-68 al quinto set!", categoria: "Tennis", emoji: "🎾" },
  { titolo: "Michael Jordan fu escluso dalla squadra", testo: "Nel 1978, Michael Jordan fu tagliato dalla squadra di basket del liceo perché considerato troppo basso. Divenne poi il più grande giocatore della storia NBA.", categoria: "Basket", emoji: "🏀" },
  { titolo: "Il portiere che segnò 131 gol", testo: "Rogério Ceni, portiere brasiliano, detiene il record di gol segnati da un portiere: 131 reti in carriera, principalmente su punizione e rigore!", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Le Olimpiadi e il tiro al piccione", testo: "Alle Olimpiadi di Parigi 1900, il tiro al piccione vivo era sport olimpico. Furono uccisi circa 300 uccelli. Fu l'unica volta nella storia.", categoria: "Olimpiadi", emoji: "🏅" },
  { titolo: "Maradona e la 'Mano de Dios'", testo: "Nel 1986, Maradona segnò con la mano contro l'Inghilterra ai Mondiali. Dopo la partita disse: 'È stata la mano di Dio'. L'Argentina vinse poi il Mondiale.", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Il nuotatore senza piscina olimpica", testo: "Eric Moussambani della Guinea Equatoriale nuotò i 100m alle Olimpiadi 2000 in 1:52, il doppio del tempo normale. Si era allenato in una piscina d'hotel!", categoria: "Nuoto", emoji: "🏊" },
  { titolo: "Muhammad Ali e il suo oro olimpico", testo: "Muhammad Ali gettò la sua medaglia d'oro olimpica del 1960 nel fiume Ohio dopo che gli fu negato il servizio in un ristorante per il colore della pelle.", categoria: "Boxe", emoji: "🥊" },
  { titolo: "La partita di calcio più corta", testo: "Nel 2002, una partita in Argentina durò solo 2 secondi. L'arbitro fischiò l'inizio e subito dopo la fine per una rissa scoppiata prima del calcio d'inizio!", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Pelé fermò una guerra", testo: "Nel 1969, Nigeria e Biafra dichiararono un cessate il fuoco di 48 ore durante la guerra civile per permettere a entrambe le parti di vedere giocare Pelé.", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Il ciclista che bevve troppo vino", testo: "Nel Tour de France 1904, diversi ciclisti furono squalificati per aver preso il treno. Altri bevvero così tanto vino che si addormentarono lungo il percorso!", categoria: "Ciclismo", emoji: "🚴" },
  { titolo: "Shaquille O'Neal e i tiri liberi", testo: "Shaq sbagliò oltre 5.000 tiri liberi in carriera NBA. Gli avversari inventarono la 'Hack-a-Shaq', facendogli fallo apposta per mandarlo in lunetta.", categoria: "Basket", emoji: "🏀" },
  { titolo: "Il record di Bolt quasi scalzo", testo: "Usain Bolt corse i 100m in 9.58 secondi con le scarpe slacciate! Disse che non voleva perdere tempo a riallacciarle prima della gara.", categoria: "Atletica", emoji: "🏃" },
  { titolo: "Il portiere con gli occhiali", testo: "Edgar Davids giocava con occhiali protettivi speciali a causa del glaucoma. Divennero iconici e molti bambini iniziarono a imitarlo.", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Le Olimpiadi sul Monte Everest", testo: "Nel 2012, la torcia olimpica fu portata sulla cima dell'Everest. Ci vollero 5 giorni di scalata per raggiungere gli 8.848 metri!", categoria: "Olimpiadi", emoji: "🏅" },
  { titolo: "Ronaldo e le 5.000 calorie", testo: "Cristiano Ronaldo consuma circa 5.000 calorie al giorno ma mantiene solo il 7% di grasso corporeo grazie a 5 ore di allenamento quotidiano.", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Il pugile più anziano", testo: "George Foreman divenne campione del mondo dei pesi massimi a 45 anni nel 1994, 20 anni dopo il suo primo titolo!", categoria: "Boxe", emoji: "🥊" },
  { titolo: "La maratona più lenta", testo: "Shizo Kanakuri iniziò la maratona olimpica nel 1912. Si fermò a bere tè in una casa e si addormentò. Completò la gara nel 1967: 54 anni, 8 mesi e 6 giorni!", categoria: "Atletica", emoji: "🏃" },
  { titolo: "Messi e il record di Palloni d'Oro", testo: "Lionel Messi ha vinto 8 Palloni d'Oro, più di qualsiasi altro giocatore nella storia. Il secondo in classifica, Ronaldo, ne ha 5.", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Il golfista e il fulmine", testo: "Lee Trevino fu colpito da un fulmine durante un torneo di golf nel 1975. Sopravvisse e tornò a giocare, scherzando: 'Dio non può colpire un ferro 1!'", categoria: "Golf", emoji: "⛳" },
  { titolo: "La nazionale di calcio più vecchia", testo: "L'Inghilterra giocò la prima partita internazionale di calcio nel 1872 contro la Scozia. Finì 0-0 davanti a 4.000 spettatori.", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Kobe Bryant e l'italiano", testo: "Kobe Bryant parlava fluentemente italiano perché visse in Italia dai 6 ai 13 anni mentre il padre giocava nella Serie A di basket.", categoria: "Basket", emoji: "🏀" },
  { titolo: "Il calciatore che giocò 4 Mondiali", testo: "Gianluigi Buffon ha partecipato a 5 Mondiali (1998-2014), record per un calciatore italiano. Vinse quello del 2006 in Germania.", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Il tuffo da record", testo: "Nel 2015, Laso Schaller si tuffò da 58.8 metri nelle cascate di Maggia in Svizzera, il tuffo più alto mai registrato!", categoria: "Tuffi", emoji: "🏊" },
  { titolo: "La punizione più forte", testo: "Roberto Carlos calciò una punizione a 137 km/h nel 1997 contro la Francia. La palla curvò così tanto che un raccattapalle scappò pensando andasse fuori!", categoria: "Calcio", emoji: "⚽" },
  { titolo: "Gli sport inventati per caso", testo: "Il basket fu inventato nel 1891 da James Naismith che doveva trovare un'attività indoor per gli studenti durante l'inverno. Usò cesti di pesche!", categoria: "Basket", emoji: "🏀" },
  { titolo: "Federer e le 23 vittorie Slam", testo: "Roger Federer detenne il record di 20 Slam per anni. Djokovic lo superò nel 2023 raggiungendo 24 titoli del Grande Slam.", categoria: "Tennis", emoji: "🎾" },
  { titolo: "Il calcio e la Prima Guerra", testo: "Durante la tregua di Natale del 1914, soldati tedeschi e britannici giocarono a calcio nella terra di nessuno. Una delle storie più belle dello sport.", categoria: "Calcio", emoji: "⚽" },
  { titolo: "La pallacanestro senza palleggio", testo: "Nelle prime partite di basket (1891), non era permesso palleggiare. I giocatori potevano solo passare la palla o tirare!", categoria: "Basket", emoji: "🏀" }
];

// Consigli alimentari del Maestro - cambiano ogni giorno
const CONSIGLI_ALIMENTARI = [
  { consiglio: "Bevi almeno 2 litri d'acqua al giorno. L'idratazione è fondamentale per le performance!", icon: "water" },
  { consiglio: "Mangia proteine ad ogni pasto: uova, pesce, carne magra o legumi.", icon: "fish" },
  { consiglio: "Non saltare la colazione! È il carburante per iniziare la giornata.", icon: "sunny" },
  { consiglio: "Verdure a volontà! Più colori nel piatto = più nutrienti.", icon: "leaf" },
  { consiglio: "Evita gli zuccheri raffinati. Preferisci la frutta per la voglia di dolce.", icon: "nutrition" },
  { consiglio: "Carboidrati complessi prima dell'allenamento: pasta, riso, patate.", icon: "fitness" },
  { consiglio: "Dopo l'allenamento, proteine entro 30 minuti per il recupero muscolare.", icon: "timer" },
  { consiglio: "Dormi almeno 7-8 ore. Il riposo è parte dell'allenamento!", icon: "moon" },
  { consiglio: "Riduci il sale. Usa spezie ed erbe aromatiche per insaporire.", icon: "restaurant" },
  { consiglio: "Mangia lentamente e mastica bene. La digestione inizia in bocca!", icon: "time" },
  { consiglio: "Frutta secca come spuntino: noci, mandorle, nocciole. Energia pura!", icon: "heart" },
  { consiglio: "Limita l'alcol. Una birra equivale a correre 30 minuti per smaltirla.", icon: "beer" },
  { consiglio: "Prepara i pasti in anticipo. Il meal prep ti salva dalle tentazioni!", icon: "calendar" },
  { consiglio: "Yogurt greco: proteine, probiotici e calcio in un solo alimento.", icon: "star" },
  { consiglio: "Non eliminare i grassi! Olio d'oliva, avocado, pesce sono essenziali.", icon: "checkmark-circle" },
  { consiglio: "Leggi le etichette. Se non capisci un ingrediente, forse non dovresti mangiarlo.", icon: "search" },
  { consiglio: "La pasta non fa ingrassare! È la quantità e il condimento che contano.", icon: "pizza" },
  { consiglio: "Fai 5 piccoli pasti al giorno per mantenere attivo il metabolismo.", icon: "apps" },
  { consiglio: "Uova: complete di tutti gli aminoacidi. 2 al giorno non fanno male!", icon: "egg" },
  { consiglio: "Prima dell'allenamento evita cibi grassi. Appesantiscono la digestione.", icon: "alert-circle" },
  { consiglio: "Il cioccolato fondente (>70%) è un alleato: antiossidanti e buonumore!", icon: "happy" },
  { consiglio: "Fai una lista della spesa. Al supermercato compri solo il necessario.", icon: "list" },
  { consiglio: "Pesce azzurro 2-3 volte a settimana: omega-3 per cuore e cervello.", icon: "fish" },
  { consiglio: "Non cenare troppo tardi. L'ideale è 3 ore prima di dormire.", icon: "bed" },
  { consiglio: "Aggiungi semi ai tuoi piatti: chia, lino, zucca. Piccoli ma potenti!", icon: "sparkles" },
  { consiglio: "Le fibre saziano e aiutano l'intestino. Cereali integrali sempre!", icon: "infinite" },
  { consiglio: "Cucina al vapore o alla griglia. Meno grassi, più sapore naturale.", icon: "flame" },
  { consiglio: "Lo stress fa ingrassare. Respira, rilassati, medita.", icon: "medkit" },
  { consiglio: "Tè verde: accelera il metabolismo e brucia i grassi.", icon: "cafe" },
  { consiglio: "Non esistono cibi proibiti, solo porzioni sbagliate.", icon: "scale" },
  { consiglio: "Banana prima dell'allenamento: potassio contro i crampi!", icon: "flash" },
];

// Funzione per ottenere il consiglio alimentare del giorno
const getConsiglioAlimentare = () => {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  return CONSIGLI_ALIMENTARI[dayOfYear % CONSIGLI_ALIMENTARI.length];
};

interface Consiglio {
  id: string;
  testo?: string;
  immagine_url?: string;
  immagine_base64?: string;
  spotify_url?: string;
  created_at: string;
}

// Funzione per rendere i link cliccabili nel testo
const renderTextWithLinks = (text: string) => {
  // Regex per trovare URL
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex
      urlRegex.lastIndex = 0;
      return (
        <Text 
          key={index} 
          style={styles.linkText}
          onPress={() => Linking.openURL(part).catch(() => Alert.alert('Errore', 'Impossibile aprire il link'))}
        >
          {part}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
};

export default function CuriositaScreen() {
  const { isAdmin } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [curiositaDelGiorno, setCuriositaDelGiorno] = useState<typeof CURIOSITA_SPORTIVE[0] | null>(null);
  const [consigli, setConsigli] = useState<Consiglio[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [nuovoTesto, setNuovoTesto] = useState('');
  const [nuovoSpotify, setNuovoSpotify] = useState('');
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Consigli Musicali
  const [consigliMusicali, setConsigliMusicali] = useState<{id: string; titolo?: string; spotify_url: string; created_at: string}[]>([]);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [nuovoMusicTitolo, setNuovoMusicTitolo] = useState('');
  const [nuovoMusicSpotify, setNuovoMusicSpotify] = useState('');

  const loadCuriosita = () => {
    const oggi = new Date();
    const anno = oggi.getFullYear();
    const inizioAnno = new Date(anno, 0, 1);
    const giorni = Math.floor((oggi.getTime() - inizioAnno.getTime()) / 86400000);
    const settimana = Math.floor(giorni / 7);
    const giornoSettimana = oggi.getDay();
    const index = (settimana * 7 + giornoSettimana + anno) % CURIOSITA_SPORTIVE.length;
    setCuriositaDelGiorno(CURIOSITA_SPORTIVE[index]);
  };

  const loadConsigli = async () => {
    try {
      const res = await apiService.getConsigli();
      setConsigli(res.data);
    } catch (e) {
      console.log('Error loading consigli');
    }
  };

  const loadConsigliMusicali = async () => {
    try {
      const res = await apiService.getConsigliMusicali();
      setConsigliMusicali(res.data);
    } catch (e) {
      console.log('Error loading consigli musicali');
    }
  };

  const loadData = async () => {
    loadCuriosita();
    await Promise.all([loadConsigli(), loadConsigliMusicali()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Funzione per selezionare immagine dalla galleria
  const pickImage = async () => {
    try {
      // Richiedi permessi
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso negato', 'Serve il permesso per accedere alla galleria');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setSelectedImageBase64(base64Image);
      }
    } catch (error) {
      console.log('Image picker error:', error);
      Alert.alert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  // Rimuovi immagine selezionata
  const removeImage = () => {
    setSelectedImageBase64(null);
  };

  const handleCreateConsiglio = async () => {
    if (!nuovoTesto && !selectedImageBase64 && !nuovoSpotify) {
      if (Platform.OS === 'web') {
        alert('Inserisci almeno un contenuto');
      } else {
        Alert.alert('Errore', 'Inserisci almeno un contenuto');
      }
      return;
    }
    
    setIsUploading(true);
    try {
      await apiService.createConsiglio({
        testo: nuovoTesto || undefined,
        immagine_base64: selectedImageBase64 || undefined,
        spotify_url: nuovoSpotify || undefined,
      });
      setShowModal(false);
      setNuovoTesto('');
      setNuovoSpotify('');
      setSelectedImageBase64(null);
      loadConsigli();
      if (Platform.OS === 'web') {
        alert('Consiglio pubblicato!');
      } else {
        Alert.alert('Successo', 'Consiglio pubblicato!');
      }
    } catch (e) {
      if (Platform.OS === 'web') {
        alert('Impossibile pubblicare');
      } else {
        Alert.alert('Errore', 'Impossibile pubblicare');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteConsiglio = async (id: string) => {
    console.log('[DELETE] Tentativo eliminazione consiglio:', id);
    
    const doDelete = async () => {
      try {
        console.log('[DELETE] Chiamata API deleteConsiglio...');
        const response = await apiService.deleteConsiglio(id);
        console.log('[DELETE] Risposta:', response);
        loadConsigli();
        if (Platform.OS === 'web') {
          alert('Consiglio eliminato con successo!');
        } else {
          Alert.alert('Successo', 'Consiglio eliminato!');
        }
      } catch (e: any) {
        console.error('[DELETE] Errore:', e);
        console.error('[DELETE] Response:', e.response?.data);
        console.error('[DELETE] Status:', e.response?.status);
        const errorMsg = e.response?.data?.detail || e.message || 'Impossibile eliminare';
        if (Platform.OS === 'web') {
          alert(`Errore: ${errorMsg}`);
        } else {
          Alert.alert('Errore', errorMsg);
        }
      }
    };
    
    if (Platform.OS === 'web') {
      if (window.confirm('Vuoi eliminare questo consiglio?')) {
        await doDelete();
      }
    } else {
      Alert.alert('Elimina', 'Vuoi eliminare questo consiglio?', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  // Consigli Musicali functions
  const addConsiglioMusicale = async () => {
    if (!nuovoMusicSpotify.trim()) {
      Alert.alert('Errore', 'Inserisci un link Spotify');
      return;
    }
    if (!nuovoMusicSpotify.includes('spotify.com')) {
      Alert.alert('Errore', 'Inserisci un link Spotify valido');
      return;
    }
    try {
      await apiService.createConsiglioMusicale({
        titolo: nuovoMusicTitolo.trim() || undefined,
        spotify_url: nuovoMusicSpotify.trim()
      });
      setNuovoMusicTitolo('');
      setNuovoMusicSpotify('');
      setShowMusicModal(false);
      loadConsigliMusicali();
    } catch (e) {
      Alert.alert('Errore', 'Impossibile aggiungere il consiglio musicale');
    }
  };

  const deleteConsiglioMusicale = async (id: string) => {
    console.log('[DELETE MUSIC] Tentativo eliminazione:', id);
    
    const doDelete = async () => {
      try {
        console.log('[DELETE MUSIC] Chiamata API...');
        await apiService.deleteConsiglioMusicale(id);
        console.log('[DELETE MUSIC] Successo!');
        loadConsigliMusicali();
        if (Platform.OS === 'web') {
          alert('Consiglio musicale eliminato!');
        } else {
          Alert.alert('Successo', 'Consiglio musicale eliminato!');
        }
      } catch (e: any) {
        console.error('[DELETE MUSIC] Errore:', e);
        console.error('[DELETE MUSIC] Response:', e.response?.data);
        const errorMsg = e.response?.data?.detail || e.message || 'Impossibile eliminare';
        if (Platform.OS === 'web') {
          alert(`Errore: ${errorMsg}`);
        } else {
          Alert.alert('Errore', errorMsg);
        }
      }
    };
    
    if (Platform.OS === 'web') {
      if (window.confirm('Vuoi eliminare questo consiglio musicale?')) {
        await doDelete();
      }
    } else {
      Alert.alert('Elimina', 'Vuoi eliminare questo consiglio musicale?', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Errore', 'Impossibile aprire il link'));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  // Ottieni l'URL dell'immagine (priorità a base64 se presente)
  const getImageSource = (consiglio: Consiglio) => {
    if (consiglio.immagine_base64) {
      return { uri: consiglio.immagine_base64 };
    }
    if (consiglio.immagine_url) {
      return { uri: consiglio.immagine_url };
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* CURIOSITA DEL GIORNO */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={styles.header}>
            <Ionicons name="bulb" size={24} color={COLORS.warning} />
            <Text style={styles.title}>Curiosità</Text>
          </View>
          <Image source={require('../../assets/images/logo.jpg')} style={{ width: 56, height: 56, borderRadius: 28 }} resizeMode="contain" />
        </View>

        {curiositaDelGiorno && (
          <View style={styles.curiositaCard}>
            <View style={styles.curiositaHeader}>
              <Text style={styles.curiositaEmoji}>{curiositaDelGiorno.emoji}</Text>
              <View style={styles.curiositaBadge}>
                <Text style={styles.curiositaBadgeText}>Oggi</Text>
              </View>
            </View>
            <Text style={styles.curiositaTitolo}>{curiositaDelGiorno.titolo}</Text>
            <Text style={styles.curiositaTesto}>{curiositaDelGiorno.testo}</Text>
            <Text style={styles.curiositaCategoria}>{curiositaDelGiorno.categoria}</Text>
          </View>
        )}

        {/* IL MAESTRO CONSIGLIA - Consigli Alimentari del Giorno */}
        <View style={styles.maestroCard}>
          <View style={styles.maestroHeader}>
            <View style={styles.maestroIconContainer}>
              <Ionicons name={(getConsiglioAlimentare().icon as any) || "nutrition"} size={24} color="#FFF" />
            </View>
            <View>
              <Text style={styles.maestroTitle}>Il Maestro Consiglia</Text>
              <Text style={styles.maestroSubtitle}>Consiglio alimentare del giorno</Text>
            </View>
          </View>
          <Text style={styles.maestroConsiglio}>"{getConsiglioAlimentare().consiglio}"</Text>
        </View>

        {/* CONSIGLI MUSICALI */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="musical-notes" size={22} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Consigli Musicali</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity style={styles.addButton} onPress={() => setShowMusicModal(true)}>
              <Ionicons name="add" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.musicSubtitle}>La musica è una cosa seria 🎵</Text>

        {consigliMusicali.length === 0 ? (
          <View style={styles.emptyConsigli}>
            <Ionicons name="musical-notes-outline" size={40} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Nessun consiglio musicale</Text>
          </View>
        ) : (
          consigliMusicali.map((cm) => (
            <TouchableOpacity 
              key={cm.id} 
              style={styles.musicCard}
              onPress={() => openLink(cm.spotify_url)}
            >
              <View style={styles.musicIconContainer}>
                <Image 
                  source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Spotify_icon.svg/232px-Spotify_icon.svg.png' }}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.musicContent}>
                <Text style={styles.musicTitle}>{cm.titolo || 'Ascolta su Spotify'}</Text>
                <Text style={styles.musicUrl} numberOfLines={1}>{cm.spotify_url}</Text>
              </View>
              {isAdmin && (
                <TouchableOpacity 
                  style={styles.musicDeleteBtn}
                  onPress={(e) => { e.stopPropagation(); deleteConsiglioMusicale(cm.id); }}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}

        {/* CONSIGLI DEL MAESTRO */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="megaphone" size={22} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Bacheca del Maestro</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
              <Ionicons name="add" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        {consigli.length === 0 ? (
          <View style={styles.emptyConsigli}>
            <Ionicons name="document-text-outline" size={40} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Nessun consiglio pubblicato</Text>
          </View>
        ) : (
          consigli.map((consiglio) => {
            const imageSource = getImageSource(consiglio);
            return (
              <View key={consiglio.id} style={styles.consiglioCard}>
                {isAdmin && (
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => handleDeleteConsiglio(consiglio.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                )}
                
                <Text style={styles.consiglioData}>{formatDate(consiglio.created_at)}</Text>
                
                {consiglio.testo && (
                  <Text style={styles.consiglioTesto}>
                    {renderTextWithLinks(consiglio.testo)}
                  </Text>
                )}
                
                {imageSource && (
                  <Image 
                    source={imageSource} 
                    style={styles.consiglioImmagine}
                    resizeMode="cover"
                  />
                )}
                
                {consiglio.spotify_url && (
                  <TouchableOpacity 
                    style={styles.spotifyButton}
                    onPress={() => openLink(consiglio.spotify_url!)}
                  >
                    <Ionicons name="musical-notes" size={20} color="#1DB954" />
                    <Text style={styles.spotifyText}>Ascolta su Spotify</Text>
                    <Ionicons name="open-outline" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        {/* MODAL NUOVO CONSIGLIO */}
        <Modal visible={showModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Nuovo Consiglio</Text>
                
                <Text style={styles.inputLabel}>Messaggio</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Scrivi qualcosa ai tuoi clienti... I link saranno cliccabili"
                  placeholderTextColor={COLORS.textSecondary}
                  value={nuovoTesto}
                  onChangeText={setNuovoTesto}
                  multiline
                  numberOfLines={4}
                />
                
                {/* SEZIONE IMMAGINE - Solo pulsante allega */}
                {selectedImageBase64 ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: selectedImageBase64 }} style={styles.imagePreview} />
                    <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                      <Ionicons name="close-circle" size={28} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
                    <Ionicons name="attach" size={22} color={COLORS.text} />
                    <Text style={styles.attachButtonText}>Allega immagine</Text>
                  </TouchableOpacity>
                )}
                
                <Text style={styles.inputLabel}>Link Spotify (opzionale)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://open.spotify.com/..."
                  placeholderTextColor={COLORS.textSecondary}
                  value={nuovoSpotify}
                  onChangeText={setNuovoSpotify}
                  autoCapitalize="none"
                />
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={styles.cancelButton} 
                    onPress={() => {
                      setShowModal(false);
                      setSelectedImageBase64(null);
                    }}
                    disabled={isUploading}
                  >
                    <Text style={styles.cancelButtonText}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.publishButton, isUploading && styles.publishButtonDisabled]} 
                    onPress={handleCreateConsiglio}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.publishButtonText}>Pubblica</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Modal Aggiungi Consiglio Musicale */}
        <Modal
          visible={showMusicModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMusicModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🎵 Aggiungi Consiglio Musicale</Text>
              
              <Text style={styles.inputLabel}>Titolo (opzionale)</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: Perfetta per l'allenamento!"
                placeholderTextColor={COLORS.textSecondary}
                value={nuovoMusicTitolo}
                onChangeText={setNuovoMusicTitolo}
              />
              
              <Text style={styles.inputLabel}>Link Spotify *</Text>
              <TextInput
                style={styles.input}
                placeholder="https://open.spotify.com/track/..."
                placeholderTextColor={COLORS.textSecondary}
                value={nuovoMusicSpotify}
                onChangeText={setNuovoMusicSpotify}
                autoCapitalize="none"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => {
                    setShowMusicModal(false);
                    setNuovoMusicTitolo('');
                    setNuovoMusicSpotify('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.publishButton} 
                  onPress={addConsiglioMusicale}
                >
                  <Text style={styles.publishButtonText}>Aggiungi</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 16, paddingBottom: 32 },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  
  // Curiosita Card
  curiositaCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  curiositaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  curiositaEmoji: { fontSize: 32 },
  curiositaBadge: { backgroundColor: COLORS.warning + '30', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  curiositaBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.warning },
  curiositaTitolo: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  curiositaTesto: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  curiositaCategoria: { fontSize: 11, color: COLORS.textSecondary, marginTop: 10 },
  
  // Section Header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  addButton: { backgroundColor: COLORS.primary, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  
  // Empty State
  emptyConsigli: { alignItems: 'center', paddingVertical: 40, backgroundColor: COLORS.card, borderRadius: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 10 },
  
  // Consiglio Card
  consiglioCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  deleteButton: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  consiglioData: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 },
  consiglioTesto: { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 12 },
  consiglioImmagine: { width: '100%', height: 180, borderRadius: 10, marginBottom: 12 },
  spotifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1DB954' + '20',
    padding: 12,
    borderRadius: 10,
  },
  spotifyText: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  
  // Link text style
  linkText: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16, textAlign: 'center' },
  inputLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelButton: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.background },
  cancelButtonText: { fontSize: 14, color: COLORS.textSecondary },
  publishButton: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.primary },
  publishButtonDisabled: { opacity: 0.7 },
  publishButtonText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  
  // Image attach button
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  attachButtonText: {
    fontSize: 14,
    color: COLORS.text,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginTop: 8,
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: COLORS.card,
    borderRadius: 14,
  },
  
  // Il Maestro Consiglia
  maestroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  maestroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  maestroIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maestroTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  maestroSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  maestroConsiglio: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 24,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  
  // Consigli Musicali
  musicSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
    marginTop: -8,
  },
  musicCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1DB954' + '40',
  },
  musicIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1DB954' + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  musicContent: {
    flex: 1,
  },
  musicTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  musicUrl: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  musicDeleteBtn: {
    padding: 8,
  },
});
