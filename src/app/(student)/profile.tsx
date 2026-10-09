import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebase';
import { colors } from '../../theme/colors';
import { AppButton } from '../../components/ui/AppButton';
import { Avatar } from '../../components/ui/Avatar';
import { getUserProfile, logoutUser } from '../../services/authService';

export default function ProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const data = await getUserProfile(currentUser.uid);
          setProfile(data || { name: currentUser.displayName || 'Student', email: currentUser.email });
        }
      } catch (e: any) {
        Alert.alert('Error', 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
      router.replace('/login');
    } catch (e: any) {
      Alert.alert('Logout failed', e.message || 'Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const name = profile?.name || 'Student';
  const email = profile?.email || auth.currentUser?.email || '';

  return (
    <View style={styles.container}>
      {/* Profile Card */}
      <View style={styles.card}>
        <Avatar name={name} size={72} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
        {profile?.faculty ? (
          <Text style={styles.faculty}>{profile.faculty}</Text>
        ) : null}
      </View>

      {/* Study Planner Navigation Row */}
      <Pressable
        style={({ pressed }) => [
          styles.menuRow,
          pressed && styles.menuRowPressed,
        ]}
        onPress={() => router.push('/(student)/planner' as any)}
        accessibilityRole="button"
        accessibilityLabel="Open Study Planner"
      >
        <View style={styles.menuRowLeft}>
          <View style={styles.menuIconContainer}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>Study Planner</Text>
            <Text style={styles.menuSubtitle}>Manage exams, assignments & deadlines</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedText} />
      </Pressable>

      {/* Logout Button */}
      <View style={styles.buttonWrapper}>
        <AppButton
          title="Log Out"
          onPress={handleLogout}
          variant="outline"
          loading={loggingOut}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  email: {
    fontSize: 15,
    color: colors.mutedText,
    marginTop: 4,
  },
  faculty: {
    fontSize: 14,
    color: colors.primary,
    marginTop: 6,
    fontWeight: '500',
  },
  buttonWrapper: {
    marginTop: 8,
  },
  menuRow: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuRowPressed: {
    opacity: 0.8,
    backgroundColor: '#F9FCF8',
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
});
