import React, { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { __dn_confetti_loaded?: boolean }
}

/** Fires a burst of confetti when `trigger` changes (web only, no-op on native). */
export const ConfettiBurst: React.FC<{ trigger: number }> = ({ trigger }) => {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!trigger) return;

    const fire = (confetti: any) => {
      const count = 180;
      const defaults = { origin: { y: 0.6 }, zIndex: 99999 };
      const shoot = (ratio: number, opts: any) =>
        confetti({ ...defaults, ...opts, particleCount: Math.floor(count * ratio) });

      shoot(0.25, { spread: 26, startVelocity: 55, colors: ['#FF4500', '#FF6B00'] });
      shoot(0.2, { spread: 60, colors: ['#00E676', '#FFFFFF'] });
      shoot(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#FF4500', '#00E676', '#FFFFFF'] });
      shoot(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      shoot(0.1, { spread: 120, startVelocity: 45, colors: ['#FF3B30', '#FFAB00'] });
    };

    // Lazy-load canvas-confetti from CDN (keeps bundle small)
    if ((window as any).__dn_confetti_loaded && (window as any).confetti) {
      fire((window as any).confetti);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
    script.async = true;
    script.onload = () => {
      (window as any).__dn_confetti_loaded = true;
      if ((window as any).confetti) fire((window as any).confetti);
    };
    document.body.appendChild(script);
  }, [trigger]);

  return <View style={StyleSheet.absoluteFill} pointerEvents="none" />;
};
