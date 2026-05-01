import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
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
        if (l?.biglietti != null) setTickets(l.biglietti);

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
      <View style={[styles.cell, { borderLeftColor: '#00E676' }]}>
        <View style={styles.iconRow}>
          <Text style={styles.flame}>🔥</Text>
        </View>
        <Text style={styles.value}>{streak}</Text>
        <Text style={styles.label}>STREAK</Text>
      </View>

      <View style={styles.divider} />

      {/* Biglietti lotteria */}
      <View style={[styles.cell, { borderLeftColor: COLORS.primary }]}>
        <View style={styles.iconRow}>
          <Ionicons name="ticket" size={18} color={COLORS.primary} />
        </View>
        <Text style={styles.value}>{tickets}</Text>
        <Text style={styles.label}>BIGLIETTI</Text>
      </View>

      <View style={styles.divider} />

      {/* Abbonamento */}
      <View style={[styles.cell, { borderLeftColor: '#00B0FF' }]}>
        <View style={styles.iconRow}>
          <Ionicons name="time" size={18} color="#00B0FF" />
        </View>
        {lessonsLeft != null ? (
          <>
            <Text style={styles.value}>{lessonsLeft}</Text>
            <Text style={styles.label}>LEZIONI</Text>
          </>
        ) : days != null ? (
          <>
            <Text style={styles.value}>{days}</Text>
            <Text style={styles.label}>{days === 1 ? 'GIORNO' : 'GIORNI'}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.value, { fontSize: 16 }]}>—</Text>
            <Text style={styles.label}>ABBONAM.</Text>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface || '#141416',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 78,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderLeftWidth: 3,
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
    fontSize: 26,
    color: COLORS.text,
    letterSpacing: 1,
    lineHeight: 30,
  },
  label: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 1.4,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: '60%',
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
});

export default KPIBanner;
