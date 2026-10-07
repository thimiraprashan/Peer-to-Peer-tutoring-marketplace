import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Avatar } from '../../components/ui/Avatar';
import { AppButton } from '../../components/ui/AppButton';
import { StatCard } from '../../components/admin/StatCard';
import { QuickActionCard } from '../../components/admin/QuickActionCard';
import { ActivityItem } from '../../components/admin/ActivityItem';
import {
  AdminActivityItem,
  AdminDashboardStats,
  getAdminDashboardStats,
  getRecentAdminActivity,
} from '../../services/adminService';
import { logoutUser } from '../../services/authService';
import { useCurrentUser } from '../../hooks/useCurrentUser';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useCurrentUser();

  // Dashboard state
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [activities, setActivities] = useState<AdminActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [profileModalVisible, setProfileModalVisible] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  // Fetch dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      const [fetchedStats, fetchedActivities] = await Promise.all([
        getAdminDashboardStats(),
        getRecentAdminActivity(),
      ]);
      setStats(fetchedStats);
      setActivities(fetchedActivities);
    } catch (error) {
      console.error('Failed to load admin dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
      setProfileModalVisible(false);
      router.replace('/login' as any);
    } catch (e: any) {
      Alert.alert('Logout failed', e?.message || 'Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const adminName = profile?.name || 'Administrator';
  const adminEmail = user?.email || 'admin@peertutor.ac.uk';

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
        {/* 1. Header Area */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <View style={styles.platformBadge}>
              <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
              <Text style={styles.platformBadgeText}>Admin Console</Text>
            </View>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>Manage your platform & oversee operations</Text>
          </View>

          <Pressable
            onPress={() => setProfileModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Admin Profile and Account Options"
            style={styles.profileButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Avatar name={adminName} size={46} />
            <View style={styles.onlineDot} />
          </Pressable>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading dashboard metrics...</Text>
          </View>
        ) : (
          <>
            {/* 2. Statistics Cards Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Overview Statistics</Text>
                <Text style={styles.sectionCaption}>Live Platform Metrics</Text>
              </View>

              <View style={styles.statsGrid}>
                {/* Row 1 */}
                <View style={styles.statsRow}>
                  <StatCard
                    label="Total Users"
                    value={stats?.totalUsers ?? 0}
                    icon="people"
                    iconBgColor={colors.lightGreen}
                    iconColor={colors.primary}
                    badgeText="Active"
                    badgeVariant="success"
                    onPress={() => router.push('/admin/users' as any)}
                  />
                  <View style={styles.gridGap} />
                  <StatCard
                    label="Total Tutors"
                    value={stats?.totalTutors ?? 0}
                    icon="school"
                    iconBgColor="#E8F5E9"
                    iconColor="#2E7D32"
                    badgeText="Verified"
                    badgeVariant="default"
                    onPress={() => router.push('/admin/users' as any)}
                  />
                </View>

                {/* Row 2 */}
                <View style={[styles.statsRow, { marginTop: 12 }]}>
                  <StatCard
                    label="Pending Verifications"
                    value={stats?.pendingVerifications ?? 0}
                    icon="shield-checkmark"
                    iconBgColor="#FEF3C7"
                    iconColor="#D97706"
                    badgeText="Review"
                    badgeVariant="warning"
                    onPress={() => router.push('/admin/verifications' as any)}
                  />
                  <View style={styles.gridGap} />
                  <StatCard
                    label="Open Reports"
                    value={stats?.openReports ?? 0}
                    icon="alert-circle"
                    iconBgColor="#FEE2E2"
                    iconColor="#DC2626"
                    badgeText="Action"
                    badgeVariant="error"
                    onPress={() => router.push('/admin/reports' as any)}
                  />
                </View>
              </View>
            </View>

            {/* 3. Quick Action Area */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <Text style={styles.sectionCaption}>Key Admin Workflows</Text>
              </View>

              <View style={styles.quickActionsList}>
                <QuickActionCard
                  title="Verification Queue"
                  subtitle="Review credentials, diplomas & certificates"
                  icon="shield-checkmark-outline"
                  iconBgColor="#FEF3C7"
                  iconColor="#D97706"
                  badgeText={`${stats?.pendingVerifications ?? 0} Pending`}
                  badgeColor="#D97706"
                  onPress={() => router.push('/admin/verifications' as any)}
                />

                <QuickActionCard
                  title="View Reports"
                  subtitle="Investigate flagged communications & disputes"
                  icon="flag-outline"
                  iconBgColor="#FEE2E2"
                  iconColor="#DC2626"
                  badgeText={`${stats?.openReports ?? 0} Open`}
                  badgeColor="#DC2626"
                  onPress={() => router.push('/admin/reports' as any)}
                />

                <QuickActionCard
                  title="Manage Users"
                  subtitle="Search users, inspect records & handle status"
                  icon="people-outline"
                  iconBgColor={colors.lightGreen}
                  iconColor={colors.primary}
                  onPress={() => router.push('/admin/users' as any)}
                />
              </View>
            </View>

            {/* 4. Recent Activity / Notifications Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <Text style={styles.sectionCaption}>Latest Reports & Requests</Text>
              </View>

              <View style={styles.activitiesList}>
                {activities.map((item) => (
                  <ActivityItem
                    key={item.id}
                    item={item}
                    onPress={() => router.push(item.route as any)}
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Admin Profile & Logout Modal */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setProfileModalVisible(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Avatar name={adminName} size={64} />
              <Text style={styles.modalName}>{adminName}</Text>
              <Text style={styles.modalEmail}>{adminEmail}</Text>
              <View style={styles.modalRoleBadge}>
                <Ionicons name="shield" size={12} color={colors.primary} />
                <Text style={styles.modalRoleText}>Platform Administrator</Text>
              </View>
            </View>

            <View style={styles.modalDivider} />

            <View style={styles.modalActions}>
              <AppButton
                title="Sign Out"
                onPress={handleLogout}
                loading={loggingOut}
                disabled={loggingOut}
                variant="outline"
              />
              <View style={{ height: 10 }} />
              <AppButton
                title="Close"
                onPress={() => setProfileModalVisible(false)}
                disabled={loggingOut}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  platformBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    marginTop: 3,
  },
  profileButton: {
    position: 'relative',
    marginTop: 2,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: colors.card,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  sectionCaption: {
    fontSize: 12,
    color: colors.mutedText,
    fontWeight: '500',
  },
  statsGrid: {
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
  },
  gridGap: {
    width: 12,
  },
  quickActionsList: {
    gap: 10,
  },
  activitiesList: {
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  modalEmail: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  modalRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 10,
  },
  modalRoleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  modalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  modalActions: {
    width: '100%',
  },
});
