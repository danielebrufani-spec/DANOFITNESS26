import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/utils/constants';
import { FONTS } from '../../src/theme';
import { LessonScheduleManager } from '../../src/components/LessonScheduleManager';

/**
 * Tab "Orari" — gestione orario settimanale (lezioni + attività).
 * Visibile solo per admin (l'href in _layout.tsx è null per gli altri).
 */
export default function OrariScreen() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState} testID="orari-no-access">
          <Ionicons name="lock-closed" size={44} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Sezione riservata</Text>
          <Text style={styles.emptyText}>Solo l'amministratore può gestire l'orario delle lezioni.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="calendar" size={24} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>ORARI &amp; LEZIONI</Text>
          <Text style={styles.headerSubtitle}>Gestisci l'orario settimanale e le tipologie di attività</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LessonScheduleManager />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${COLORS.primary}22`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.headline,
    fontSize: 22,
    color: COLORS.text,
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: FONTS.headline,
    fontSize: 20,
    color: COLORS.text,
    letterSpacing: 1,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
