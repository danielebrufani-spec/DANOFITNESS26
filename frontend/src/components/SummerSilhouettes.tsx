import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Silhouette = {
  icon: any;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  size: number;
  color?: string;
  opacity?: number;
  rotation?: number;
};

const DEFAULT_COLOR = '#0099DD';

/**
 * Decorative summer silhouettes overlay (palm, sun, waves, umbrella, ice cream, glasses).
 * Use as absolutely-positioned background on any screen/section.
 * Set `pointerEvents="none"` so it never blocks taps.
 */
export const SummerSilhouettes: React.FC<{
  variant?: 'home' | 'altro' | 'shop' | 'maestro' | 'prenota' | 'classifica' | 'eventi' | 'login' | 'corner';
  style?: ViewStyle;
}> = ({ variant = 'home', style }) => {
  let items: Silhouette[] = [];

  switch (variant) {
    case 'home':
      items = [
        { icon: 'leaf-outline', top: -10, right: -10, size: 110, color: '#39FF14', opacity: 0.14, rotation: -25 },
        { icon: 'sunny-outline', top: 30, left: -28, size: 130, color: '#FFEA00', opacity: 0.18 },
        { icon: 'water-outline', bottom: 20, right: 8, size: 70, color: '#0099DD', opacity: 0.15 },
        { icon: 'umbrella-outline', bottom: -10, left: 16, size: 80, color: '#FF1493', opacity: 0.12, rotation: 15 },
      ];
      break;
    case 'altro':
      items = [
        { icon: 'glasses-outline', top: 10, right: 12, size: 60, color: '#FF1493', opacity: 0.13, rotation: -10 },
        { icon: 'leaf-outline', top: 100, left: -10, size: 90, color: '#39FF14', opacity: 0.13, rotation: 30 },
        { icon: 'ice-cream-outline', bottom: 100, right: -8, size: 75, color: '#FFEA00', opacity: 0.15 },
        { icon: 'water-outline', bottom: 0, left: 20, size: 65, color: '#0099DD', opacity: 0.13 },
      ];
      break;
    case 'shop':
      items = [
        { icon: 'umbrella-outline', top: 30, right: -10, size: 90, color: '#FF1493', opacity: 0.12 },
        { icon: 'sunny-outline', top: 200, left: -20, size: 100, color: '#FFEA00', opacity: 0.13 },
        { icon: 'leaf-outline', bottom: 50, right: 0, size: 80, color: '#39FF14', opacity: 0.14, rotation: -20 },
      ];
      break;
    case 'maestro':
      items = [
        { icon: 'heart-outline', top: 10, right: 30, size: 70, color: '#FF1493', opacity: 0.13 },
        { icon: 'flame-outline', top: 60, left: 8, size: 50, color: '#FF6B00', opacity: 0.12 },
        { icon: 'briefcase-outline', bottom: 200, right: 10, size: 55, color: '#0099DD', opacity: 0.12 },
        { icon: 'sunny-outline', bottom: 30, left: -30, size: 110, color: '#FFEA00', opacity: 0.13 },
      ];
      break;
    case 'prenota':
      items = [
        { icon: 'sunny-outline', top: -10, right: -10, size: 110, color: '#FFEA00', opacity: 0.17 },
        { icon: 'water-outline', bottom: 0, left: 0, size: 70, color: '#0099DD', opacity: 0.12 },
        { icon: 'leaf-outline', top: 280, right: -15, size: 80, color: '#39FF14', opacity: 0.12, rotation: 25 },
      ];
      break;
    case 'classifica':
      items = [
        { icon: 'trophy-outline', top: 20, right: -20, size: 130, color: '#FFEA00', opacity: 0.13 },
        { icon: 'sunny-outline', top: 280, left: -15, size: 90, color: '#FFEA00', opacity: 0.13 },
        { icon: 'star-outline', bottom: 80, right: 30, size: 60, color: '#FF1493', opacity: 0.15 },
      ];
      break;
    case 'eventi':
      items = [
        { icon: 'musical-notes-outline', top: 20, right: 20, size: 80, color: '#FF1493', opacity: 0.14 },
        { icon: 'water-outline', top: 240, left: -10, size: 80, color: '#0099DD', opacity: 0.13 },
        { icon: 'ice-cream-outline', bottom: 50, right: -5, size: 70, color: '#FFEA00', opacity: 0.15 },
      ];
      break;
    case 'login':
      items = [
        { icon: 'sunny-outline', top: -40, right: -40, size: 220, color: '#FFEA00', opacity: 0.20 },
        { icon: 'leaf-outline', top: 20, left: -20, size: 120, color: '#39FF14', opacity: 0.16, rotation: -30 },
        { icon: 'umbrella-outline', bottom: 100, right: -15, size: 95, color: '#FF1493', opacity: 0.14, rotation: 15 },
        { icon: 'water-outline', bottom: 20, left: -10, size: 100, color: '#0099DD', opacity: 0.15 },
        { icon: 'glasses-outline', bottom: 240, left: 20, size: 60, color: '#0C2333', opacity: 0.11, rotation: -10 },
      ];
      break;
    case 'corner':
    default:
      items = [
        { icon: 'leaf-outline', top: -5, right: -5, size: 60, color: '#39FF14', opacity: 0.12, rotation: -25 },
      ];
      break;
  }

  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      {items.map((s, idx) => (
        <View
          key={idx}
          style={{
            position: 'absolute',
            top: s.top,
            bottom: s.bottom,
            left: s.left,
            right: s.right,
            opacity: s.opacity ?? 0.12,
            transform: s.rotation ? [{ rotate: `${s.rotation}deg` }] : undefined,
          }}
        >
          <Ionicons name={s.icon} size={s.size} color={s.color ?? DEFAULT_COLOR} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
});

export default SummerSilhouettes;
