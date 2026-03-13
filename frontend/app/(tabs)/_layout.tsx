import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform, Modal, View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/utils/constants';
import { apiService } from '../../src/services/api';

export default function TabsLayout() {
  const { isAdmin, isIstruttore, mustResetPassword, clearMustResetPassword, user, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // BLOCCO UTENTI ARCHIVIATI - Schermata dedicata
  if (user?.archived) {
    return (
      <View style={archivedStyles.container}>
        <View style={archivedStyles.card}>
          <View style={archivedStyles.iconCircle}>
            <Ionicons name="lock-closed" size={44} color="#fff" />
          </View>
          
          <Text style={archivedStyles.title}>Account Sospeso</Text>
          
          <View style={archivedStyles.divider} />
          
          <Text style={archivedStyles.message}>
            Ciao{user?.nome ? ` ${user.nome}` : ''}!{'\n\n'}
            Il tuo account al momento non è attivo.{'\n'}
            Per riattivare tutti i servizi dell'app e tornare nella grande famiglia{' '}
            <Text style={archivedStyles.brand}>DanoFitness</Text>, contatta il Maestro Daniele.
          </Text>

          <View style={archivedStyles.contactBox}>
            <Ionicons name="call-outline" size={20} color={COLORS.primary} />
            <Text style={archivedStyles.contactText}>Contatta il Maestro Daniele</Text>
          </View>
          
          <Text style={archivedStyles.footer}>
            Ti aspettiamo a braccia aperte!
          </Text>

          <TouchableOpacity style={archivedStyles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.textSecondary} />
            <Text style={archivedStyles.logoutText}>Esci</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Errore', 'Le password non coincidono');
      return;
    }

    setSaving(true);
    try {
      await apiService.changePassword(newPassword, confirmPassword);
      clearMustResetPassword();
      Alert.alert('Successo', 'Password cambiata con successo!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il cambio password');
    } finally {
      setSaving(false);
    }
  };

  const tabBarHeight = Platform.select({
    ios: 100,
    android: 85,
    web: 90,
    default: 90,
  });
  
  const tabBarPaddingBottom = Platform.select({
    ios: 35,
    android: 20,
    web: 25,
    default: 25,
  });

  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          // Istruttori non vedono Home (vedono solo tab Lezioni)
          href: isIstruttore ? null : '/home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="prenota"
        options={{
          title: 'Prenota',
          // Istruttori e admin non prenotano
          href: (isAdmin || isIstruttore) ? null : '/prenota',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="comunicazioni"
        options={{
          href: null, // Nascosto
        }}
      />
      <Tabs.Screen
        name="abbonamento"
        options={{
          title: 'Abbonamento',
          // Istruttori e admin non hanno abbonamento
          href: (isAdmin || isIstruttore) ? null : '/abbonamento',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="istruttore"
        options={{
          title: 'Lezioni',
          // Solo istruttori (e admin per debug)
          href: (isIstruttore || isAdmin) ? '/istruttore' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="fitness-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? '/admin' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="curiosita"
        options={{
          title: 'Curiosità',
          // Istruttori non vedono curiosità
          href: isIstruttore ? null : '/curiosita',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "bulb" : "bulb-outline"} 
              size={size + 4} 
              color={focused ? COLORS.warning : color} 
            />
          ),
          tabBarActiveTintColor: COLORS.warning,
        }}
      />
      <Tabs.Screen
        name="premi"
        options={{
          title: 'Premi',
          // Istruttori non vedono i premi, ma admin sì
          href: isIstruttore ? null : '/premi',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "gift" : "gift-outline"} 
              size={size} 
              color={focused ? '#FFD700' : color} 
            />
          ),
          tabBarActiveTintColor: '#FFD700',
        }}
      />
      <Tabs.Screen
        name="classifica"
        options={{
          title: 'Classifica',
          // Visibile a TUTTI: clienti, admin, istruttori
          href: '/classifica',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "trophy" : "trophy-outline"} 
              size={size} 
              color={focused ? '#FFD700' : color} 
            />
          ),
          tabBarActiveTintColor: '#FFD700',
        }}
      />
      <Tabs.Screen
        name="profilo"
        options={{
          title: 'Profilo',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>

    {/* Modal Cambio Password Obbligatorio */}
    <Modal
      visible={mustResetPassword}
      animationType="fade"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalIcon}>
            <Ionicons name="key" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.modalTitle}>Cambio Password Richiesto</Text>
          <Text style={styles.modalSubtitle}>
            Ciao {user?.nome}! L'amministratore ha resettato la tua password. Devi impostarne una nuova per continuare.
          </Text>

          <TextInput
            style={styles.modalInput}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Nuova password (min. 6 caratteri)"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
          />

          <TextInput
            style={styles.modalInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Conferma password"
            placeholderTextColor={COLORS.textSecondary}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.modalButton, saving && styles.modalButtonDisabled]}
            onPress={handleChangePassword}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.modalButtonText}>Cambia Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalIcon: {
    alignSelf: 'center',
    backgroundColor: COLORS.primary + '20',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

const archivedStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  divider: {
    width: 50,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginVertical: 16,
  },
  message: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  brand: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  contactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primary + '15',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    marginBottom: 20,
  },
  contactText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  footer: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});