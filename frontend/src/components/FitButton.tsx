import React, { useRef } from 'react';
import { Animated, Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '../utils/constants';
import { FONTS, RADII, glow } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

interface FitButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<Variant, { bg: string; fg: string; border?: string; glowColor?: string }> = {
  primary: { bg: COLORS.primary, fg: '#fff', glowColor: COLORS.glowOrange },
  secondary: { bg: COLORS.surface, fg: '#fff', border: COLORS.border },
  ghost: { bg: 'transparent', fg: COLORS.primary, border: COLORS.primary },
  danger: { bg: COLORS.danger, fg: '#fff' },
  success: { bg: COLORS.success, fg: '#000', glowColor: COLORS.glowGreen },
};

const sizes = {
  sm: { py: 8, px: 14, fs: 13 },
  md: { py: 12, px: 18, fs: 15 },
  lg: { py: 16, px: 22, fs: 17 },
};

export const FitButton: React.FC<FitButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  fullWidth,
  disabled,
  style,
  textStyle,
  testID,
  size = 'md',
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const v = variantStyles[variant];
  const s = sizes[size];

  return (
    <Pressable
      onPressIn={() => Animated.spring(scale, { toValue: 0.95, friction: 5, tension: 100, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }).start()}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        { opacity: disabled ? 0.45 : pressed ? 0.92 : 1 },
        fullWidth && { width: '100%' },
        style,
      ]}
      {...({ 'data-testid': testID } as any)}
    >
      <Animated.View
        style={[
          styles.btn,
          {
            backgroundColor: v.bg,
            borderColor: v.border || 'transparent',
            borderWidth: v.border ? 1 : 0,
            paddingVertical: s.py,
            paddingHorizontal: s.px,
            transform: [{ scale }],
          },
          v.glowColor && glow(v.glowColor, 10, 0.5),
        ]}
      >
        {icon}
        <Text style={[styles.label, { color: v.fg, fontSize: s.fs }, textStyle]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.md,
    gap: 8,
  },
  label: {
    fontFamily: FONTS.bodyBlack,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
});
