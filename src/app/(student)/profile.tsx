import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebase';
import { colors } from '../../theme/colors';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { Avatar } from '../../components/ui/Avatar';
import { getUserProfile, logoutUser, updateUserProfile } from '../../services/authService';

export default function ProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Edit profile modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFaculty, setEditFaculty] = useState('');
  const [editNameError, setEditNameError] = useState('');
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
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

  const openEditModal = () => {
    setEditName(profile?.name || '');
    setEditFaculty(profile?.faculty || '');
    setEditNameError('');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    const trimmedName = editName.trim();
    if (trimmedName.length === 0) {
      setEditNameError('Name cannot be empty');
      return;
    }
    if (trimmedName.length < 2) {
      setEditNameError('Name must be at least 2 characters');
      return;
    }
    setEditNameError('');

    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Error', 'You must be signed in to update your profile.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateUserProfile(uid, {
        name: trimmedName,
        faculty: editFaculty.trim(),
      });
      setProfile(updated);
      setEditModalVisible(false);
      Alert.alert('Profile Updated', 'Your profile has been updated successfully.');
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not update profile.');
    } finally {
      setSaving(false);
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

        {/* Edit Profile Button */}
        <Pressable
          style={({ pressed }) => [
            styles.editProfileBtn,
            pressed && styles.editProfileBtnPressed,
          ]}
          onPress={openEditModal}
          accessibilityRole="button"
          accessibilityLabel="Edit Profile"
        >
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={styles.editProfileBtnText}>Edit Profile</Text>
        </Pressable>
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

      {/* ── Edit Profile Modal ── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color={colors.mutedText} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Avatar preview */}
              <View style={styles.modalAvatarRow}>
                <Avatar name={editName || name} size={64} />
              </View>

              <AppInput
                label="Full Name"
                value={editName}
                onChangeText={(text: string) => {
                  setEditName(text);
                  if (editNameError) setEditNameError('');
                }}
                placeholder="Your full name"
                icon="person-outline"
                error={editNameError}
                returnKeyType="next"
              />

              <AppInput
                label="Email"
                value={email}
                onChangeText={() => {}}
                placeholder=""
                icon="mail-outline"
                editable={false}
              />
              <Text style={styles.emailHint}>
                Email cannot be changed after registration
              </Text>

              <AppInput
                label="Faculty (Optional)"
                value={editFaculty}
                onChangeText={setEditFaculty}
                placeholder="e.g. Computing / Engineering"
                icon="business-outline"
                returnKeyType="done"
                onSubmitEditing={handleSaveProfile}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <View style={styles.modalBtnFlex}>
                <AppButton
                  title="Cancel"
                  onPress={() => setEditModalVisible(false)}
                  variant="outline"
                  disabled={saving}
                />
              </View>
              <View style={styles.modalBtnFlex}>
                <AppButton
                  title="Save Changes"
                  onPress={handleSaveProfile}
                  loading={saving}
                  disabled={saving}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.lightGreen,
  },
  editProfileBtnPressed: {
    opacity: 0.7,
  },
  editProfileBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 22,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalAvatarRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  emailHint: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalBtnFlex: {
    flex: 1,
  },
});
