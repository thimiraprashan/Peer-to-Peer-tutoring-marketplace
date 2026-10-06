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
import { registerUser } from '../services/authService';

const VALID_ROLES = ['student', 'tutor', 'admin'];

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Input refs for keyboard chaining
  const emailRef = useRef<TextInput>(null);
  const facultyRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Form input states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [faculty, setFaculty] = useState('');
  const [role, setRole] = useState<'student' | 'tutor'>('student');
  const [loading, setLoading] = useState(false);

  // Validation error states
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // Map Firebase errors to human-friendly messages
  const getFriendlyErrorMessage = (error: any) => {
    const code = error?.code || '';
    const message = error?.message || '';

    if (code === 'auth/email-already-in-use') {
      return 'This email is already registered';
    }
    if (code === 'auth/weak-password') {
      return 'Password is too weak';
    }
    if (
      code === 'auth/network-request-failed' ||
      message.toLowerCase().includes('network')
    ) {
      return 'Check your internet connection';
    }
    return message || 'Registration failed. Please try again.';
  };

  // Helper validation checks
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const isNameValid = trimmedName.length >= 2;
  const isEmailValid = emailRegex.test(trimmedEmail);
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = password === confirmPassword && confirmPassword.length > 0;

  // Button disabled until entire form is valid
  const isFormValid =
    isNameValid &&
    isEmailValid &&
    isPasswordValid &&
    isConfirmPasswordValid &&
    !loading;

  const handleRegister = async () => {
    Keyboard.dismiss();

    let hasError = false;

    if (!isNameValid) {
      setNameError(
        trimmedName.length === 0
          ? 'Name is required'
          : 'Name must be at least 2 characters'
      );
      hasError = true;
    } else {
      setNameError('');
    }

    if (!isEmailValid) {
      setEmailError(
        trimmedEmail.length === 0
          ? 'Email is required'
          : 'Enter a valid email'
      );
      hasError = true;
    } else {
      setEmailError('');
    }

    if (!isPasswordValid) {
      setPasswordError(
        password.length === 0
          ? 'Password is required'
          : 'Password must be at least 6 characters'
      );
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (!isConfirmPasswordValid) {
      setConfirmPasswordError(
        confirmPassword.length === 0
          ? 'Please confirm your password'
          : 'Passwords must match'
      );
      hasError = true;
    } else {
      setConfirmPasswordError('');
    }

    if (hasError) return;

    setLoading(true);
    try {
      const profile: any = await registerUser(
        trimmedName,
        trimmedEmail,
        password,
        role,
        faculty.trim()
      );

      if (!profile) {
        Alert.alert('Error', 'Failed to create user profile.');
        return;
      }

      if (!VALID_ROLES.includes(profile.role)) {
        Alert.alert('Error', `Invalid role "${profile.role}".`);
        return;
      }

      const destination = profile.role === 'student' ? '/(student)' : `/${profile.role}`;
      router.replace(destination as any);
    } catch (e: any) {
      Alert.alert('Registration failed', getFriendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 16, 36),
              paddingBottom: Math.max(insets.bottom + 24, 60),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Header Section */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="person-add" size={36} color={colors.primary} />
            </View>
            <Text style={styles.appName}>Create Account</Text>
            <Text style={styles.tagline}>Join PeerTutor as a student or tutor</Text>
          </View>

          {/* Card Section */}
          <View style={styles.card}>
            {/* Role Selection Cards */}
            <Text style={styles.sectionLabel}>I want to:</Text>
            <View style={styles.roleContainer}>
              <Pressable
                onPress={() => setRole('student')}
                accessibilityRole="button"
                accessibilityLabel="I need a tutor"
                style={[
                  styles.roleCard,
                  role === 'student' && styles.roleCardActive,
                ]}
              >
                <Ionicons
                  name="school-outline"
                  size={22}
                  color={role === 'student' ? colors.primary : colors.mutedText}
                />
                <Text
                  style={[
                    styles.roleText,
                    role === 'student' && styles.roleTextActive,
                  ]}
                >
                  I need a tutor
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setRole('tutor')}
                accessibilityRole="button"
                accessibilityLabel="I want to tutor"
                style={[
                  styles.roleCard,
                  role === 'tutor' && styles.roleCardActive,
                ]}
              >
                <Ionicons
                  name="book-outline"
                  size={22}
                  color={role === 'tutor' ? colors.primary : colors.mutedText}
                />
                <Text
                  style={[
                    styles.roleText,
                    role === 'tutor' && styles.roleTextActive,
                  ]}
                >
                  I want to tutor
                </Text>
              </Pressable>
            </View>

            {/* Form Fields */}
            <AppInput
              label="Full Name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError('');
              }}
              placeholder="John Doe"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
              icon="person-outline"
              error={nameError}
            />

            <AppInput
              inputRef={emailRef}
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
              }}
              placeholder="student@university.ac.uk"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => facultyRef.current?.focus()}
              blurOnSubmit={false}
              icon="mail-outline"
              error={emailError}
            />

            <AppInput
              inputRef={facultyRef}
              label="Faculty (Optional)"
              value={faculty}
              onChangeText={setFaculty}
              placeholder="e.g. Computing / Engineering"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
              icon="business-outline"
            />

            <AppInput
              inputRef={passwordRef}
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError('');
              }}
              placeholder="At least 6 characters"
              secureTextEntry
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              blurOnSubmit={false}
              icon="lock-closed-outline"
              error={passwordError}
            />

            <AppInput
              inputRef={confirmPasswordRef}
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmPasswordError) setConfirmPasswordError('');
              }}
              placeholder="Re-enter your password"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              icon="shield-checkmark-outline"
              error={confirmPasswordError}
            />

            <View style={styles.buttonContainer}>
              <AppButton
                title="Create Account"
                onPress={handleRegister}
                loading={loading}
                disabled={!isFormValid}
              />
            </View>
          </View>

          {/* Bottom Back-to-Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Log in"
              style={styles.linkTouchable}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.loginLink}>Log in</Text>
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
    marginBottom: 24,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 15,
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
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 10,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  roleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.lightGreen,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedText,
  },
  roleTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerText: {
    fontSize: 15,
    color: colors.mutedText,
  },
  linkTouchable: {
    minHeight: 48,
    justifyContent: 'center',
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
});
