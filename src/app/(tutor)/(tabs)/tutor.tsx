import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../../contexts/AuthContext";
import { getTutorBookings } from "../../../services/bookingService";
import {
  getTutorProfile,
  getVerificationStatus,
} from "../../../services/tutorService";

// ---------- GREEN THEME (matches the rest of the app) ----------
const GREEN_THEME = {
  headerBg: "#D9E6D0",
  screenBg: "#EAF2E5",
  primaryGreen: "#5E8C5A",
  darkGreenText: "#3B5D3A",
  lightGreenBtn: "#D6E8D0",
  white: "#FFFFFF",
  textDark: "#2E2E2E",
  textGray: "#7A8A7A",
  borderLight: "#DDE8D8",
  warningBg: "#FFF4E6",
  warningText: "#F5A623",
  infoText: "#4A90E2",
};

interface TutorBooking {
  id: string;
  status: string;
  price?: number;
  studentName?: string;
  subjectCode?: string;
  date?: string;
  startTime?: string;
}

export default function TutorDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [bookings, setBookings] = useState<TutorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(
    null,
  );

  // ---------- Load all data on focus ----------
  const loadData = async () => {
    try {
      const uid = user?.uid;
      if (!uid) return;

      const [bookingsData, profileData, verificationData] = await Promise.all([
        getTutorBookings(uid),
        getTutorProfile(uid),
        getVerificationStatus(uid),
      ]);

      const profileIsVerified =
        !!profileData &&
        typeof profileData === "object" &&
        "verified" in profileData &&
        profileData.verified === true;

      const verificationValue =
        verificationData &&
        typeof verificationData === "object" &&
        "status" in verificationData &&
        typeof verificationData.status === "string"
          ? verificationData.status
          : null;

      setBookings(bookingsData || []);
      setVerificationStatus(profileIsVerified ? "Verified" : verificationValue);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("Dashboard load error:", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ---------- Filter bookings by status ----------
  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings.filter((b) =>
    ["approved", "rescheduled"].includes(b.status),
  );
  const completed = bookings.filter((b) => b.status === "completed");
  const earned = completed.reduce((sum, b) => sum + (b.price || 0), 0);

  // ---------- Profile verification banner ----------
  const renderProfileBanner = () => {
    if (verificationStatus === "Verified") {
      return (
        <View style={styles.verifiedBadge}>
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={GREEN_THEME.primaryGreen}
          />
          <Text style={styles.verifiedText}>Profile Verified</Text>
        </View>
      );
    }

    if (!verificationStatus) {
      return (
        <TouchableOpacity
          style={styles.profileBanner}
          onPress={() => router.push("/(tutor)/tutor-profile-form" as Href)}
        >
          <View style={styles.bannerIcon}>
            <Ionicons
              name="person-add-outline"
              size={22}
              color={GREEN_THEME.white}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Complete Your Profile</Text>
            <Text style={styles.bannerDesc}>
              Submit your details to start tutoring
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={GREEN_THEME.darkGreenText}
          />
        </TouchableOpacity>
      );
    }

    if (verificationStatus === "submitted") {
      return (
        <TouchableOpacity style={styles.pendingBanner}>
          <View style={styles.bannerIconPending}>
            <Ionicons
              name="time-outline"
              size={22}
              color={GREEN_THEME.warningText}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Verification Pending</Text>
            <Text style={styles.bannerDesc}>
              Admin is reviewing your profile
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (verificationStatus === "rejected") {
      return (
        <TouchableOpacity style={styles.rejectedBanner}>
          <View style={styles.bannerIconRejected}>
            <Ionicons name="close-circle-outline" size={22} color="#C62828" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Verification Rejected</Text>
            <Text style={styles.bannerDesc}>
              Tap to see reason and re-submit
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hello, {user?.name || "Tutor"}</Text>
          <Text style={styles.subGreeting}>Manage your tutoring sessions</Text>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.push("/(tutor)/profile" as Href)}
        >
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || "T"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderProfileBanner()}

        {/* Info box when pending requests exist */}
        {!loading && pending.length > 0 && (
          <View style={styles.infoBox}>
            <Ionicons
              name="information-circle"
              size={20}
              color={GREEN_THEME.primaryGreen}
            />
            <Text style={styles.infoText}>
              You have {pending.length} pending request
              {pending.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons
              name="time-outline"
              size={24}
              color={GREEN_THEME.warningText}
            />
            <Text style={styles.statNum}>{pending.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons
              name="calendar-outline"
              size={24}
              color={GREEN_THEME.infoText}
            />
            <Text style={styles.statNum}>{upcoming.length}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons
              name="cash-outline"
              size={24}
              color={GREEN_THEME.primaryGreen}
            />
            <Text style={styles.statNum}>
              Rs {earned > 1000 ? `${Math.round(earned / 1000)}k` : earned}
            </Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
        </View>

        {/* Pending requests */}
        <Text style={styles.sectionTitle}>Pending Requests</Text>
        {loading ? (
          <ActivityIndicator
            color={GREEN_THEME.primaryGreen}
            style={{ marginTop: 20 }}
          />
        ) : pending.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="checkmark-done-outline"
              size={40}
              color={GREEN_THEME.borderLight}
            />
            <Text style={styles.emptyText}>No pending requests</Text>
          </View>
        ) : (
          pending.slice(0, 3).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.requestCard}
              onPress={() =>
                router.push({
                  pathname: "/(tutor)/RequestDetails",
                  params: { bookingId: item.id },
                } as Href)
              }
            >
              <View style={styles.requestHeader}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentAvatarText}>
                    {item.studentName?.charAt(0).toUpperCase() || "S"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>
                    {item.studentName || "Student"}
                  </Text>
                  <Text style={styles.requestModule}>{item.subjectCode}</Text>
                </View>
              </View>
              <View style={styles.requestDetails}>
                <View style={styles.requestDetailItem}>
                  <Ionicons
                    name="calendar"
                    size={14}
                    color={GREEN_THEME.textGray}
                  />
                  <Text style={styles.requestDetailText}>{item.date}</Text>
                </View>
                <View style={styles.requestDetailItem}>
                  <Ionicons
                    name="time"
                    size={14}
                    color={GREEN_THEME.textGray}
                  />
                  <Text style={styles.requestDetailText}>{item.startTime}</Text>
                </View>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]}>
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]}>
                  <Text style={styles.acceptText}>View</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Upcoming sessions */}
        <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
        {loading ? null : upcoming.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="calendar-outline"
              size={40}
              color={GREEN_THEME.borderLight}
            />
            <Text style={styles.emptyText}>No upcoming sessions</Text>
          </View>
        ) : (
          upcoming.slice(0, 2).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.sessionCard}
              onPress={() => router.push("/(tutor)/sessions" as Href)}
            >
              <View style={styles.sessionAvatar}>
                <Text style={styles.sessionAvatarText}>
                  {item.studentName?.charAt(0).toUpperCase() || "S"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionName}>
                  {item.studentName || "Student"}
                </Text>
                <Text style={styles.sessionModule}>
                  {item.subjectCode} • {item.date} {item.startTime}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={GREEN_THEME.textGray}
              />
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GREEN_THEME.screenBg },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 20,
    backgroundColor: GREEN_THEME.headerBg,
  },
  greeting: {
    fontSize: 20,
    fontWeight: "bold",
    color: GREEN_THEME.darkGreenText,
  },
  subGreeting: {
    fontSize: 13,
    color: GREEN_THEME.textGray,
    marginTop: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: GREEN_THEME.primaryGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: GREEN_THEME.white,
    fontSize: 20,
    fontWeight: "bold",
  },

  // Profile banner
  profileBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_THEME.white,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: GREEN_THEME.borderLight,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_THEME.warningBg,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  rejectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN_THEME.primaryGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  bannerIconPending: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF0D6",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerIconRejected: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFD9D9",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: GREEN_THEME.textDark,
  },
  bannerDesc: {
    fontSize: 12,
    color: GREEN_THEME.textGray,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: GREEN_THEME.lightGreenBtn,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "600",
    color: GREEN_THEME.darkGreenText,
  },

  // Info box
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_THEME.lightGreenBtn,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  infoText: {
    color: GREEN_THEME.darkGreenText,
    fontWeight: "600",
    fontSize: 13,
  },

  // Stats
  statsRow: { flexDirection: "row", padding: 20, gap: 10 },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    gap: 4,
    backgroundColor: GREEN_THEME.white,
    borderWidth: 1,
    borderColor: GREEN_THEME.borderLight,
  },
  statNum: {
    fontSize: 16,
    fontWeight: "bold",
    color: GREEN_THEME.textDark,
  },
  statLabel: { fontSize: 11, color: GREEN_THEME.textGray },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: GREEN_THEME.textDark,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },

  // Request card
  requestCard: {
    backgroundColor: GREEN_THEME.white,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GREEN_THEME.borderLight,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN_THEME.infoText,
    justifyContent: "center",
    alignItems: "center",
  },
  studentAvatarText: {
    color: GREEN_THEME.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  studentName: {
    fontSize: 15,
    fontWeight: "600",
    color: GREEN_THEME.textDark,
  },
  requestModule: {
    fontSize: 12,
    color: GREEN_THEME.textGray,
    marginTop: 2,
  },
  requestDetails: { flexDirection: "row", gap: 16, marginBottom: 12 },
  requestDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  requestDetailText: { fontSize: 12, color: GREEN_THEME.textGray },
  requestActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  rejectBtn: { backgroundColor: "#FFE8E8" },
  acceptBtn: { backgroundColor: GREEN_THEME.primaryGreen },
  rejectText: { color: "#E74C3C", fontWeight: "600", fontSize: 13 },
  acceptText: { color: GREEN_THEME.white, fontWeight: "600", fontSize: 13 },

  // Session card
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_THEME.white,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: GREEN_THEME.borderLight,
  },
  sessionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN_THEME.lightGreenBtn,
    justifyContent: "center",
    alignItems: "center",
  },
  sessionAvatarText: {
    color: GREEN_THEME.primaryGreen,
    fontSize: 16,
    fontWeight: "bold",
  },
  sessionName: {
    fontSize: 14,
    fontWeight: "600",
    color: GREEN_THEME.textDark,
  },
  sessionModule: {
    fontSize: 12,
    color: GREEN_THEME.textGray,
    marginTop: 2,
  },

  emptyBox: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: GREEN_THEME.textGray, marginTop: 8, fontSize: 13 },
});
