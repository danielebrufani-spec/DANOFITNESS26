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

  const isArchived = user?.archived === true;

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
          href: (isIstruttore || isArchived) ? null : '/home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alimentazione"
        options={{
          title: 'Dieta AI',
          href: null, // accessibile dal tab "Altro"
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "nutrition" : "nutrition-outline"} 
              size={size + 4} 
              color={focused ? COLORS.primary : color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="prenota"
        options={{
          title: 'Prenota',
          href: (isAdmin || isIstruttore || isArchived) ? null : '/prenota',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="comunicazioni"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="abbonamento"
        options={{
          title: 'Abbonamento',
          href: null, // accessibile dal tab "Altro"
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="istruttore"
        options={{
          title: 'Lezioni',
          href: ((isIstruttore || isAdmin) && !isArchived) ? '/istruttore' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="fitness-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: (isAdmin && !isArchived) ? '/admin' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="curiosita"
        options={{
          title: 'Curiosità',
          href: null, // accessibile dal tab "Altro"
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
          title: 'Ruota e Quiz',
          href: (isIstruttore || isArchived) ? null : '/premi',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "gift" : "gift-outline"} 
              size={size} 
              color={focused ? COLORS.primary : color} 
            />
          ),
          tabBarActiveTintColor: COLORS.primary,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
          },
        }}
      />
      <Tabs.Screen
        name="classifica"
        options={{
          title: 'Classifica',
          href: null, // accessibile dal tab "Altro"
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "trophy" : "trophy-outline"} 
              size={size} 
              color={focused ? COLORS.secondary : color} 
            />
          ),
          tabBarActiveTintColor: COLORS.secondary,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          href: isArchived ? null : '/shop',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "bag-handle" : "bag-handle-outline"} 
              size={size} 
              color={focused ? COLORS.primary : color} 
            />
          ),
          tabBarActiveTintColor: COLORS.primary,
        }}
      />
      <Tabs.Screen
        name="eventi"
        options={{
          title: 'Eventi',
          href: null, // accessibile dal tab "Altro"
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "musical-notes" : "musical-notes-outline"} 
              size={size} 
              color={focused ? '#FF6B00' : color} 
            />
          ),
          tabBarActiveTintColor: '#FF6B00',
        }}
      />
      <Tabs.Screen
        name="profilo"
        options={{
          title: 'Profilo',
          href: null, // accessibile dal tab "Altro"
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="altro"
        options={{
          title: 'Altro',
          href: isArchived ? null : '/altro',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'apps' : 'apps-outline'}
              size={size}
              color={focused ? COLORS.primary : color}
            />
          ),
          tabBarActiveTintColor: COLORS.primary,
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
