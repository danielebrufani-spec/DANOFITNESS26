import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { FONTS } from '../theme';

const VISIBILE_FINO_AL = '2026-11-30';

export const TabataPromoBanner: React.FC = () => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const oggi = new Date().toISOString().slice(0, 10);
  if (oggi > VISIBILE_FINO_AL) return null;

  return (
    <View style={styles.card} data-testid="tabata-promo-banner">
      <Animated.View style={[styles.badge, { opacity: pulse }]}>
        <Text style={styles.badgeText}>⚡ NOVITÀ IN ORARIO ⚡</Text>
      </Animated.View>
      <Text style={styles.title}>🔥 TABATA con TOTO 🔥</Text>
      <Text style={styles.quando}>Da venerdì 7 novembre — ogni venerdì ore 8:30</Text>
      <Text style={styles.body}>
        20 secondi a tutta, 10 per respirare… e si riparte! 😮‍💨{'\n'}
        Lavori funzionali con i piccoli attrezzi: <Text style={styles.bold}>niente coreografie da ballerina</Text> 🩰 — servono solo gambe, cuore e tanta volontà.
      </Text>
      <Text style={styles.body}>
        Vi aspetta la <Text style={styles.bold}>Regina del Tabata</Text>: è tremenda, ma vi farà innamorare della fatica. 💪
      </Text>
      <Text style={styles.footer}>📅 Dal 7 novembre la trovi nel calendario prenotazioni</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1206',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#FFD700',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0252F',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 24,
    color: '#FFD700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  quando: { color: '#FFF', fontSize: 14, fontWeight: '800', marginBottom: 10 },
  body: { color: '#E8E2D5', fontSize: 13.5, lineHeight: 21, marginBottom: 8 },
  bold: { fontWeight: '900', color: '#FFD700' },
  footer: { color: '#9B9BA3', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
});
