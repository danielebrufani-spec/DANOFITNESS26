import { Platform } from 'react-native';

/**
 * Riproduce un suono "ding" breve usando Web Audio API.
 * Funziona su tutti i browser moderni senza necessità di file esterni.
 * Su native (iOS/Android) è un no-op — se in futuro serve, si può
 * usare expo-av per riprodurre un asset audio.
 */
export function playNotificationDing(): void {
  if (Platform.OS !== 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Se il contesto è sospeso (per browser autoplay policies), prova a riprenderlo
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Prima nota (alta) - un piacevole "ding"
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now); // C6
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Seconda nota (poco dopo, più bassa) per un effetto "campanella"
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.08); // G5
    gain2.gain.setValueAtTime(0.0001, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.25, now + 0.10);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.7);

    // Chiudi il context dopo che le note finiscono per liberare risorse
    setTimeout(() => { try { ctx.close(); } catch { /* noop */ } }, 900);
  } catch {
    // Silently ignore audio errors — non deve mai crashare l'app
  }
}
