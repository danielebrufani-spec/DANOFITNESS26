import { Platform } from 'react-native';

// Normalizza un numero italiano per wa.me (apre la chat anche se il numero NON è in rubrica)
export const waLink = (telefono: string, msg?: string): string | null => {
  let n = (telefono || '').replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 10 && n.startsWith('3')) {
    n = '39' + n; // cellulare IT senza prefisso (copre anche 391/392/393 che iniziano per 39!)
  } else if (!n.startsWith('39') && (n.length === 9 || n.length === 11)) {
    n = '39' + n;
  }
  if (n.length < 10) return null;
  return `https://wa.me/${n}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
};

export const openWhatsApp = (telefono: string, msg?: string): boolean => {
  if (Platform.OS !== 'web') return false;
  const url = waLink(telefono, msg);
  if (!url) return false;
  window.open(url, '_blank');
  return true;
};
