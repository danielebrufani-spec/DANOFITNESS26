import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';
import { apiService } from '../services/api';

/**
 * Banda KPI in cima alla Home.
 * Mostra: streak fiamma | biglietti lotteria | giorni rimasti abbonamento
 * Si aggiorna ad ogni mount della Home.
 */
export const KPIBanner: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<number>(0);
  const [tickets, setTickets] = useState<number>(0);
  const [days, setDays] = useState<number | null>(null);
  const [lessonsLeft, setLessonsLeft] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [streakRes, lottoRes, subsRes] = await Promise.all([
          apiService.getStreakStatus().catch(() => ({ data: null })),
          apiService.getLotteryStatus().catch(() => ({ data: null })),
          apiService.getMySubscriptions().catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;

        const s: any = streakRes?.data;
        if (s?.streak_attuale != null) setStreak(s.streak_attuale);

        const l: any = lottoRes?.data;
        if (l?.biglietti_utente != null) setTickets(l.biglietti_utente);

        // Trova abbonamento attivo (non scaduto, non prova)
        const subs: any[] = subsRes?.data || [];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const active = subs.find(s => {
          if (s.tipo === 'prova_7gg') return false;
          const sc = s.data_scadenza ? new Date(s.data_scadenza) : null;
          return sc && sc >= today;
        });
        if (active) {
          const isPacchetto = ['lezione_singola', 'lezioni_8', 'lezioni_16'].includes(active.tipo);
          if (isPacchetto && active.lezioni_rimanenti != null) {
            setLessonsLeft(active.lezioni_rimanenti);
            setDays(null);
          } else if (active.data_scadenza) {
            const sc = new Date(active.data_scadenza);
            const diff = Math.max(0, Math.ceil((sc.getTime() - today.getTime()) / 86400000));
            setDays(diff);
            setLessonsLeft(null);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <View style={[styles.wrap, { justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="kpi-banner">
      {/* Streak */}
      <View style={[styles.cell, styles.cellStreak]}>
        <View style={styles.iconRow}>
          <Text style={styles.flame}>🔥</Text>
        </View>
        <Text style={[styles.value, { color: '#39FF14' }]}>{streak}</Text>
        <Text style={styles.label}>STREAK</Text>
      </View>

      {/* Biglietti lotteria */}
      <View style={[styles.cell, styles.cellTickets]}>
        <View style={styles.iconRow}>
          <Ionicons name="ticket" size={20} color="#FFD700" />
        </View>
        <Text style={[styles.value, { color: '#FFD700' }]}>{tickets}</Text>
        <Text style={styles.label}>BIGLIETTI</Text>
      </View>

      {/* Abbonamento */}
      <View style={[styles.cell, styles.cellSub]}>
        <View style={styles.iconRow}>
          <Ionicons name="time" size={20} color={COLORS.primary} />
        </View>
        {lessonsLeft != null ? (
          <>
            <Text style={[styles.value, { color: COLORS.primary }]}>{lessonsLeft}</Text>
            <Text style={styles.label}>LEZIONI</Text>
          </>
        ) : days != null ? (
          <>
            <Text style={[styles.value, { color: COLORS.primary }]}>{days}</Text>
            <Text style={styles.label}>{days === 1 ? 'GIORNO' : 'GIORNI'}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.value, { fontSize: 18, color: COLORS.primary }]}>—</Text>
            <Text style={styles.label}>ABBONAM.</Text>
          </>
        )}
      </View>
    </View>
  );
};

const tileGlow = (color: string) =>
  Platform.select({
    web: { boxShadow: `0 0 14px ${color}` },
    default: {},
  }) as object;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    minHeight: 96,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: '#121216',
  },
  cellStreak: {
    borderColor: 'rgba(57,255,20,0.55)',
    ...tileGlow('rgba(57,255,20,0.22)'),
  },
  cellTickets: {
    borderColor: 'rgba(255,215,0,0.55)',
    ...tileGlow('rgba(255,215,0,0.22)'),
  },
  cellSub: {
    borderColor: 'rgba(255,59,48,0.55)',
    ...tileGlow('rgba(255,59,48,0.22)'),
  },
  iconRow: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  flame: {
    fontSize: 20,
  },
  value: {
    fontFamily: FONTS.headline,
    fontSize: 40,
    color: COLORS.text,
    letterSpacing: 1,
    lineHeight: 42,
  },
  label: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 1.6,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});

export default KPIBanner;
