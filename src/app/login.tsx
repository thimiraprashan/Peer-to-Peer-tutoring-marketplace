import React, { useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { AppButton } from '../components/ui/AppButton';
import { AppInput } from '../components/ui/AppInput';
import { loginUser } from '../services/authService';

const VALID_ROLES = ['student', 'tutor', 'admin'];

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Input refs for keyboard navigation
  const passwordInputRef = useRef<TextInput>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation error states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Map Firebase errors to human-friendly messages
  const getFriendlyErrorMessage = (error: any) => {
    const code = error?.code || '';
    const message = error?.message || '';

    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/user-not-found' ||
      code === 'auth/wrong-password'
    ) {
      return 'Incorrect email or password';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many attempts. Try again later';
    }
    if (
      code === 'auth/network-request-failed' ||
      message.toLowerCase().includes('network')
    ) {
      return 'Check your internet connection';
    }
    return message || 'An unexpected error occurred. Please try again.';
  };

  const handleLogin = async () => {
    Keyboard.dismiss();

    // Reset validation errors
    setEmailError('');
    setPasswordError('');

    let hasError = false;
    const trimmedEmail = email.trim();

    // Inline validation for email
    if (!trimmedEmail) {
      setEmailError('Email is required');
      hasError = true;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setEmailError('Enter a valid email');
        hasError = true;
      }
    }

    // Inline validation for password
    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);
    try {
      const profile: any = await loginUser(trimmedEmail, password);
      if (!profile) {
        Alert.alert('Error', 'No profile found for this account.');
        return;
      }

      if (!VALID_ROLES.includes(profile.role)) {
        Alert.alert('Error', `Invalid user role "${profile.role}".`);
        return;
      }

      const destination = profile.role === 'student' ? '/(student)' : `/${profile.role}`;
      router.replace(destination as any);
    } catch (e: any) {
      Alert.alert('Login failed', getFriendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 16, 36),
              paddingBottom: Math.max(insets.bottom + 16, 36),
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Header Section */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="school" size={40} color={colors.primary} />
            </View>
            <Text style={styles.appName}>PeerTutor</Text>
            <Text style={styles.tagline}>Find trusted tutors for your modules</Text>
          </View>

          {/* Card Section */}
          <View style={styles.card}>
            <AppInput
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
              }}
              placeholder="student@university.ac.uk"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              blurOnSubmit={false}
              icon="mail-outline"
              error={emailError}
            />

            <AppInput
              inputRef={passwordInputRef}
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError('');
              }}
              placeholder="Enter your password"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              icon="lock-closed-outline"
              error={passwordError}
            />

            <View style={styles.buttonContainer}>
              <AppButton
                title="Login"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
              />
            </View>
          </View>

          {/* Bottom Navigation Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>New here? </Text>
            <Pressable
              onPress={() => router.push('/register' as any)}
              accessibilityRole="button"
              accessibilityLabel="Create an account"
              style={styles.linkTouchable}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.registerLink}>Create an account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  buttonContainer: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    color: colors.mutedText,
  },
  linkTouchable: {
    minHeight: 48,
    justifyContent: 'center',
  },
  registerLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
});