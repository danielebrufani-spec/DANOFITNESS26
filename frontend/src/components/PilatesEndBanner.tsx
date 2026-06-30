import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';

/**
 * Banner "Fine corso Pilates" — visibile in home fino a sabato 28 giugno.
 * Si nasconde automaticamente dopo il deadline.
 */

// Deadline: sabato 4 luglio 2026 ore 23:59
const DEADLINE = new Date(2026, 6, 4, 23, 59, 0); // mese 6 = luglio (0-indexed)

const isStillActive = (): boolean => {
  return new Date() < DEADLINE;
};

export const PilatesEndBanner: React.FC = () => {
  if (!isStillActive()) return null;

  return (
    <View style={styles.card} testID="pilates-end-banner">
      <View style={styles.glow} />
      <View style={styles.iconBox}>
        <Ionicons name="leaf-outline" size={28} color="#FF1493" />
      </View>
      <View style={styles.content}>
        <Text style={styles.kicker}>ULTIMA LEZIONE</Text>
        <Text style={styles.title}>CORSO PILATES CONCLUSO</Text>
        <Text style={styles.message}>
          Stasera l'ultima lezione del corso! 🧘‍♀️{'\n'}
          Il corso <Text style={styles.bold}>riprenderà la prossima stagione invernale</Text>.
        </Text>
        <View style={styles.cta}>
          <Ionicons name="calendar-outline" size={14} color="#FFEA00" />
          <Text style={styles.ctaText}>Vi aspettiamo a SETTEMBRE!</Text>
        </View>
      </View>
    </View>
  );
};

export default PilatesEndBanner;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#FF1493',
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#FF1493',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  glow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,20,147,0.15)',
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,20,147,0.12)',
    borderWidth: 1.5,
    borderColor: '#FF1493',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  kicker: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 10,
    color: '#FFEA00',
    letterSpacing: 2.4,
    marginBottom: 2,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 18,
    color: COLORS.text,
    letterSpacing: 1,
    lineHeight: 20,
    marginBottom: 6,
  },
  message: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  bold: {
    fontFamily: FONTS.bodyBlack,
    color: '#FF1493',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,234,0,0.15)',
    borderWidth: 1,
    borderColor: '#FFEA00',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ctaText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 11,
    color: '#FFEA00',
    letterSpacing: 1.2,
  },
});
