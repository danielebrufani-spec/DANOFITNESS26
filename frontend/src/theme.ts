/**
 * Design tokens for the new Tactical Obsidian / Kinetic Orange theme.
 * Import as: `import { FONTS, SPACING, SHADOWS, RADII } from '../theme';`
 */
import { Platform } from 'react-native';

export const FONTS = {
  headline: 'BebasNeue_400Regular',
  body: 'Montserrat_400Regular',
  bodySemi: 'Montserrat_600SemiBold',
  bodyBold: 'Montserrat_700Bold',
  bodyExtra: 'Montserrat_800ExtraBold',
  bodyBlack: 'Montserrat_900Black',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADII = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

// Cross-platform shadow / glow helper
export const glow = (color: string, radius = 14, opacity = 0.6) =>
  Platform.select({
    web: { boxShadow: `0 0 ${radius}px ${radius / 2}px ${color}` },
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: opacity,
      shadowRadius: radius,
      elevation: radius / 2,
    },
  }) as object;

export const textHeadline = (size: number, color: string) => ({
  fontFamily: FONTS.headline,
  fontSize: size,
  color,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
});
