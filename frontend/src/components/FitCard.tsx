import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS } from '../utils/constants';
import { RADII } from '../theme';

interface FitCardProps {
  children: React.ReactNode;
  elevated?: boolean;
  glow?: boolean;
  delay?: number;
  style?: ViewStyle;
  borderColor?: string;
}

/** Animated card that fades + slides in from below on mount. */
export const FitCard: React.FC<FitCardProps> = ({
  children,
  elevated,
  glow,
  delay = 0,
  style,
  borderColor,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? COLORS.surfaceElevated : COLORS.surface,
          borderColor: borderColor || COLORS.border,
        },
        glow && styles.glow,
        { opacity, transform: [{ translateY }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADII.lg,
    borderWidth: 1,
    padding: 16,
  },
  glow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
});
