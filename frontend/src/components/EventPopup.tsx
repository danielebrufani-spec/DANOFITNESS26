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
            {/* Locandina - intera, non cropped */}
            <View style={styles.flyerWrap}>
              <Image source={{ uri: EVENT_IMAGE }} style={styles.flyer} resizeMode="contain" />
            </View>

            {/* Titolo */}
            <View style={styles.titleBox}>
              <Text style={styles.kicker}>EVENTO SPECIALE</Text>
              <Text style={styles.title}>MOBILI TRIGNANI{'\n'}IN CONCERTO</Text>
              <View style={styles.accentBar} />
              <Text style={styles.subtitle}>SABATO 13 GIUGNO · Piscina Camping · dalle 20:00</Text>
            </View>

            {/* Info evento - compatte per mobile */}
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Ionicons name="enter-outline" size={16} color="#00E676" />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Ingresso libero</Text> al concerto · A bordo piscina
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="restaurant-outline" size={16} color="#FF6B00" />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Apericena + ricco buffet</Text> solo su prenotazione
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="wine-outline" size={16} color="#FFD700" />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>15€ adulti</Text> (+1 drink) · <Text style={styles.infoBold}>10€ bambini</Text>
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="musical-notes-outline" size={16} color="#FF3D7F" />
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
    maxWidth: 380,
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
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { padding: 0, paddingBottom: 12 },
  flyerWrap: {
    width: '100%',
    height: 280,
    backgroundColor: '#FFF5EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flyer: {
    width: '100%',
    height: 280,
  },
  titleBox: { paddingHorizontal: 14, paddingTop: 10, alignItems: 'center' },
  kicker: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 12,
    color: '#FF6B00',
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 22,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 24,
  },
  accentBar: { width: 40, height: 3, backgroundColor: '#FF6B00', marginTop: 6, marginBottom: 6 },
  subtitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  infoBox: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 10,
    backgroundColor: COLORS.surface || '#141416',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, flex: 1, lineHeight: 16 },
  infoBold: { fontFamily: FONTS.bodyBlack, color: COLORS.text },

  ctaBtn: {
    marginHorizontal: 14,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#25D366',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 1.4,
  },
  callTxt: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  secondaryBtn: { alignSelf: 'center', marginTop: 8, paddingVertical: 4, paddingHorizontal: 14 },
  secondaryText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
});
