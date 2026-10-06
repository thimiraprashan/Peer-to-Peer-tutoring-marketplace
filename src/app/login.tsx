import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { AppButton } from '../components/ui/AppButton';
import { AppInput } from '../components/ui/AppInput';
import { loginUser } from '../services/authService';

const VALID_ROLES = ['student', 'tutor', 'admin'];

export default function Login() {
  const router = useRouter();

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

      router.replace(`/${profile.role}` as any); // /student, /tutor or /admin
    } catch (e: any) {
      Alert.alert('Login failed', getFriendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
            icon="mail-outline"
            error={emailError}
          />

          <AppInput
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError('');
            }}
            placeholder="Enter your password"
            secureTextEntry
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
          >
            <Text style={styles.registerLink}>Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingVertical: 36,
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
    // Soft shadow
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
  registerLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
});