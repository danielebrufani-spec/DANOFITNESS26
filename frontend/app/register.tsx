import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { COLORS } from '../src/utils/constants';

export default function RegisterScreen() {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!nome.trim() || !cognome.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Errore', 'Le password non corrispondono');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }

    setLoading(true);
    try {
      await register({
        nome: nome.trim(),
        cognome: cognome.trim(),
        email: email.trim(),
        telefono: telefono.trim() || undefined,
        password,
      });
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Errore', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Image 
              source={require('../assets/images/logo.jpg')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Registrati</Text>

            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfInput]}>
                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nome *"
                  placeholderTextColor={COLORS.textSecondary}
                  value={nome}
                  onChangeText={setNome}
                />
              </View>

              <View style={[styles.inputContainer, styles.halfInput]}>
                <TextInput
                  style={styles.input}
                  placeholder="Cognome *"
                  placeholderTextColor={COLORS.textSecondary}
                  value={cognome}
                  onChangeText={setCognome}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email *"
                placeholderTextColor={COLORS.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Telefono (opzionale)"
                placeholderTextColor={COLORS.textSecondary}
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password *"
                placeholderTextColor={COLORS.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Conferma Password *"
                placeholderTextColor={COLORS.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.buttonText}>Registrati</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Hai già un account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.loginLink}>Accedi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  backButton: {
    marginTop: 16,
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  form: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 42,
    color: COLORS.text,
    fontSize: 10,
  },
  eyeButton: {
    padding: 8,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  loginLink: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '600',
  },
});
