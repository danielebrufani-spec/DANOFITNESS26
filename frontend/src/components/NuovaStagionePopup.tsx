import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, FITNESS_IMAGES } from '../utils/constants';
import { FONTS } from '../theme';
import { useAuth } from '../context/AuthContext';

const POPUP_DAL = '2026-09-07';
const POPUP_AL = '2026-09-21';
const LS_KEY = 'stagione_2026_popup_seen';

const oggiStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const NuovaStagionePopup: React.FC = () => {
  const { user, isAdmin, isIstruttore, loading: authLoading } = useAuth();
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    if (isAdmin || isIstruttore || user.archived) return;
    const oggi = oggiStr();
    if (oggi < POPUP_DAL || oggi > POPUP_AL) return;
    if (Platform.OS === 'web') {
      try {
        if (window.localStorage.getItem(LS_KEY)) return;
      } catch {}
    }
    setVisible(true);
  }, [authLoading, user, isAdmin, isIstruttore]);

  if (!visible) return null;

  const dismiss = () => {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(LS_KEY, '1'); } catch {}
    }
    setVisible(false);
  };

  const goPrenota = () => {
    dismiss();
    router.push('/prenota');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="nuova-stagione-popup">
          <Image source={{ uri: FITNESS_IMAGES.hero }} style={styles.heroImg} resizeMode="cover" />
          <View style={styles.heroShade} />
          <View style={styles.heroTextWrap}>
            <Text style={styles.kicker}>🎉 SI RIPARTE! 🎉</Text>
            <Text style={styles.title}>NUOVA STAGIONE</Text>
            <Text style={styles.year}>2026/27</Text>
          </View>

          <View style={styles.body}>
            <View style={styles.row}>
              <Text style={styles.rowEmoji}>📅</Text>
              <Text style={styles.rowText}>
                <Text style={styles.rowBold}>Nuovi orari da lunedì 7</Text> — Pilates con Toto e Interval Step con Chiara!
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowEmoji}>🎟️</Text>
              <Text style={styles.rowText}>
                <Text style={styles.rowBold}>Lotteria mensile azzerata</Text> — si riparte da 0, prima estrazione il 1° ottobre!
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowEmoji}>📄</Text>
              <Text style={styles.rowText}>
                <Text style={styles.rowBold}>Certificato medico</Text> — ricorda di caricarlo dal profilo!
              </Text>
            </View>

            <TouchableOpacity style={styles.ctaBtn} onPress={goPrenota} activeOpacity={0.85} testID="nuova-stagione-prenota">
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.ctaText}>PRENOTA LA PRIMA LEZIONE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissBtn} onPress={dismiss} testID="nuova-stagione-close">
              <Text style={styles.dismissText}>Si parte! 🔥</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0A0A0C',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    ...Platform.select({ web: { boxShadow: '0 0 34px rgba(255,59,48,0.45)' }, default: {} }),
  },
  heroImg: {
    width: '100%',
    height: 170,
  },
  heroShade: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 170,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroTextWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kicker: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 2,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 4,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 34,
    color: '#fff',
    letterSpacing: 3,
    lineHeight: 36,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 6,
  },
  year: {
    fontFamily: FONTS.headline,
    fontSize: 44,
    color: '#FF3B30',
    letterSpacing: 2,
    lineHeight: 46,
    textShadowColor: 'rgba(255,59,48,0.6)',
    textShadowRadius: 12,
  },
  body: {
    padding: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#121216',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262633',
    padding: 12,
    marginBottom: 8,
  },
  rowEmoji: {
    fontSize: 20,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  rowBold: {
    color: '#fff',
    fontWeight: '800',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    ...Platform.select({ web: { boxShadow: '0 4px 16px rgba(255,59,48,0.45)' }, default: {} }),
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  dismissText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
});
