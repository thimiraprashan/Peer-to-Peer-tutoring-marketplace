import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../../components/ui/Avatar";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
  cancelBooking,
  getStudentBookings,
} from "../../services/bookingService";
import { colors } from "../../theme/colors";

// ── Types ────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  tutorId: string;
  tutorName: string;
  studentId: string;
  studentName: string;
  subjectCode: string;
  date: string;
  startTime: string;
  endTime?: string;
  mode: string;
  note?: string;
  price: number;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "rescheduled";
  createdAt?: string;
  slotId?: string | null;
}

type TabKey = "upcoming" | "past" | "all";

// ── Helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: {
    label: "Pending",
    color: "#B45309",
    bg: "#FEF3C7",
    icon: "time-outline",
  },
  confirmed: {
    label: "Confirmed",
    color: "#065F46",
    bg: "#D1FAE5",
    icon: "checkmark-circle-outline",
  },
  completed: {
    label: "Completed",
    color: "#1E40AF",
    bg: "#DBEAFE",
    icon: "ribbon-outline",
  },
  cancelled: {
    label: "Cancelled",
    color: "#991B1B",
    bg: "#FEE2E2",
    icon: "close-circle-outline",
  },
  rescheduled: {
    label: "Rescheduled",
    color: "#6D28D9",
    bg: "#EDE9FE",
    icon: "refresh-outline",
  },
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const formatTime = (t: string): string => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m < 10 ? "0" + m : m} ${ampm}`;
};

const isUpcoming = (booking: Booking): boolean => {
  if (!booking.date) return false;
  const [y, mo, d] = booking.date.split("-").map(Number);
  const bookingDate = new Date(y, mo - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    bookingDate >= today &&
    booking.status !== "cancelled" &&
    booking.status !== "completed"
  );
};

const isPast = (booking: Booking): boolean =>
  booking.status === "completed" || booking.status === "cancelled" || (() => {
    if (!booking.date) return false;
    const [y, mo, d] = booking.date.split("-").map(Number);
    const bookingDate = new Date(y, mo - 1, d);
    bookingDate.setHours(23, 59, 59);
    return bookingDate < new Date();
  })();

// ── Main Screen ──────────────────────────────────────────────────────

export default function BookingsScreen() {
  const router = useRouter();
  const { user, profile } = useCurrentUser();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const data = await getStudentBookings(user.uid);
      setBookings(data as Booking[]);
    } catch (err) {
      console.error("Error loading bookings:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadBookings();
    }, [loadBookings])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const handleCancel = (booking: Booking) => {
    Alert.alert(
      "Cancel Booking",
      `Are you sure you want to cancel your session with ${booking.tutorName} on ${formatDate(booking.date)}?`,
      [
        { text: "Keep It", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: async () => {
            setCancellingId(booking.id);
            try {
              await cancelBooking(
                booking.id,
                booking.tutorId,
                profile?.name || "Student"
              );
              await loadBookings();
            } catch {
              Alert.alert("Error", "Could not cancel the booking. Please try again.");
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleOpenTutorProfile = (tutorId: string) => {
    router.push({
      pathname: "/(student)/tutor-profile",
      params: { tutorId },
    } as any);
  };

  // Filter bookings based on active tab
  const filtered = bookings.filter((b) => {
    if (activeTab === "upcoming") return isUpcoming(b);
    if (activeTab === "past") return isPast(b);
    return true;
  });

  const upcomingCount = bookings.filter(isUpcoming).length;
  const pastCount = bookings.filter(isPast).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your bookings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Bookings</Text>
          <Text style={styles.headerSub}>
            {bookings.length} total · {upcomingCount} upcoming
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          hitSlop={8}
          accessibilityLabel="Refresh bookings"
        >
          <Ionicons name="refresh-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Tab Selector ── */}
      <View style={styles.tabBar}>
        {(
          [
            { key: "upcoming", label: "Upcoming", count: upcomingCount },
            { key: "past", label: "Past", count: pastCount },
            { key: "all", label: "All", count: bookings.length },
          ] as { key: TabKey; label: string; count: number }[]
        ).map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  activeTab === tab.key && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === tab.key && styles.tabBadgeTextActive,
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* ── List ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          filtered.length === 0 && styles.scrollContentEmpty,
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
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name={activeTab === "upcoming" ? "calendar-outline" : "time-outline"}
                size={52}
                color={colors.mutedText}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === "upcoming"
                ? "No upcoming sessions"
                : activeTab === "past"
                ? "No past sessions"
                : "No bookings yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "upcoming"
                ? "Browse tutors and request a session to get started."
                : "Your completed and cancelled sessions will appear here."}
            </Text>
            {activeTab === "upcoming" && (
              <TouchableOpacity
                style={styles.findTutorBtn}
                onPress={() => router.push("/(student)/search" as any)}
              >
                <Ionicons name="search-outline" size={16} color={colors.card} />
                <Text style={styles.findTutorText}>Find a Tutor</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map((booking) => {
            const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
            const isCancelling = cancellingId === booking.id;
            const canCancel =
              booking.status === "pending" || booking.status === "confirmed";

            return (
              <View key={booking.id} style={styles.bookingCard}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <Pressable
                    onPress={() => handleOpenTutorProfile(booking.tutorId)}
                    style={styles.tutorRow}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${booking.tutorName}'s profile`}
                  >
                    <Avatar name={booking.tutorName} size={44} />
                    <View style={styles.tutorInfo}>
                      <Text style={styles.tutorName}>{booking.tutorName}</Text>
                      <Text style={styles.subjectText}>
                        {booking.subjectCode || "General Tutoring"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.mutedText}
                    />
                  </Pressable>

                  {/* Status Badge */}
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={13} color={cfg.color} />
                    <Text style={[styles.statusText, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Session Info Grid */}
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>Date</Text>
                      <Text style={styles.infoValue}>
                        {formatDate(booking.date)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoItem}>
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>Time</Text>
                      <Text style={styles.infoValue}>
                        {formatTime(booking.startTime)}
                        {booking.endTime
                          ? ` – ${formatTime(booking.endTime)}`
                          : ""}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoItem}>
                    <Ionicons
                      name={
                        booking.mode === "in-person"
                          ? "people-outline"
                          : "videocam-outline"
                      }
                      size={15}
                      color={colors.primary}
                    />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>Mode</Text>
                      <Text style={styles.infoValue}>
                        {booking.mode === "in-person" ? "In-person" : "Online"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoItem}>
                    <Ionicons
                      name="cash-outline"
                      size={15}
                      color={colors.primary}
                    />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>Price</Text>
                      <Text style={styles.infoValue}>
                        LKR {(booking.price || 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Note (if any) */}
                {!!booking.note && (
                  <View style={styles.noteRow}>
                    <Ionicons
                      name="chatbox-ellipses-outline"
                      size={14}
                      color={colors.mutedText}
                    />
                    <Text style={styles.noteText} numberOfLines={2}>
                      {booking.note}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() => handleOpenTutorProfile(booking.tutorId)}
                    accessibilityLabel="View tutor profile"
                  >
                    <Ionicons name="person-outline" size={15} color={colors.primary} />
                    <Text style={styles.actionBtnSecondaryText}>View Profile</Text>
                  </TouchableOpacity>

                  {canCancel && (
                    <TouchableOpacity
                      style={[
                        styles.actionBtnDanger,
                        isCancelling && styles.actionBtnDisabled,
                      ]}
                      onPress={() => handleCancel(booking)}
                      disabled={isCancelling}
                      accessibilityLabel="Cancel booking"
                    >
                      {isCancelling ? (
                        <ActivityIndicator size="small" color="#991B1B" />
                      ) : (
                        <>
                          <Ionicons
                            name="close-circle-outline"
                            size={15}
                            color="#991B1B"
                          />
                          <Text style={styles.actionBtnDangerText}>Cancel</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {booking.status === "confirmed" && (
                    <TouchableOpacity
                      style={styles.actionBtnPrimary}
                      onPress={() =>
                        router.push({
                          pathname: "/(student)/tutor-profile",
                          params: { tutorId: booking.tutorId },
                        } as any)
                      }
                      accessibilityLabel="Book again with this tutor"
                    >
                      <Ionicons name="calendar" size={15} color={colors.card} />
                      <Text style={styles.actionBtnPrimaryText}>Details</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedText,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  headerSub: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.lightGreen,
    borderRadius: 22,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.mutedText,
  },
  tabLabelActive: {
    color: colors.card,
  },
  tabBadge: {
    backgroundColor: colors.border,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.mutedText,
  },
  tabBadgeTextActive: {
    color: colors.card,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  scrollContentEmpty: {
    flex: 1,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
    paddingTop: 40,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: "center",
    lineHeight: 20,
  },
  findTutorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 8,
  },
  findTutorText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.card,
  },

  // Booking card
  bookingCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  tutorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  tutorInfo: {
    flex: 1,
  },
  tutorName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  subjectText: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 14,
  },

  // Info grid
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    width: "46%",
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.mutedText,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginTop: 1,
  },

  // Note
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
  },

  // Card actions
  cardActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  actionBtnDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnDangerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#991B1B",
  },
  actionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.card,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
});
