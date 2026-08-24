import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';
import { OrariSchemaModal } from './NuoviOrariBanner';

/**
 * PAUSA ESTIVA 2026: venerdì 28/08 ultima giornata prenotabile.
 * Dal 29/08 al 06/09 nessuna lezione. Domenica 06/09 alle 9:00 riaprono le
 * prenotazioni per la settimana 7-12/09 (nuova stagione invernale 2026/27,
 * fino a fine maggio 2027).
 */

export const PAUSA_INIZIO = '2026-08-29';
export const PAUSA_FINE = '2026-09-06';
const RIPARTENZA = new Date(2026, 8, 7); // lunedì 7 settembre 2026

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const isDataInPausa = (dateStr: string) => dateStr >= PAUSA_INIZIO && dateStr <= PAUSA_FINE;

// La schermata pausa nel tab Prenota: attiva dal 29/08 fino a domenica 06/09 alle 9:00
// (quando riaprono le prenotazioni per la settimana successiva)
export const pausaEstivaInCorso = (): boolean => {
  const now = new Date();
  const s = toDateStr(now);
  if (s < PAUSA_INIZIO || s > PAUSA_FINE) return false;
  if (s === PAUSA_FINE && now.getHours() >= 9) return false;
  return true;
};

// Il banner in home è visibile già da prima (avviso) e per tutta la pausa
export const pausaBannerVisibile = (): boolean => {
  const s = toDateStr(new Date());
  return s >= '2026-08-24' && s <= PAUSA_FINE;
};

const giorniAllaRipartenza = (): number =>
  Math.max(0, Math.ceil((RIPARTENZA.getTime() - Date.now()) / 86400000));

// ---------- Schermata a tutto tab (Prenota) durante la pausa ----------
export const PausaEstivaScreen: React.FC = () => {
  const [showSchema, setShowSchema] = useState(false);
  const giorni = giorniAllaRipartenza();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={styles.screenScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.screenCard} testID="pausa-estiva-screen">
        <View style={styles.iconCircle}>
          <Ionicons name="sunny" size={52} color="#FFD54F" />
        </View>
        <Text style={styles.screenTitle}>PAUSA ESTIVA</Text>
        <View style={styles.accentBar} />
        <Text style={styles.screenText}>
          Ci prendiamo qualche giorno per ricaricare le batterie e preparare al meglio la nuova stagione! 🏖️
          {'\n\n'}
          Le attività riprendono <Text style={styles.bold}>LUNEDÌ 7 SETTEMBRE</Text> con la
          programmazione invernale 2026/27, che ci accompagnerà fino a{' '}
          <Text style={styles.bold}>fine maggio 2027</Text>.
        </Text>

        <View style={styles.countdownBox} testID="pausa-countdown">
          <Text style={styles.countdownNum}>{giorni}</Text>
          <Text style={styles.countdownLabel}>{giorni === 1 ? 'GIORNO ALLA RIPARTENZA' : 'GIORNI ALLA RIPARTENZA'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color="#00C8FF" />
          <Text style={styles.infoText}>
            Le prenotazioni riaprono <Text style={[styles.bold, { color: '#00C8FF' }]}>domenica 6 settembre alle 9:00</Text>
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setShowSchema(true)}
          style={styles.cta}
          activeOpacity={0.85}
          testID="pausa-vedi-orari"
        >
          <Ionicons name="calendar" size={20} color="#000" />
          <Text style={styles.ctaText}>GUARDA I NUOVI ORARI</Text>
        </TouchableOpacity>

        <Text style={styles.screenFooter}>Ci vediamo prestissimo! 💪 — Daniele</Text>
      </View>
      <OrariSchemaModal visible={showSchema} onClose={() => setShowSchema(false)} />
    </ScrollView>
  );
};

// ---------- Banner in Home (avviso pre-pausa + countdown durante) ----------
export const PausaEstivaBanner: React.FC = () => {
  const [showSchema, setShowSchema] = useState(false);
  if (!pausaBannerVisibile()) return null;
  const inPausa = toDateStr(new Date()) >= PAUSA_INIZIO;
  const giorni = giorniAllaRipartenza();
  return (
    <>
      <TouchableOpacity style={styles.banner} onPress={() => setShowSchema(true)} activeOpacity={0.85} testID="pausa-estiva-banner">
        <View style={styles.bannerStripe} />
        <View style={styles.bannerRow}>
          <View style={styles.bannerIconCircle}>
            <Ionicons name="sunny" size={24} color="#FFD54F" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>PAUSA ESTIVA</Text>
            <Text style={styles.bannerSub}>
              {inPausa
                ? `Si riparte lunedì 7 settembre — mancano ${giorni} giorni! Tocca per i nuovi orari`
                : 'Venerdì 28/8 ultima giornata! Si riparte lunedì 7/9 — tocca per i nuovi orari'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#FFD54F" />
        </View>
      </TouchableOpacity>
      <OrariSchemaModal visible={showSchema} onClose={() => setShowSchema(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  screenScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    paddingBottom: 40,
  },
  screenCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD54F',
    padding: 24,
    alignItems: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#FFD54F',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#FFD54F',
    backgroundColor: 'rgba(255,213,79,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  screenTitle: {
    fontFamily: FONTS.headline,
    fontSize: 38,
    color: '#FFD54F',
    letterSpacing: 2.5,
    textShadowColor: '#FFD54F80',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  accentBar: {
    width: 56,
    height: 3,
    backgroundColor: '#FFD54F',
    borderRadius: 2,
    marginVertical: 12,
  },
  screenText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 23,
  },
  bold: { fontFamily: FONTS.bodyBlack, color: '#FFD54F' },
  countdownBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,213,79,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,213,79,0.5)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 34,
    marginTop: 18,
  },
  countdownNum: {
    fontFamily: FONTS.headline,
    fontSize: 52,
    color: '#FFD54F',
    lineHeight: 56,
  },
  countdownLabel: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  infoText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFD54F',
    paddingVertical: 13,
    paddingHorizontal: 26,
    borderRadius: 12,
    marginTop: 18,
  },
  ctaText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 14,
    color: '#000',
    letterSpacing: 1.2,
  },
  screenFooter: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  banner: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFD54F',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#FFD54F',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  bannerStripe: { height: 4, backgroundColor: '#FFD54F' },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  bannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,213,79,0.12)',
    borderWidth: 2,
    borderColor: '#FFD54F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: {
    fontFamily: FONTS.headline,
    fontSize: 20,
    color: '#FFD54F',
    letterSpacing: 1.2,
  },
  bannerSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
