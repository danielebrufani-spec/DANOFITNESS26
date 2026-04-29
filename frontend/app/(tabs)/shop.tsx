import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  StyleSheet,
  RefreshControl,
  Linking,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';
import { COLORS } from '../../src/utils/constants';
import { FONTS } from '../../src/theme';

const SPRINT_LOGO = 'https://customer-assets.emergentagent.com/job_120068e1-741e-430e-86ee-0f10594d3f2d/artifacts/zb4aa7jk_image.png';
const SPRINT_PHONE = '+393487397979'; // Mirko - WhatsApp
const SPRINT_PHONE_DIGITS = '393487397979';

// ===== Image compression (canvas, web only) =====
async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const maxSide = 800;
        let { width, height } = img;
        if (width > height && width > maxSide) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else if (height > maxSide) {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Product {
  id: string;
  nome: string;
  descrizione: string;
  prezzo: number;
  foto_base64?: string;
  taglie: string[];
  colori: string[];
  in_magazzino: boolean;
  attivo: boolean;
}

interface Order {
  id: string;
  user_id: string;
  user_nome: string;
  user_cognome: string;
  user_telefono: string;
  product_id: string;
  product_nome: string;
  product_foto_base64?: string;
  taglia?: string;
  colore?: string;
  quantita: number;
  prezzo: number;
  totale: number;
  status: string;
  evaso_da?: string;
  note?: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  in_attesa: { label: 'In Attesa', color: COLORS.warning },
  in_lavorazione: { label: 'In Lavorazione', color: COLORS.primary },
  inviato_produttore: { label: 'Inviato al Produttore', color: COLORS.primary },
  in_consegna: { label: 'In Consegna', color: COLORS.accent },
  consegnato: { label: 'Consegnato', color: COLORS.success },
  annullato: { label: 'Annullato', color: COLORS.error },
};

export default function ShopScreen() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Buy modal
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [buyTaglia, setBuyTaglia] = useState<string>('');
  const [buyColore, setBuyColore] = useState<string>('');
  const [buyNote, setBuyNote] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Admin: product create/edit modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [pNome, setPNome] = useState('');
  const [pDescrizione, setPDescrizione] = useState('');
  const [pPrezzo, setPPrezzo] = useState('');
  const [pFoto, setPFoto] = useState<string | null>(null);
  const [pTaglieStr, setPTaglieStr] = useState('');
  const [pColoriStr, setPColoriStr] = useState('');
  const [pInMagazzino, setPInMagazzino] = useState(false);
  const [pAttivo, setPAttivo] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [prodRes, myOrdRes] = await Promise.all([
        isAdmin ? apiService.adminListShopProducts() : apiService.getShopProducts(),
        apiService.getMyShopOrders(),
      ]);
      setProducts(prodRes.data);
      setMyOrders(myOrdRes.data);
      if (isAdmin) {
        const allOrd = await apiService.adminListShopOrders();
        setAllOrders(allOrd.data);
      }
    } catch (e) {
      console.error('Shop load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // ============== Buying flow ==============
  const openBuyModal = (p: Product) => {
    setBuyProduct(p);
    setBuyTaglia(p.taglie[0] || '');
    setBuyColore(p.colori[0] || '');
    setBuyNote('');
  };

  const handleConfirmOrder = async () => {
    if (!buyProduct) return;
    if (buyProduct.taglie.length > 0 && !buyTaglia) {
      window.alert('Seleziona una taglia');
      return;
    }
    if (buyProduct.colori.length > 0 && !buyColore) {
      window.alert('Seleziona un colore');
      return;
    }
    setSubmittingOrder(true);
    try {
      const res = await apiService.createShopOrder({
        product_id: buyProduct.id,
        taglia: buyTaglia || null,
        colore: buyColore || null,
        quantita: 1,
        note: buyNote,
      });
      window.alert(`Ordine inviato! 🎉\n\n🎟️ +${res.data.bonus_biglietti || 5} biglietti lotteria sono stati accreditati sul tuo account!\n\nIl tuo ordine è in coda. Daniele lo gestirà al più presto e ti farà sapere quando il prodotto sarà pronto per il ritiro 💪`);
      setBuyProduct(null);
      loadAll();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore durante l\'ordine';
      window.alert('Errore: ' + msg);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // ============== Admin product flow ==============
  const openCreateProduct = () => {
    setEditingProduct(null);
    setPNome('');
    setPDescrizione('');
    setPPrezzo('');
    setPFoto(null);
    setPTaglieStr('S, M, L, XL');
    setPColoriStr('Nero, Bianco');
    setPInMagazzino(false);
    setPAttivo(true);
    setShowProductModal(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setPNome(p.nome);
    setPDescrizione(p.descrizione);
    setPPrezzo(String(p.prezzo));
    setPFoto(p.foto_base64 || null);
    setPTaglieStr(p.taglie.join(', '));
    setPColoriStr(p.colori.join(', '));
    setPInMagazzino(p.in_magazzino);
    setPAttivo(p.attivo);
    setShowProductModal(true);
  };

  const handlePickFile = async () => {
    if (Platform.OS !== 'web') {
      window.alert('Caricamento foto disponibile da web');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const compressed = await compressImageFile(file);
        setPFoto(compressed);
      } catch (err) {
        window.alert('Errore caricamento immagine');
      }
    };
    input.click();
  };

  const handleSaveProduct = async () => {
    if (!pNome.trim() || !pPrezzo) {
      window.alert('Nome e prezzo sono obbligatori');
      return;
    }
    setSavingProduct(true);
    try {
      const payload: any = {
        nome: pNome.trim(),
        descrizione: pDescrizione.trim(),
        prezzo: parseFloat(pPrezzo.replace(',', '.')) || 0,
        foto_base64: pFoto,
        taglie: pTaglieStr.split(',').map((s) => s.trim()).filter(Boolean),
        colori: pColoriStr.split(',').map((s) => s.trim()).filter(Boolean),
        in_magazzino: pInMagazzino,
        attivo: pAttivo,
      };
      if (editingProduct) {
        await apiService.adminUpdateShopProduct(editingProduct.id, payload);
      } else {
        await apiService.adminCreateShopProduct(payload);
      }
      setShowProductModal(false);
      loadAll();
    } catch (e: any) {
      window.alert('Errore: ' + (e?.response?.data?.detail || 'Salvataggio fallito'));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!window.confirm(`Eliminare definitivamente "${p.nome}"?`)) return;
    try {
      await apiService.adminDeleteShopProduct(p.id);
      loadAll();
    } catch (e: any) {
      window.alert('Errore: ' + (e?.response?.data?.detail || 'Eliminazione fallita'));
    }
  };

  const handleUpdateOrderStatus = async (o: Order, status: string, evaso_da?: string | null) => {
    try {
      const payload: any = { status };
      if (evaso_da !== undefined) payload.evaso_da = evaso_da;
      await apiService.adminUpdateShopOrder(o.id, payload);
      loadAll();
    } catch (e: any) {
      window.alert('Errore: ' + (e?.response?.data?.detail || 'Aggiornamento fallito'));
    }
  };

  const handleDeleteOrder = async (o: Order) => {
    if (!window.confirm(`Archiviare l'ordine di ${o.user_nome} ${o.user_cognome} (${o.product_nome})?\n\nL'ordine sparirà dalla tua vista, ma rimarrà visibile al cliente come promemoria dell'acquisto.`)) return;
    try {
      await apiService.adminDeleteShopOrder(o.id);
      loadAll();
    } catch (e: any) {
      window.alert('Errore: ' + (e?.response?.data?.detail || 'Archiviazione fallita'));
    }
  };

  const handleSendToMirko = async (o: Order) => {
    try {
      const res = await apiService.adminGetShopOrderWhatsappLink(o.id, 'produttore');
      const waText = encodeURIComponent(res.data.whatsapp_text);
      const waUrl = `https://wa.me/${SPRINT_PHONE_DIGITS}?text=${waText}`;
      if (Platform.OS === 'web') {
        window.open(waUrl, '_blank');
      } else {
        Linking.openURL(waUrl);
      }
      await apiService.adminUpdateShopOrder(o.id, { status: 'in_lavorazione', evaso_da: 'produttore' });
      loadAll();
    } catch (e: any) {
      window.alert('Errore: ' + (e?.response?.data?.detail || 'Impossibile generare link'));
    }
  };

  const handleFulfillFromWarehouse = async (o: Order) => {
    try {
      // Apri WhatsApp con messaggio FYI per Mirko (variante magazzino)
      const res = await apiService.adminGetShopOrderWhatsappLink(o.id, 'magazzino');
      const waText = encodeURIComponent(res.data.whatsapp_text);
      const waUrl = `https://wa.me/${SPRINT_PHONE_DIGITS}?text=${waText}`;
      if (Platform.OS === 'web') {
        window.open(waUrl, '_blank');
      } else {
        Linking.openURL(waUrl);
      }
      await apiService.adminUpdateShopOrder(o.id, { status: 'in_lavorazione', evaso_da: 'magazzino' });
      loadAll();
    } catch (e: any) {
      window.alert('Errore: ' + (e?.response?.data?.detail || 'Impossibile evadere'));
    }
  };

  const handleCancelMyOrder = async (o: Order) => {
    if (!window.confirm(`Annullare l'ordine di "${o.product_nome}"?\n\n⚠️ I 5 biglietti lotteria associati verranno revocati e l'ordine sarà eliminato definitivamente.`)) return;
    try {
      await apiService.cancelMyShopOrder(o.id);
      window.alert('Ordine annullato.\n\n5 biglietti lotteria sono stati revocati.');
      loadAll();
    } catch (e: any) {
      window.alert('Errore: ' + (e?.response?.data?.detail || 'Annullamento fallito'));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Logo Sprint */}
        <View style={styles.logoBox}>
          <Image source={{ uri: SPRINT_LOGO }} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Sprint Bastia Umbra info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Sprint Design</Text>
          <Text style={styles.infoSubtitle}>Bastia Umbra (PG)</Text>
          <Text style={styles.infoBody}>
            Sprint è la realtà che produce il merchandise ufficiale di DanoFitness23. Specializzati in abbigliamento sportivo personalizzato, t-shirt, felpe, accessori e gadget di alto livello — tutto pensato per chi suda davvero. 💪
          </Text>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>Via Madrid, 2 — 06083 Bastia Umbra (PG)</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color={COLORS.primary} />
            <TouchableOpacity onPress={() => Linking.openURL('tel:0758085293')}>
              <Text style={[styles.infoText, { textDecorationLine: 'underline' }]}>075 808 5293</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>Lun–Ven 09:30–13:00 / 15:30–19:30 · Sab 09:30–13:00</Text>
          </View>
        </View>

        {/* 🎟️ BONUS BIGLIETTI BANNER */}
        <View style={styles.bonusBanner}>
          <View style={styles.bonusBadge}>
            <Ionicons name="ticket" size={32} color="#FFD700" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bonusTitle}>+5 BIGLIETTI LOTTERIA</Text>
            <Text style={styles.bonusSubtitle}>GRATIS PER OGNI ACQUISTO!</Text>
            <Text style={styles.bonusText}>
              Compra il merchandise e ricevi automaticamente 5 biglietti per l'estrazione mensile 🎁
            </Text>
          </View>
        </View>

        {/* Admin: button to add product */}
        {isAdmin && (
          <TouchableOpacity
            data-testid="add-product-btn"
            style={styles.adminAddButton}
            onPress={openCreateProduct}
          >
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.adminAddButtonText}>Nuovo Prodotto</Text>
          </TouchableOpacity>
        )}

        {/* Products grid */}
        <Text style={styles.sectionTitle}>Catalogo</Text>
        {products.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="bag-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {isAdmin ? 'Nessun prodotto. Aggiungi il primo!' : 'Nessun prodotto disponibile al momento'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {products.map((p) => (
              <View key={p.id} style={styles.card} data-testid={`product-card-${p.id}`}>
                {p.foto_base64 ? (
                  <Image source={{ uri: p.foto_base64 }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                    <Ionicons name="image-outline" size={48} color={COLORS.textSecondary} />
                  </View>
                )}
                {!p.attivo && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>NON ATTIVO</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>{p.nome}</Text>
                  {p.descrizione ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>{p.descrizione}</Text>
                  ) : null}
                  <Text style={styles.cardPrice}>€ {p.prezzo.toFixed(2)}</Text>
                  {isAdmin ? (
                    <View style={styles.cardAdminActions}>
                      <TouchableOpacity
                        data-testid={`edit-product-${p.id}`}
                        style={[styles.cardSmallBtn, { backgroundColor: COLORS.primary }]}
                        onPress={() => openEditProduct(p)}
                      >
                        <Ionicons name="create-outline" size={14} color="#fff" />
                        <Text style={styles.cardSmallBtnText}>Modifica</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        data-testid={`delete-product-${p.id}`}
                        style={[styles.cardSmallBtn, { backgroundColor: COLORS.error }]}
                        onPress={() => handleDeleteProduct(p)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      data-testid={`buy-product-${p.id}`}
                      style={styles.cardBuyBtn}
                      onPress={() => openBuyModal(p)}
                    >
                      <Ionicons name="bag-add" size={14} color="#fff" />
                      <Text style={styles.cardBuyBtnText}>Ordina</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* My orders */}
        {myOrders.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 32 }]}>I Miei Ordini</Text>
            {myOrders.map((o) => {
              const stat = STATUS_LABELS[o.status] || STATUS_LABELS.in_attesa;
              return (
                <View key={o.id} style={styles.orderCard}>
                  <View style={styles.orderRow}>
                    {o.product_foto_base64 ? (
                      <Image source={{ uri: o.product_foto_base64 }} style={styles.orderThumb} />
                    ) : (
                      <View style={[styles.orderThumb, styles.cardImagePlaceholder]}>
                        <Ionicons name="image-outline" size={20} color={COLORS.textSecondary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderName}>{o.product_nome}</Text>
                      <Text style={styles.orderMeta}>
                        {o.taglia ? `Taglia ${o.taglia}` : ''}{o.taglia && o.colore ? ' · ' : ''}{o.colore || ''}
                      </Text>
                      <Text style={styles.orderTotal}>€ {o.totale.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: stat.color + '25', borderColor: stat.color }]}>
                      <Text style={[styles.statusPillText, { color: stat.color }]}>{stat.label}</Text>
                    </View>
                  </View>
                  {o.status === 'in_attesa' && (
                    <TouchableOpacity
                      data-testid={`cancel-my-order-${o.id}`}
                      style={styles.cancelMyOrderBtn}
                      onPress={() => handleCancelMyOrder(o)}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
                      <Text style={styles.cancelMyOrderText}>Annulla Ordine</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Admin: all orders */}
        {isAdmin && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Tutti gli Ordini ({allOrders.length})</Text>
            {allOrders.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Nessun ordine ancora</Text>
              </View>
            ) : (
              allOrders.map((o) => {
                const stat = STATUS_LABELS[o.status] || STATUS_LABELS.in_attesa;
                return (
                  <View key={o.id} style={styles.adminOrderCard}>
                    <View style={styles.orderRow}>
                      {o.product_foto_base64 ? (
                        <Image source={{ uri: o.product_foto_base64 }} style={styles.orderThumb} />
                      ) : (
                        <View style={[styles.orderThumb, styles.cardImagePlaceholder]}>
                          <Ionicons name="image-outline" size={20} color={COLORS.textSecondary} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderName}>{o.product_nome}</Text>
                        <Text style={styles.orderClient}>
                          👤 {o.user_nome} {o.user_cognome}{o.user_telefono ? ` · ${o.user_telefono}` : ''}
                        </Text>
                        <Text style={styles.orderMeta}>
                          {o.taglia ? `Taglia ${o.taglia}` : ''}{o.taglia && o.colore ? ' · ' : ''}{o.colore || ''} · Q.tà {o.quantita}
                        </Text>
                        <Text style={styles.orderTotal}>€ {o.totale.toFixed(2)}</Text>
                        {o.evaso_da && (
                          <Text style={styles.orderMeta}>Evaso: {o.evaso_da}</Text>
                        )}
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: stat.color + '25', borderColor: stat.color }]}>
                        <Text style={[styles.statusPillText, { color: stat.color }]}>{stat.label}</Text>
                      </View>
                    </View>
                    {/* Admin actions */}
                    <View style={styles.adminOrderActions}>
                      {o.status === 'in_attesa' && (
                        <>
                          <TouchableOpacity
                            data-testid={`order-send-mirko-${o.id}`}
                            style={[styles.actionBtn, { backgroundColor: '#25D366' }]}
                            onPress={() => handleSendToMirko(o)}
                          >
                            <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                            <Text style={styles.actionBtnText}>Invia a Mirko</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            data-testid={`order-fulfill-warehouse-${o.id}`}
                            style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
                            onPress={() => handleFulfillFromWarehouse(o)}
                          >
                            <Ionicons name="cube" size={14} color="#fff" />
                            <Text style={styles.actionBtnText}>Evadi da Magazzino</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {o.status === 'in_lavorazione' && (
                        <TouchableOpacity
                          data-testid={`order-mark-shipping-${o.id}`}
                          style={[styles.actionBtn, { backgroundColor: COLORS.accent }]}
                          onPress={() => handleUpdateOrderStatus(o, 'in_consegna')}
                        >
                          <Ionicons name="cube-outline" size={14} color="#fff" />
                          <Text style={styles.actionBtnText}>Prodotto in Mano · In Consegna</Text>
                        </TouchableOpacity>
                      )}
                      {o.status === 'in_consegna' && (
                        <TouchableOpacity
                          data-testid={`order-mark-delivered-${o.id}`}
                          style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
                          onPress={() => handleUpdateOrderStatus(o, 'consegnato')}
                        >
                          <Ionicons name="checkmark-done" size={14} color="#fff" />
                          <Text style={styles.actionBtnText}>Consegnato</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        data-testid={`order-archive-${o.id}`}
                        style={[styles.actionBtn, { backgroundColor: COLORS.error }]}
                        onPress={() => handleDeleteOrder(o)}
                      >
                        <Ionicons name="archive" size={14} color="#fff" />
                        <Text style={styles.actionBtnText}>Archivia</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* Footer slogan */}
        <Text style={styles.slogan}>SOLO PRODOTTINI{"\n"}DI QUALITÀ</Text>
      </ScrollView>

      {/* ============== BUY MODAL ============== */}
      <Modal
        visible={!!buyProduct}
        animationType="slide"
        transparent
        onRequestClose={() => setBuyProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ordina</Text>
              <TouchableOpacity onPress={() => setBuyProduct(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {buyProduct && (
              <ScrollView>
                {buyProduct.foto_base64 && (
                  <Image source={{ uri: buyProduct.foto_base64 }} style={styles.modalImage} resizeMode="contain" />
                )}
                <Text style={styles.modalProductName}>{buyProduct.nome}</Text>
                {buyProduct.descrizione ? (
                  <Text style={styles.modalProductDesc}>{buyProduct.descrizione}</Text>
                ) : null}
                <Text style={styles.modalPrice}>€ {buyProduct.prezzo.toFixed(2)}</Text>

                {buyProduct.taglie.length > 0 && (
                  <>
                    <Text style={styles.modalLabel}>Taglia</Text>
                    <View style={styles.chipRow}>
                      {buyProduct.taglie.map((t) => (
                        <TouchableOpacity
                          key={t}
                          data-testid={`size-${t}`}
                          style={[styles.chip, buyTaglia === t && styles.chipActive]}
                          onPress={() => setBuyTaglia(t)}
                        >
                          <Text style={[styles.chipText, buyTaglia === t && styles.chipTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {buyProduct.colori.length > 0 && (
                  <>
                    <Text style={styles.modalLabel}>Colore</Text>
                    <View style={styles.chipRow}>
                      {buyProduct.colori.map((c) => (
                        <TouchableOpacity
                          key={c}
                          data-testid={`color-${c}`}
                          style={[styles.chip, buyColore === c && styles.chipActive]}
                          onPress={() => setBuyColore(c)}
                        >
                          <Text style={[styles.chipText, buyColore === c && styles.chipTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.modalLabel}>Note (opzionale)</Text>
                <TextInput
                  style={styles.modalInput}
                  multiline
                  placeholder="Es. preferenze, richieste..."
                  placeholderTextColor={COLORS.textSecondary}
                  value={buyNote}
                  onChangeText={setBuyNote}
                />

                <Text style={styles.paymentHint}>
                  💸 Il pagamento avviene di persona alla consegna del prodotto in palestra.
                </Text>

                <TouchableOpacity
                  data-testid="confirm-order"
                  style={[styles.confirmBtn, submittingOrder && { opacity: 0.6 }]}
                  onPress={handleConfirmOrder}
                  disabled={submittingOrder}
                >
                  {submittingOrder ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="bag-check" size={20} color="#fff" />
                      <Text style={styles.confirmBtnText}>Conferma Ordine</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ============== ADMIN PRODUCT MODAL ============== */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProduct ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {/* Photo */}
              <Text style={styles.modalLabel}>Foto Prodotto</Text>
              <TouchableOpacity style={styles.photoBox} onPress={handlePickFile}>
                {pFoto ? (
                  <Image source={{ uri: pFoto }} style={styles.photoPreview} resizeMode="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="cloud-upload-outline" size={36} color={COLORS.primary} />
                    <Text style={styles.photoHint}>Tocca per caricare (compressa automaticamente)</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.modalLabel}>Nome</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Es. T-Shirt DanoFitness"
                placeholderTextColor={COLORS.textSecondary}
                value={pNome}
                onChangeText={setPNome}
              />

              <Text style={styles.modalLabel}>Descrizione</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 60 }]}
                multiline
                placeholder="Descrizione del prodotto..."
                placeholderTextColor={COLORS.textSecondary}
                value={pDescrizione}
                onChangeText={setPDescrizione}
              />

              <Text style={styles.modalLabel}>Prezzo (€)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="25.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
                value={pPrezzo}
                onChangeText={setPPrezzo}
              />

              <Text style={styles.modalLabel}>Taglie disponibili (separate da virgola)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="S, M, L, XL"
                placeholderTextColor={COLORS.textSecondary}
                value={pTaglieStr}
                onChangeText={setPTaglieStr}
              />

              <Text style={styles.modalLabel}>Colori disponibili (separati da virgola)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nero, Bianco, Rosso"
                placeholderTextColor={COLORS.textSecondary}
                value={pColoriStr}
                onChangeText={setPColoriStr}
              />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Disponibile in magazzino</Text>
                  <Text style={styles.toggleHint}>Se ON, può essere evaso senza inviare a Sprint</Text>
                </View>
                <Switch
                  value={pInMagazzino}
                  onValueChange={setPInMagazzino}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Attivo (visibile ai clienti)</Text>
                </View>
                <Switch
                  value={pAttivo}
                  onValueChange={setPAttivo}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                />
              </View>

              <TouchableOpacity
                data-testid="save-product"
                style={[styles.confirmBtn, savingProduct && { opacity: 0.6 }]}
                onPress={handleSaveProduct}
                disabled={savingProduct}
              >
                {savingProduct ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>{editingProduct ? 'Salva Modifiche' : 'Crea Prodotto'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 100 },

  logoBox: { alignItems: 'center', marginBottom: 18 },
  logo: { width: 220, height: 220 },

  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoTitle: {
    fontFamily: FONTS.headline,
    fontSize: 26,
    color: COLORS.text,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  infoSubtitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  infoBody: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  infoText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text, flex: 1 },

  adminAddButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, padding: 12, borderRadius: 6, marginBottom: 16,
  },
  adminAddButtonText: { fontFamily: FONTS.bodyBlack, fontSize: 13, color: '#fff', textTransform: 'uppercase', letterSpacing: 1.2 },

  bonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: '#1a0f00',
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  bonusBadge: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bonusTitle: {
    fontFamily: FONTS.headline,
    fontSize: 26,
    color: '#FFD700',
    letterSpacing: 1.5,
    lineHeight: 28,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  bonusSubtitle: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 13,
    color: COLORS.primary,
    letterSpacing: 1.2,
    marginTop: 2,
    marginBottom: 6,
  },
  bonusText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 17,
  },

  sectionTitle: { fontFamily: FONTS.headline, fontSize: 24, color: COLORS.text, marginBottom: 12, letterSpacing: 1.5, textTransform: 'uppercase' },

  emptyBox: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  card: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardImage: { width: '100%', aspectRatio: 1, backgroundColor: COLORS.surfaceElevated },
  cardImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 10 },
  cardName: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text, marginBottom: 2 },
  cardDesc: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 },
  cardPrice: { fontFamily: FONTS.headline, fontSize: 22, color: COLORS.primary, letterSpacing: 1, marginBottom: 8 },
  cardBuyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.primary, paddingVertical: 8, borderRadius: 4 },
  cardBuyBtnText: { fontFamily: FONTS.bodyBlack, fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  cardAdminActions: { flexDirection: 'row', gap: 6 },
  cardSmallBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4, flex: 1 },
  cardSmallBtnText: { fontFamily: FONTS.bodyBold, fontSize: 11, color: '#fff', textTransform: 'uppercase' },
  inactiveBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: COLORS.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  inactiveBadgeText: { fontFamily: FONTS.bodyBlack, fontSize: 10, color: '#fff', letterSpacing: 1 },

  orderCard: { backgroundColor: COLORS.surface, borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  cancelMyOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: 'transparent',
  },
  cancelMyOrderText: {
    fontFamily: FONTS.bodyBlack,
    fontSize: 12,
    color: COLORS.error,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  adminOrderCard: { backgroundColor: COLORS.surface, borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: COLORS.surfaceElevated },
  orderName: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text },
  orderClient: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.primary, marginTop: 2 },
  orderMeta: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  orderTotal: { fontFamily: FONTS.headline, fontSize: 18, color: COLORS.primary, marginTop: 4, letterSpacing: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  statusPillText: { fontFamily: FONTS.bodyBlack, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  adminOrderActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  actionBtnText: { fontFamily: FONTS.bodyBold, fontSize: 11, color: '#fff', textTransform: 'uppercase' },

  slogan: {
    fontFamily: FONTS.headline,
    fontSize: 36,
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: 3,
    marginTop: 40,
    lineHeight: 38,
    textShadowColor: 'rgba(255, 69, 0, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 18, maxHeight: '90%', borderTopWidth: 4, borderTopColor: COLORS.primary },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontFamily: FONTS.headline, fontSize: 26, color: COLORS.text, letterSpacing: 1.5, textTransform: 'uppercase' },
  modalImage: { width: '100%', height: 240, marginBottom: 12, backgroundColor: COLORS.surfaceElevated, borderRadius: 8 },
  modalProductName: { fontFamily: FONTS.headline, fontSize: 22, color: COLORS.text, letterSpacing: 1.2, textTransform: 'uppercase' },
  modalProductDesc: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  modalPrice: { fontFamily: FONTS.headline, fontSize: 32, color: COLORS.primary, letterSpacing: 1.5, marginTop: 8 },
  modalLabel: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.textSecondary, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  modalInput: { backgroundColor: COLORS.surfaceElevated, borderRadius: 6, padding: 12, fontFamily: FONTS.body, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '25' },
  chipText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  chipTextActive: { color: COLORS.primary },

  paymentHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.warning, marginTop: 14, textAlign: 'center' },

  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, padding: 16, borderRadius: 6, marginTop: 18, marginBottom: 30 },
  confirmBtnText: { fontFamily: FONTS.bodyBlack, fontSize: 15, color: '#fff', textTransform: 'uppercase', letterSpacing: 1.2 },

  photoBox: { width: '100%', height: 180, backgroundColor: COLORS.surfaceElevated, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', gap: 6, padding: 20 },
  photoHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 14, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  toggleLabel: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.text },
  toggleHint: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
