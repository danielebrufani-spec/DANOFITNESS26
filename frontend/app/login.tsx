import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { COLORS } from '../src/utils/constants';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const MOTIVATIONAL_QUOTES = [
  "Il tuo corpo può farcela. È la tua mente che devi convincere.",
  "Ogni allenamento ti avvicina ai tuoi obiettivi.",
  "Non fermarti quando sei stanco. Fermati quando hai finito.",
  "Il dolore che senti oggi sarà la forza che sentirai domani.",
  "Suda oggi, brilla domani.",
  "Il fitness non è una destinazione, è uno stile di vita.",
  "Credi in te stesso e sarai inarrestabile.",
  "Un'ora di allenamento è il 4% della tua giornata.",
  "I campioni si allenano, i perdenti si lamentano.",
  "Trasforma il 'non posso' in 'guarda come faccio'.",
];

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentQuote, setCurrentQuote] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Animazione pulse per il logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Animazione rotazione lenta per gli elementi decorativi
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setCurrentQuote((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [fadeAnim]);

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Inserisci email e password');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      setErrorMessage(error.message || 'Errore durante il login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo Section con grafica fitness */}
        <View style={styles.logoSection}>
          {/* Cerchio esterno animato con icone fitness */}
          <Animated.View style={[styles.outerRing, { transform: [{ rotate: rotateInterpolate }] }]}>
            <View style={[styles.fitnessIcon, styles.iconTop]}>
              <Ionicons name="barbell" size={20} color={COLORS.primary} />
            </View>
            <View style={[styles.fitnessIcon, styles.iconRight]}>
              <Ionicons name="fitness" size={20} color={COLORS.primary} />
            </View>
            <View style={[styles.fitnessIcon, styles.iconBottom]}>
              <Ionicons name="heart" size={20} color={COLORS.primary} />
            </View>
            <View style={[styles.fitnessIcon, styles.iconLeft]}>
              <Ionicons name="flame" size={20} color={COLORS.primary} />
            </View>
          </Animated.View>

          {/* Cerchio glow */}
          <View style={styles.glowRing} />
          
          {/* Cerchio principale con logo */}
          <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.logoInnerGlow} />
            <Image 
              source={require('../assets/images/logo.jpg')} 
              style={styles.logoImage}
              resizeMode="cover"
            />
          </Animated.View>

          {/* Titolo sotto il logo */}
          <Text style={styles.brandName}>DanoFitness23</Text>
          <Text style={styles.brandTagline}>Train Hard • Stay Strong</Text>
        </View>

        {/* Frase Motivazionale */}
        <View style={styles.quoteContainer}>
          <Ionicons name="flash" size={16} color={COLORS.primary} />
          <Animated.Text style={[styles.quoteText, { opacity: fadeAnim }]}>
            "{MOTIVATIONAL_QUOTES[currentQuote]}"
          </Animated.Text>
          <Ionicons name="flash" size={16} color={COLORS.primary} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={COLORS.textSecondary}
              />
            </Pressable>
          </View>

          {/* Pulsante ACCEDI */}
          <Pressable
            style={[styles.buttonAccedi, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            // @ts-ignore
            onClick={Platform.OS === 'web' ? handleLogin : undefined}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>ACCEDI</Text>
              </>
            )}
          </Pressable>

          {/* Pulsante REGISTRATI */}
          <Pressable
            style={styles.buttonRegistrati}
            onPress={() => router.push('/register')}
            // @ts-ignore
            onClick={Platform.OS === 'web' ? () => router.push('/register') : undefined}
          >
            <Ionicons name="person-add-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={styles.buttonTextRegistrati}>REGISTRATI</Text>
          </Pressable>

          {/* Testo password dimenticata */}
          <Text style={styles.forgotPasswordText}>
            Se non ricordi la password, chiedi all'Altissimo Maestrissimo di resettartela... perché lui può tutto! 🙏
          </Text>
        </View>

        {/* Contatti */}
        <View style={styles.footer}>
          <View style={styles.footerCard}>
            <Ionicons name="call" size={18} color={COLORS.primary} />
            <View>
              <Text style={styles.footerName}>Daniele</Text>
              <Text style={styles.footerPhone}>339 50 20 625</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 20,
  },
  
  // ===== LOGO SECTION CON GRAFICA FITNESS =====
  logoSection: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  outerRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
  },
  fitnessIcon: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary + '50',
  },
  iconTop: {
    top: -18,
    left: '50%',
    marginLeft: -18,
  },
  iconRight: {
    right: -18,
    top: '50%',
    marginTop: -18,
  },
  iconBottom: {
    bottom: -18,
    left: '50%',
    marginLeft: -18,
  },
  iconLeft: {
    left: -18,
    top: '50%',
    marginTop: -18,
  },
  glowRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: COLORS.primary + '15',
  },
  logoContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 4,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  logoInnerGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.primary + '10',
  },
  logoImage: {
    width: 142,
    height: 142,
    borderRadius: 71,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: 16,
    letterSpacing: 3,
  },
  brandTagline: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
    letterSpacing: 2,
    fontWeight: '600',
  },

  // ===== QUOTE =====
  quoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    minHeight: 50,
    justifyContent: 'center',
    gap: 8,
  },
  quoteText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ===== FORM =====
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    color: COLORS.text,
    fontSize: 15,
  },
  eyeButton: {
    padding: 6,
  },
  buttonAccedi: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonRegistrati: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  buttonTextRegistrati: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  forgotPasswordText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 10,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // ===== FOOTER =====
  footer: {
    alignItems: 'center',
    paddingTop: 10,
  },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  footerName: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  footerPhone: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1,
  },
});
