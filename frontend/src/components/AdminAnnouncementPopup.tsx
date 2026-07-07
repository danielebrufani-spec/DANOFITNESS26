import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { FONTS } from '../theme';
import { apiService, Announcement, AnnouncementColor } from '../services/api';
import { playNotificationDing } from '../utils/notificationSound';

/**
 * Popup avvisi configurati dall'Admin.
 * - Fetcha /announcements/active a ogni apertura app
 * - Mostra i popup a cascata (uno alla volta)
 * - "Chiudi" chiude il singolo popup nella sessione corrente
 * - "Non mostrarmi più oggi" salva in localStorage (reset a mezzanotte)
 * - Suona un "ding" UNA volta per ogni nuovo avviso mai visto prima (tracked in localStorage)
 * - Skippa avvisi archiviati (backend già filtra), scaduti (backend già filtra),
 *   e quelli che l'utente ha dismissato oggi.
 */

const STORAGE_KEY_PREFIX = 'announce_hidden_today_';
const STORAGE_KEY_SOUNDED = 'announce_sounds_played';

function todayKey(): string {
  const d = new Date();
  return `${STORAGE_KEY_PREFIX}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function readHiddenToday(): Set<string> {
  if (Platform.OS !== 'web') return new Set();
  try {
    const raw = window.localStorage.getItem(todayKey());
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function readSounded(): Set<string> {
  if (Platform.OS !== 'web') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SOUNDED);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSounded(ids: string[]) {
  if (Platform.OS !== 'web') return;
  try {
    // Keep at most last 500 IDs to avoid storage bloat
    const trimmed = ids.slice(-500);
    window.localStorage.setItem(STORAGE_KEY_SOUNDED, JSON.stringify(trimmed));
  } catch {
    /* noop */
  }
}

function hideForToday(id: string) {
  if (Platform.OS !== 'web') return;
  try {
    const s = readHiddenToday();
    s.add(id);
    window.localStorage.setItem(todayKey(), JSON.stringify(Array.from(s)));
    // Cleanup old day keys (best effort)
    const prefix = STORAGE_KEY_PREFIX;
    const currentKey = todayKey();
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix) && k !== currentKey) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    /* noop */
  }
}

const COLOR_MAP: Record<AnnouncementColor, { primary: string; bg: string; border: string; text: string }> = {
  orange: { primary: '#FF6B00', bg: 'rgba(255,107,0,0.10)', border: 'rgba(255,107,0,0.45)', text: '#FF6B00' },
  red: { primary: '#FF4D6D', bg: 'rgba(255,77,109,0.10)', border: 'rgba(255,77,109,0.45)', text: '#FF4D6D' },
  yellow: { primary: '#FFEA00', bg: 'rgba(255,234,0,0.10)', border: 'rgba(255,234,0,0.45)', text: '#FFEA00' },
  blue: { primary: '#00C8FF', bg: 'rgba(0,200,255,0.10)', border: 'rgba(0,200,255,0.45)', text: '#00C8FF' },
  green: { primary: '#00E676', bg: 'rgba(0,230,118,0.10)', border: 'rgba(0,230,118,0.45)', text: '#00E676' },
};

export const AdminAnnouncementPopup: React.FC = () => {
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [index, setIndex] = useState(0);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  // Fetch active announcements una tantum all'apertura
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getActiveAnnouncements();
        if (cancelled) return;
        const hidden = readHiddenToday();
        const items = (res.data.announcements || []).filter(a => !hidden.has(a.id));
        setQueue(items);
        setIndex(0);

        // Suona il ding UNA volta per ogni nuovo avviso mai visto prima
        if (items.length > 0) {
          const sounded = readSounded();
          const newOnes = items.filter(a => !sounded.has(a.id));
          if (newOnes.length > 0) {
            playNotificationDing();
            const merged = Array.from(new Set([...sounded, ...newOnes.map(a => a.id)]));
            writeSounded(merged);
          }
        }
      } catch {
        // se l'utente non è loggato o rete KO, semplicemente non mostriamo nulla
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const current: Announcement | undefined = queue[index];

  // Blink loop attivo solo se l'annuncio corrente ha lampeggiante = true
  useEffect(() => {
    if (!current || !current.lampeggiante) {
      blinkAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.25, duration: 500, useNativeDriver: false }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [current, blinkAnim]);

  if (!current) return null;

  const palette = COLOR_MAP[current.colore] || COLOR_MAP.orange;

  const closeCurrent = () => setIndex(i => i + 1);
  const hideToday = () => {
    hideForToday(current.id);
    setIndex(i => i + 1);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={closeCurrent}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { borderColor: palette.primary, shadowColor: palette.primary },
          ]}
          testID={`announcement-popup-${current.id}`}
        >
          {/* Close X */}
          <TouchableOpacity
            onPress={closeCurrent}
            style={styles.closeBtn}
            testID="announcement-popup-close"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconHero}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: palette.bg, borderColor: palette.primary, shadowColor: palette.primary },
              ]}
            >
              <Ionicons name="megaphone" size={44} color={palette.primary} />
            </View>
          </View>

          {/* Titolo (lampeggiante se configurato) */}
          <Animated.Text
            style={[
              styles.title,
              {
                color: palette.text,
                textShadowColor: `${palette.primary}99`,
                opacity: current.lampeggiante ? blinkAnim : 1,
              },
            ]}
          >
            {current.titolo}
          </Animated.Text>

          <View style={[styles.accentBar, { backgroundColor: palette.primary }]} />

          {/* Messaggio */}
          <View
            style={[
              styles.messageBox,
              { backgroundColor: palette.bg, borderColor: palette.border },
            ]}
          >
            <ScrollView style={styles.messageScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.message}>{current.messaggio}</Text>
            </ScrollView>
          </View>

          {/* Indicatore multi-avviso */}
          {queue.length > 1 && (
            <Text style={styles.counter}>
              Avviso {index + 1} di {queue.length}
            </Text>
          )}

          {/* CTA principale */}
          <TouchableOpacity
            onPress={closeCurrent}
            activeOpacity={0.85}
            testID="announcement-popup-ok"
            style={[styles.cta, { backgroundColor: palette.primary, shadowColor: palette.primary }]}
          >
            <Ionicons name="checkmark-circle" size={22} color="#000" />
            <Text style={styles.ctaText}>OK, HO LETTO</Text>
          </TouchableOpacity>

          {/* Nascondi per oggi */}
          <TouchableOpacity
            onPress={hideToday}
            activeOpacity={0.7}
            testID="announcement-popup-hide-today"
            style={styles.hideBtn}
          >
            <Ionicons name="eye-off-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.hideBtnText}>Non mostrarmi più oggi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default AdminAnnouncementPopup;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 2,
    padding: 20,
    paddingTop: 24,
    position: 'relative',
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
  iconHero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  title: {
    fontFamily: FONTS.headline,
    fontSize: 30,
    textAlign: 'center',
    letterSpacing: 1.8,
    lineHeight: 34,
    marginTop: 8,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  accentBar: {
    width: 50,
    height: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
    borderRadius: 2,
  },
  messageBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  messageScroll: {
    maxHeight: 260,
  },
  message: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 23,
  },
  counter: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 16,
    color: '#000',
    letterSpacing: 1.4,
  },
  hideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  hideBtnText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
});
