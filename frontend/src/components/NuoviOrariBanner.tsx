import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';

/**
 * Nuovi Orari Invernali 2026/27 (da lunedì 8 settembre).
 * - NuoviOrariPopup: popup alla PRIMA apertura dell'app (localStorage), con anteprima
 *   dello schema, apertura a schermo intero e salvataggio immagine.
 * - NuoviOrariBanner: banner in evidenza nella home, apre lo schema consultabile.
 */

const IMG_URL = '/orari-invernali-2026.png';
const IMG_RATIO = 1024 / 572;
const SEEN_KEY = 'nuovi_orari_2026_popup_seen';

const downloadImage = () => {
  if (Platform.OS !== 'web') return;
  try {
    const a = document.createElement('a');
    a.href = IMG_URL;
    a.download = 'orari-invernali-danofitness23.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    /* noop */
  }
};

// ---------- Visualizzatore schema a schermo intero ----------
export const OrariSchemaModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const { width } = useWindowDimensions();
  if (!visible) return null;
  const imgWidth = Math.min(width - 16, 900);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerOverlay} testID="orari-schema-modal">
        <View style={styles.viewerHeader}>
          <Text style={styles.viewerTitle}>ORARI INVERNALI 2026/27</Text>
          <TouchableOpacity onPress={onClose} style={styles.viewerCloseBtn} testID="orari-close-btn" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.viewerImageWrap}>
          <Image
            source={{ uri: IMG_URL }}
            style={{ width: imgWidth, height: imgWidth / IMG_RATIO, borderRadius: 12 }}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.viewerSub}>In vigore da lunedì 8 settembre</Text>
        <TouchableOpacity onPress={downloadImage} style={styles.saveBtn} activeOpacity={0.85} testID="orari-save-btn">
          <Ionicons name="download" size={20} color="#000" />
          <Text style={styles.saveBtnText}>SALVA IMMAGINE</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// ---------- Popup alla prima apertura ----------
export const NuoviOrariPopup: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [showSchema, setShowSchema] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) setVisible(true);
    } catch {
      /* noop */
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* noop */
    }
    setShowSchema(false);
    setVisible(false);
  };

  return (
    <>
      <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
        <View style={styles.overlay}>
          <View style={styles.card} testID="nuovi-orari-popup">
            <TouchableOpacity onPress={dismiss} style={styles.closeBtn} testID="nuovi-orari-popup-close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.iconHero}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar" size={40} color="#FF6B00" />
              </View>
            </View>

            <Text style={styles.title}>NUOVI ORARI!</Text>
            <View style={styles.accentBar} />
            <Text style={styles.subtitle}>
              Da <Text style={styles.bold}>lunedì 8 settembre</Text> entra in vigore l'orario invernale 2026/27.
              Tocca lo schema per vederlo a schermo intero e salvarlo sul telefono!
            </Text>

            {/* Anteprima cliccabile dello schema */}
            <TouchableOpacity onPress={() => setShowSchema(true)} activeOpacity={0.85} testID="nuovi-orari-popup-preview">
              <View style={styles.previewWrap}>
                <Image source={{ uri: IMG_URL }} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.previewOverlay}>
                  <Ionicons name="expand" size={26} color="#fff" />
                  <Text style={styles.previewOverlayText}>TOCCA PER INGRANDIRE</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowSchema(true)} style={styles.cta} activeOpacity={0.85} testID="nuovi-orari-popup-view">
              <Ionicons name="eye" size={20} color="#000" />
              <Text style={styles.ctaText}>GUARDA LO SCHEMA</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={dismiss} style={styles.laterBtn} activeOpacity={0.7} testID="nuovi-orari-popup-dismiss">
              <Text style={styles.laterBtnText}>OK, visto! Lo ritrovi in Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <OrariSchemaModal visible={showSchema} onClose={() => setShowSchema(false)} />
    </>
  );
};

// ---------- Banner in evidenza nella Home ----------
export const NuoviOrariBanner: React.FC = () => {
  const [showSchema, setShowSchema] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.banner} onPress={() => setShowSchema(true)} activeOpacity={0.85} testID="nuovi-orari-banner">
        <View style={styles.bannerTopStripe} />
        <View style={styles.bannerRow}>
          <View style={styles.bannerIconCircle}>
            <Ionicons name="calendar" size={26} color="#FF6B00" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>NUOVI ORARI 2026/27</Text>
            <Text style={styles.bannerSub}>Da lunedì 8 settembre — tocca per vedere lo schema</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#FF6B00" />
        </View>
      </TouchableOpacity>
      <OrariSchemaModal visible={showSchema} onClose={() => setShowSchema(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  // Popup
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FF6B00',
    padding: 20,
    paddingTop: 24,
    position: 'relative',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconHero: { alignItems: 'center', marginBottom: 6 },
  iconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: '#FF6B00',
    backgroundColor: 'rgba(255,107,0,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 32,
    color: '#FF6B00',
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 6,
    textShadowColor: '#FF6B0099',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  accentBar: {
    width: 50,
    height: 3,
    backgroundColor: '#FF6B00',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 2,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 14,
  },
  bold: { fontFamily: FONTS.bodyBlack, color: '#FF6B00' },
  previewWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.5)',
    marginBottom: 14,
  },
  previewImage: {
    width: '100%',
    aspectRatio: IMG_RATIO,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  previewOverlayText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 11,
    color: '#fff',
    letterSpacing: 1.2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#FF6B00',
  },
  ctaText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 15,
    color: '#000',
    letterSpacing: 1.2,
  },
  laterBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 6 },
  laterBtnText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  // Viewer
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 900,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  viewerTitle: {
    fontFamily: FONTS.headline,
    fontSize: 24,
    color: '#FF6B00',
    letterSpacing: 1.5,
  },
  viewerCloseBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImageWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.4)',
  },
  viewerSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 10,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF6B00',
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginTop: 14,
  },
  saveBtnText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 15,
    color: '#000',
    letterSpacing: 1.2,
  },
  // Banner home
  banner: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FF6B00',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  bannerTopStripe: {
    height: 4,
    backgroundColor: '#FF6B00',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  bannerIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,107,0,0.12)',
    borderWidth: 2,
    borderColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: {
    fontFamily: FONTS.headline,
    fontSize: 20,
    color: '#FF6B00',
    letterSpacing: 1.2,
  },
  bannerSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
