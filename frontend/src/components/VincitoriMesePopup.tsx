import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { apiService } from '../services/api';
import { FONTS } from '../theme';
import { requestPopup, releasePopup } from '../utils/popupQueue';

const fmtTempo = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
};

export const VincitoriMesePopup: React.FC = () => {
  const [step, setStep] = useState<'hidden' | 'annuncio' | 'dettaglio'>('hidden');
  const [dati, setDati] = useState<any>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await apiService.getUltimaEstrazione();
        const d = r.data;
        if (!d.esiste || !d.vincitori || d.vincitori.length === 0) return;
        const key = `vincitori_popup_${d.mese}`;
        if (Platform.OS === 'web') {
          try {
            if (window.localStorage.getItem(key)) return;
          } catch {}
        }
        setDati(d);
        requestPopup('vincitori-mese', () => setStep('annuncio'));
      } catch {}
    };
    check();
  }, []);

  const segnaVisto = () => {
    if (dati && Platform.OS === 'web') {
      try { window.localStorage.setItem(`vincitori_popup_${dati.mese}`, '1'); } catch {}
    }
  };

  const chiudi = () => {
    segnaVisto();
    setStep('hidden');
    releasePopup('vincitori-mese');
  };

  if (step === 'hidden' || !dati) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={chiudi}>
      <View style={styles.overlay}>
        {step === 'annuncio' ? (
          <View style={styles.annuncioCard} data-testid="vincitori-mese-annuncio">
            <Text style={styles.annuncioEmoji}>🏆</Text>
            <Text style={styles.annuncioTitle}>VINCITORI DEL MESE!</Text>
            <Text style={styles.annuncioSub}>
              L'estrazione di {dati.mese_nome} è stata fatta!{'\n'}Scopri chi ha vinto la lotteria e chi ha vinto il Crono ⏱️ — per lui un premio a sorpresa dal Maestro! 🎁
            </Text>
            <TouchableOpacity style={styles.scopriBtn} onPress={() => { segnaVisto(); setStep('dettaglio'); }} data-testid="vincitori-mese-scopri-btn">
              <Text style={styles.scopriBtnText}>🎉 SCOPRI I VINCITORI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.laterBtn} onPress={chiudi} data-testid="vincitori-mese-chiudi-btn">
              <Text style={styles.laterBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dettaglioCard} data-testid="vincitori-mese-dettaglio">
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.dettaglioTitle}>🏆 VINCITORI DI {String(dati.mese_nome).toUpperCase()}</Text>

              {/* LOTTERIA */}
              <Text style={styles.sezioneTitle}>🎟️ ESTRAZIONE LOTTERIA</Text>
              {dati.vincitori.map((v: any, i: number) => (
                <View key={i} style={[styles.row, v.is_me && styles.rowMe]}>
                  <Text style={styles.rowMedal}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</Text>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowNome}>
                      {v.soprannome || `${v.nome} ${v.cognome}`}{v.is_me ? ' (TU!)' : ''}
                    </Text>
                    <Text style={styles.rowSub}>{v.biglietti} biglietti</Text>
                    {v.premio ? <Text style={styles.rowPremio}>🎁 {v.premio}</Text> : null}
                  </View>
                </View>
              ))}
              <Text style={styles.statline}>
                {dati.totale_partecipanti || '-'} partecipanti · {dati.totale_biglietti || '-'} biglietti totali
              </Text>

              {/* CRONO */}
              {dati.crono_classifica && dati.crono_classifica.length > 0 && (
                <>
                  <Text style={styles.sezioneTitle}>⏱️ CLASSIFICA FINALE CRONO — {String(dati.mese_nome).toUpperCase()}</Text>
                  {dati.crono_classifica.slice(0, 5).map((r: any, i: number) => (
                    <View key={i} style={[styles.row, i === 0 && styles.rowCronoWinner, r.is_me && styles.rowMe]}>
                      <Text style={styles.rowMedal}>{i === 0 ? '👑' : `${i + 1}°`}</Text>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowNome}>{r.nome} {r.cognome}{r.is_me ? ' (TU!)' : ''}</Text>
                        {i === 0 && dati.crono_premio ? (
                          <Text style={styles.rowPremio}>🎁 {dati.crono_premio}</Text>
                        ) : null}
                      </View>
                      <Text style={[styles.rowTempo, r.vinto && styles.rowTempoVinto]}>{fmtTempo(r.elapsed_ms)}</Text>
                    </View>
                  ))}

                  {/* Callout vincitore Crono */}
                  <View style={styles.cronoWinnerBox} data-testid="crono-winner-callout">
                    <Text style={styles.cronoWinnerLabel}>👑 VINCITORE CRONO DEL MESE</Text>
                    <Text style={styles.cronoWinnerNome}>
                      {dati.crono_classifica[0].nome} {dati.crono_classifica[0].cognome}
                      {dati.crono_classifica[0].is_me ? ' (TU!)' : ''}
                    </Text>
                    <Text style={styles.cronoWinnerPremio}>
                      🎁 Per il vincitore un PREMIO A SORPRESA{'\n'}a discrezione del Maestro!
                    </Text>
                    <Text style={styles.cronoWinnerNote}>(senza troppe pretese, eh! 😄)</Text>
                  </View>
                </>
              )}

              <TouchableOpacity style={styles.scopriBtn} onPress={chiudi} data-testid="vincitori-mese-dettaglio-chiudi">
                <Text style={styles.scopriBtnText}>CHIUDI</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  annuncioCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#131316',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 26,
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOpacity: 0.4,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  annuncioEmoji: { fontSize: 52, marginBottom: 6 },
  annuncioTitle: {
    fontFamily: FONTS.headline,
    fontSize: 26,
    color: '#FFD700',
    letterSpacing: 1.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  annuncioSub: { color: '#D7D7DC', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  scopriBtn: {
    width: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  scopriBtnText: { color: '#000', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  laterBtn: { marginTop: 10, paddingVertical: 6 },
  laterBtnText: { color: '#9B9BA3', fontSize: 13 },
  dettaglioCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    backgroundColor: '#131316',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 20,
  },
  dettaglioTitle: {
    fontFamily: FONTS.headline,
    fontSize: 22,
    color: '#FFD700',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 6,
  },
  sezioneTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  rowMe: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.5)',
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  rowCronoWinner: {
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    backgroundColor: 'rgba(255,215,0,0.08)',
  },
  rowMedal: { width: 34, fontSize: 18, textAlign: 'center', color: '#FFF', fontWeight: '800' },
  rowInfo: { flex: 1 },
  rowNome: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  rowSub: { color: '#9B9BA3', fontSize: 11.5, marginTop: 1 },
  rowPremio: { color: '#FFD700', fontSize: 12, marginTop: 3, fontWeight: '700' },
  cronoWinnerBox: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.55)',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    alignItems: 'center',
  },
  cronoWinnerLabel: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  cronoWinnerNome: { color: '#FFD700', fontSize: 17, fontWeight: '900', marginTop: 6 },
  cronoWinnerPremio: { color: '#FFD700', fontSize: 13, fontWeight: '800', marginTop: 6, textAlign: 'center', lineHeight: 19 },
  cronoWinnerNote: { color: '#9B9BA3', fontSize: 11, fontStyle: 'italic', marginTop: 3 },
  rowTempo: { color: '#FFF', fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  rowTempoVinto: { color: '#3DD56D' },
  statline: { color: '#9B9BA3', fontSize: 11.5, textAlign: 'center', marginTop: 4 },
});
