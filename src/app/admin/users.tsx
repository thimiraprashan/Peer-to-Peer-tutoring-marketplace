import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/ui/Avatar';
import {
  deleteUser,
  getAllUsers,
  updateUserStatus,
  User,
} from '../../services/usersService';
import { colors } from '../../theme/colors';

export default function AdminUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      setError(null);
      const fetchedUsers = await getAllUsers();
      setUsers(fetchedUsers);
      setFilteredUsers(fetchedUsers);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Search/filter users
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.role.toLowerCase().includes(query) ||
          user.faculty?.toLowerCase().includes(query) ||
          user.university?.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    const actionText = newStatus === 'suspended' ? 'suspend' : 'reactivate';

    Alert.alert(
      `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} User`,
      `Are you sure you want to ${actionText} ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          style: newStatus === 'suspended' ? 'destructive' : 'default',
          onPress: async () => {
            setUpdatingUserId(user.uid);
            try {
              await updateUserStatus(user.uid, newStatus);
              Alert.alert('Success', `User ${actionText}d successfully`);

              // Update local state
              setUsers((prev) =>
                prev.map((u) =>
                  u.uid === user.uid ? { ...u, status: newStatus } : u
                )
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || `Failed to ${actionText} user`);
            } finally {
              setUpdatingUserId(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = async (user: User) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${user.name}?\n\nThis action cannot be undone and will remove all user data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setUpdatingUserId(user.uid);
            try {
              await deleteUser(user.uid);
              Alert.alert('Success', 'User deleted successfully');

              // Remove from local state
              setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete user');
            } finally {
              setUpdatingUserId(null);
            }
          },
        },
      ]
    );
  };

  const getRoleIcon = (role: string): any => {
    switch (role.toLowerCase()) {
      case 'tutor':
        return 'school-outline';
      case 'admin':
        return 'shield-checkmark-outline';
      case 'student':
      default:
        return 'person-outline';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'tutor':
        return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'admin':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'student':
      default:
        return { bg: colors.lightGreen, text: colors.primary };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#D1FAE5', text: '#059669' };
      case 'suspended':
        return { bg: '#FEE2E2', text: '#DC2626' };
      default:
        return { bg: colors.lightGreen, text: colors.primary };
    }
  };

  const renderUserCard = (user: User) => {
    const roleColors = getRoleColor(user.role);
    const statusColors = getStatusColor(user.status);
    const isUpdating = updatingUserId === user.uid;

    return (
      <View key={user.uid} style={styles.userCard}>
        <View style={styles.userCardHeader}>
          <View style={styles.userAvatarRow}>
            <Avatar name={user.name} size={48} />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.userMetaRow}>
          <View style={styles.userBadges}>
            <View style={[styles.badge, { backgroundColor: roleColors.bg }]}>
              <Ionicons
                name={getRoleIcon(user.role)}
                size={12}
                color={roleColors.text}
              />
              <Text style={[styles.badgeText, { color: roleColors.text }]}>
                {user.role.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.badgeText, { color: statusColors.text }]}>
                {user.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {(user.faculty || user.university) && (
          <View style={styles.userDetails}>
            {user.faculty && (
              <View style={styles.detailRow}>
                <Ionicons
                  name="briefcase-outline"
                  size={14}
                  color={colors.mutedText}
                />
                <Text style={styles.detailText}>{user.faculty}</Text>
              </View>
            )}
            {user.university && (
              <View style={styles.detailRow}>
                <Ionicons
                  name="school-outline"
                  size={14}
                  color={colors.mutedText}
                />
                <Text style={styles.detailText}>{user.university}</Text>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Pressable
            style={[
              styles.actionButton,
              styles.statusButton,
              isUpdating && styles.actionButtonDisabled,
            ]}
            onPress={() => handleToggleStatus(user)}
            disabled={isUpdating}
          >
            <Ionicons
              name={
                user.status === 'active'
                  ? 'pause-circle-outline'
                  : 'play-circle-outline'
              }
              size={16}
              color={user.status === 'active' ? '#D97706' : '#059669'}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: user.status === 'active' ? '#D97706' : '#059669' },
              ]}
            >
              {user.status === 'active' ? 'Suspend' : 'Reactivate'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              styles.deleteButton,
              isUpdating && styles.actionButtonDisabled,
            ]}
            onPress={() => handleDeleteUser(user)}
            disabled={isUpdating}
          >
            <Ionicons name="trash-outline" size={16} color="#DC2626" />
            <Text style={[styles.actionButtonText, { color: '#DC2626' }]}>
              Delete
            </Text>
          </Pressable>
        </View>

        {isUpdating && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screenWrapper}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 12, 44),
            paddingBottom: Math.max(insets.bottom + 24, 40),
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>User Management</Text>
              <Text style={styles.subtitle}>
                {users.length} {users.length === 1 ? 'user' : 'users'} total
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        {!loading && !error && users.length > 0 && (
          <View style={styles.searchContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.mutedText}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, role, faculty..."
              placeholderTextColor={colors.mutedText}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                style={styles.searchClear}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.mutedText} />
              </Pressable>
            )}
          </View>
        )}

        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        )}

        {/* Error State */}
        {!loading && error && (
          <View style={styles.centerContainer}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle" size={48} color={colors.error} />
            </View>
            <Text style={styles.errorTitle}>Failed to Load Users</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && users.length === 0 && (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={48} color={colors.mutedText} />
            </View>
            <Text style={styles.emptyTitle}>No Users Found</Text>
            <Text style={styles.emptyMessage}>
              Users will appear here when they register
            </Text>
          </View>
        )}

        {/* Empty Search Results */}
        {!loading && !error && users.length > 0 && filteredUsers.length === 0 && (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={48} color={colors.mutedText} />
            </View>
            <Text style={styles.emptyTitle}>No Results Found</Text>
            <Text style={styles.emptyMessage}>
              Try adjusting your search query
            </Text>
          </View>
        )}

        {/* Users List */}
        {!loading && !error && filteredUsers.length > 0 && (
          <View style={styles.usersList}>
            {filteredUsers.map((user) => renderUserCard(user))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  searchClear: {
    marginLeft: 8,
  },
  centerContainer: {
    paddingVertical: 64,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 12,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
  },
  usersList: {
    gap: 12,
  },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userCardHeader: {
    marginBottom: 12,
  },
  userAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: colors.mutedText,
  },
  userMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  userDetails: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: colors.mutedText,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  statusButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  deleteButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
});
