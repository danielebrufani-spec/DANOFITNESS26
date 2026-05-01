import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/utils/constants';
import { FONTS } from '../../src/theme';

type Section = {
  key: string;
  label: string;
  sub: string;
  icon: any;
  color: string;
  route: string;
  show: (auth: { isAdmin: boolean; isIstruttore: boolean; isArchived: boolean }) => boolean;
};

const SECTIONS: Section[] = [
  {
    key: 'maestro',
    label: 'CHIEDI AL MAESTRO',
    sub: 'Amore, sesso e lavoro — risponde sarcastico',
    icon: 'chatbubble-ellipses',
    color: '#FF3D7F',
    route: '/maestro',
    show: ({ isIstruttore, isArchived }) => !isIstruttore && !isArchived,
  },
  {
    key: 'alimentazione',
    label: 'DIETA AI',
    sub: 'Piano nutrizione',
    icon: 'nutrition',
    color: '#00E676',
    route: '/alimentazione',
    show: ({ isArchived }) => !isArchived,
  },
  {
    key: 'classifica',
    label: 'CLASSIFICA',
    sub: 'Settimanale',
    icon: 'trophy',
    color: '#FFD700',
    route: '/classifica',
    show: ({ isArchived }) => !isArchived,
  },
  {
    key: 'curiosita',
    label: 'CURIOSITÀ',
    sub: 'Bacheca e Consigli Musicali del Maestro',
    icon: 'bulb',
    color: '#FFB300',
    route: '/curiosita',
    show: ({ isIstruttore, isArchived }) => !isIstruttore && !isArchived,
  },
  {
    key: 'eventi',
    label: 'EVENTI',
    sub: 'Piscina Camping',
    icon: 'musical-notes',
    color: '#FF6B00',
    route: '/eventi',
    show: ({ isArchived }) => !isArchived,
  },
  {
    key: 'abbonamento',
    label: 'ABBONAMENTO',
    sub: 'Stato e scadenza',
    icon: 'card',
    color: '#00B0FF',
    route: '/abbonamento',
    show: ({ isAdmin, isIstruttore, isArchived }) => !isAdmin && !isIstruttore && !isArchived,
  },
  {
    key: 'profilo',
    label: 'PROFILO',
    sub: 'Account & impostazioni',
    icon: 'person',
    color: '#A78BFA',
    route: '/profilo',
    show: () => true,
  },
];

function GridCard({ section, onPress, delay }: { section: Section; onPress: () => void; delay: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 360, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, translate, delay]);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, friction: 6 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  return (
    <Animated.View
      style={{
        flexBasis: '48%',
        opacity: fade,
        transform: [{ translateY: translate }, { scale }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        testID={`altro-card-${section.key}`}
        style={[styles.card, { borderColor: section.color + '60' }]}
      >
        <View style={[styles.cardGlow, { backgroundColor: section.color }]} />
        <View style={[styles.iconWrap, { backgroundColor: section.color + '22', borderColor: section.color }]}>
          <Ionicons name={section.icon} size={28} color={section.color} />
        </View>
        <Text style={styles.cardLabel}>{section.label}</Text>
        <Text style={styles.cardSub}>{section.sub}</Text>
        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={14} color={section.color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AltroScreen() {
  const router = useRouter();
  const { isAdmin, isIstruttore, user } = useAuth();
  const isArchived = user?.archived === true;

  const visible = SECTIONS.filter((s) => s.show({ isAdmin, isIstruttore, isArchived }));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.kicker}>EXTRA</Text>
          <Text style={styles.title}>ALTRO</Text>
          <View style={styles.accentBar} />
          <Text style={styles.subtitle}>Tutto quello che ti serve, in un colpo d'occhio.</Text>
        </View>

        <View style={styles.grid}>
          {visible.map((s, idx) => (
            <GridCard
              key={s.key}
              section={s}
              delay={idx * 60}
              onPress={() => router.push(s.route as any)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 18, paddingBottom: 120 },
  header: { marginBottom: 24 },
  kicker: { fontFamily: FONTS.bodyBlack, fontSize: 12, color: COLORS.primary, letterSpacing: 3, marginBottom: 4 },
  title: { fontFamily: FONTS.headline, fontSize: 48, color: COLORS.text, letterSpacing: 2, lineHeight: 50 },
  accentBar: { width: 60, height: 4, backgroundColor: COLORS.primary, marginTop: 8, marginBottom: 12 },
  subtitle: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  card: {
    backgroundColor: COLORS.surface || '#141416',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    minHeight: 150,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  cardGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  cardLabel: {
    fontFamily: FONTS.headline,
    fontSize: 18,
    color: COLORS.text,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  cardSub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 0.4,
  },
  arrow: {
    position: 'absolute',
    bottom: 14,
    right: 14,
  },
});
