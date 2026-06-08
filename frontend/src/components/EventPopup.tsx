import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';

const EVENT_IMAGE = 'https://customer-assets.emergentagent.com/job_120068e1-741e-430e-86ee-0f10594d3f2d/artifacts/bu3iqahk_image.png';

// Evento valido fino a Sabato 13 Giugno 2026 ore 19:00 (Italia)
const EVENT_DEADLINE = new Date('2026-06-13T19:00:00+02:00');

// WhatsApp del proprietario
const WHATSAPP_NUMBER = '393395020625';
const WHATSAPP_MESSAGE = encodeURIComponent(
  'Ciao Daniele! Vorrei prenotare per l\'apericena + concerto Mobili Trignani di sabato 13 giugno. Siamo in ___ adulti e ___ bambini. Grazie!'
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

// Storage key (giornaliero): se dismissed oggi, non riappare
const STORAGE_KEY_PREFIX = 'event_popup_dismissed_';

function getTodayKey(): string {
  const d = new Date();
  return `${STORAGE_KEY_PREFIX}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isStillActive(): boolean {
  return new Date() < EVENT_DEADLINE;
}

function readDismissed(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return window.localStorage.getItem(getTodayKey()) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  if (Platform.OS !== 'web') return;
  try {
    window.localStorage.setItem(getTodayKey(), '1');
  } catch {
    /* noop */
  }
}

export const EventPopup: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isStillActive()) return;
    if (readDismissed()) return;
    // Mostra dopo un piccolo delay per non saturare l'app appena aperta
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    writeDismissed();
    setVisible(false);
  };

  const openWhatsapp = () => {
    if (Platform.OS === 'web') {
      window.open(WHATSAPP_URL, '_blank');
    } else {
      Linking.openURL(WHATSAPP_URL).catch(() => {});
    }
    writeDismissed();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="event-popup">
          {/* Close X */}
          <TouchableOpacity onPress={close} style={styles.closeBtn} testID="event-popup-close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Locandina */}
            <Image source={{ uri: EVENT_IMAGE }} style={styles.flyer} resizeMode="contain" />

            {/* Titolo */}
            <View style={styles.titleBox}>
              <Text style={styles.kicker}>EVENTO SPECIALE</Text>
              <Text style={styles.title}>MOBILI TRIGNANI{'\n'}IN CONCERTO</Text>
              <View style={styles.accentBar} />
              <Text style={styles.subtitle}>SABATO 13 GIUGNO · Piscina Camping · dalle 20:00</Text>
            </View>

            {/* Info evento */}
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Ionicons name="enter-outline" size={18} color="#00E676" />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Ingresso libero</Text> al concerto
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="restaurant-outline" size={18} color="#FF6B00" />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Apericena</Text> con ricco buffet solo su prenotazione
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="wine-outline" size={18} color="#FFD700" />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Adulti 15€</Text> apericena + 1 drink incluso
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="happy-outline" size={18} color="#00B0FF" />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Bambini 10€</Text>
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="water-outline" size={18} color="#00BFFF" />
                <Text style={styles.infoText}>Tutto a bordo piscina</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="musical-notes-outline" size={18} color="#FF3D7F" />
                <Text style={styles.infoText}>
                  Fantastico <Text style={styles.infoBold}>duo live</Text> da non perdere
                </Text>
              </View>
            </View>

            {/* CTA WhatsApp */}
            <TouchableOpacity
              onPress={openWhatsapp}
              testID="event-popup-whatsapp"
              activeOpacity={0.85}
              style={styles.ctaBtn}
            >
              <Ionicons name="logo-whatsapp" size={22} color="#fff" />
              <Text style={styles.ctaText}>PRENOTA SUBITO</Text>
            </TouchableOpacity>

            <Text style={styles.callTxt}>oppure chiama Daniele · 339 502 0625</Text>

            <TouchableOpacity onPress={close} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Forse più tardi</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default EventPopup;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '95%',
    backgroundColor: COLORS.background,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FF6B00',
    overflow: 'hidden',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { padding: 0, paddingBottom: 20 },
  flyer: {
    width: '100%',
    height: 420,
    backgroundColor: '#000',
  },
  titleBox: { paddingHorizontal: 18, paddingTop: 16, alignItems: 'center' },
  kicker: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 11,
    color: '#FF6B00',
    letterSpacing: 3,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 30,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 1.2,
    lineHeight: 32,
  },
  accentBar: { width: 50, height: 3, backgroundColor: '#FF6B00', marginTop: 10, marginBottom: 8 },
  subtitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.6,
  },

  infoBox: {
    marginHorizontal: 18,
    marginTop: 16,
    padding: 14,
    backgroundColor: COLORS.surface || '#141416',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text, flex: 1, lineHeight: 18 },
  infoBold: { fontFamily: FONTS.bodyBlack, color: COLORS.text },

  ctaBtn: {
    marginHorizontal: 18,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#25D366',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#25D366',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 1.6,
  },
  callTxt: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  secondaryBtn: { alignSelf: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 16 },
  secondaryText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
});
