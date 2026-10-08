import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../../firebase";
import { getTutorBookings } from "../../../services/bookingService";
import {
  createNotification,
  updateBookingStatus,
} from "../../../services/tutorService";

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
  warningText: "#F5A623",
  warningBg: "#FFF4E6",
  infoText: "#4A90E2",
  danger: "#E74C3C",
  dangerLight: "#FFE8E8",
  success: "#4CAF50",
  successLight: "#E8F5E9",
};

type FilterType = "upcoming" | "completed" | "cancelled";

interface Booking {
  id: string;
  status: string;
  studentId?: string;
  studentName?: string;
  subjectCode?: string;
  slotId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  mode?: string;
  note?: string;
  price?: number;
}

export default function TutorSessions() {
  const uid = auth?.currentUser?.uid;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<FilterType>("upcoming");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ---------- Load bookings ----------
  const loadData = async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      const data = await getTutorBookings(uid);
      setBookings((data as Booking[]) || []);
    } catch (error: any) {
      console.log("Sessions load error:", error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [uid]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ---------- Filters ----------
  const upcoming = bookings.filter((b) =>
    ["approved", "rescheduled"].includes(b.status),
  );
  const completed = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  const currentList =
    filter === "upcoming"
      ? upcoming
      : filter === "completed"
        ? completed
        : cancelled;

  // ---------- Mark Complete ----------
  const handleComplete = (booking: Booking) => {
    Alert.alert(
      "Mark Complete",
      `Mark session with ${booking.studentName || "student"} as completed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            setProcessingId(booking.id);
            try {
              await updateBookingStatus(booking.id, "completed");

              // 🔔 Cross-member agreement: notify student
              if (booking.studentId) {
                await createNotification(
                  booking.studentId,
                  "session_completed",
                  `Your session for ${booking.subjectCode} has been marked as completed. Please leave feedback.`,
                  booking.id,
                );
              }

              Alert.alert(
                "✅ Completed",
                "Session marked as complete. Student notified.",
              );
              loadData();
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Could not update.");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  // ---------- Mark Cancelled ----------
  const handleCancel = (booking: Booking) => {
    Alert.alert(
      "Cancel Session",
      "Cancel this session? The student will be notified.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Session",
          style: "destructive",
          onPress: async () => {
            setProcessingId(booking.id);
            try {
              await updateBookingStatus(booking.id, "cancelled");

              // 🔔 Notify student
              if (booking.studentId) {
                await createNotification(
                  booking.studentId,
                  "session_cancelled",
                  `Your session for ${booking.subjectCode} on ${booking.date} was cancelled.`,
                  booking.id,
                );
              }

              Alert.alert("Cancelled", "Student has been notified.");
              loadData();
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Could not cancel.");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  // ---------- Render one session card ----------
  const renderCard = (item: Booking) => {
    const isProcessing = processingId === item.id;
    const statusColor =
      item.status === "completed"
        ? GREEN_THEME.success
        : item.status === "cancelled"
          ? GREEN_THEME.danger
          : GREEN_THEME.infoText;

    const statusBg =
      item.status === "completed"
        ? GREEN_THEME.successLight
        : item.status === "cancelled"
          ? GREEN_THEME.dangerLight
          : "#E8F0FE";

    return (
      <View key={item.id} style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.studentName?.charAt(0).toUpperCase() || "S"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>
              {item.studentName || "Student"}
            </Text>
            <Text style={styles.subject}>{item.subjectCode || "Subject"}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={GREEN_THEME.textGray}
            />
            <Text style={styles.detailText}>{item.date}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons
              name="time-outline"
              size={14}
              color={GREEN_THEME.textGray}
            />
            <Text style={styles.detailText}>
              {item.startTime} - {item.endTime}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons
              name={item.mode === "online" ? "videocam" : "people"}
              size={14}
              color={GREEN_THEME.textGray}
            />
            <Text style={styles.detailText}>
              {item.mode === "online"
                ? "Online"
                : item.mode === "face"
                  ? "Face"
                  : "Both"}
            </Text>
          </View>
        </View>

        {/* Note */}
        {item.note ? (
          <View style={styles.noteBox}>
            <Ionicons
              name="chatbubble-outline"
              size={14}
              color={GREEN_THEME.textGray}
            />
            <Text style={styles.noteText}>{item.note}</Text>
          </View>
        ) : null}

        {/* Actions — only for upcoming */}
        {item.status === "approved" || item.status === "rescheduled" ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={() => handleCancel(item)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={GREEN_THEME.danger} />
              ) : (
                <>
                  <Ionicons
                    name="close-circle-outline"
                    size={16}
                    color={GREEN_THEME.danger}
                  />
                  <Text style={styles.cancelText}>Cancel</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.completeBtn]}
              onPress={() => handleComplete(item)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.completeText}>Mark Complete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Info message for completed/cancelled */}
        {item.status === "completed" ? (
          <View style={styles.infoMsg}>
            <Ionicons name="checkmark" size={14} color={GREEN_THEME.success} />
            <Text style={[styles.infoMsgText, { color: GREEN_THEME.success }]}>
              Session completed successfully
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GREEN_THEME.primaryGreen} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Sessions</Text>
        <Text style={styles.headerSub}>Manage your tutoring sessions</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            filter === "upcoming" && styles.filterActive,
          ]}
          onPress={() => setFilter("upcoming")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "upcoming" && styles.filterTextActive,
            ]}
          >
            Upcoming ({upcoming.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filter === "completed" && styles.filterActive,
          ]}
          onPress={() => setFilter("completed")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "completed" && styles.filterTextActive,
            ]}
          >
            Completed ({completed.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filter === "cancelled" && styles.filterActive,
          ]}
          onPress={() => setFilter("cancelled")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "cancelled" && styles.filterTextActive,
            ]}
          >
            Cancelled ({cancelled.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {currentList.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name={
                filter === "upcoming"
                  ? "calendar-outline"
                  : filter === "completed"
                    ? "checkmark-done-outline"
                    : "close-circle-outline"
              }
              size={56}
              color={GREEN_THEME.borderLight}
            />
            <Text style={styles.emptyTitle}>No {filter} sessions</Text>
            <Text style={styles.emptyText}>
              {filter === "upcoming"
                ? "Approve requests to see sessions here"
                : filter === "completed"
                  ? "Completed sessions will appear here"
                  : "Cancelled sessions will appear here"}
            </Text>
          </View>
        ) : (
          currentList.map(renderCard)
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GREEN_THEME.screenBg },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: GREEN_THEME.screenBg,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 20,
    backgroundColor: GREEN_THEME.headerBg,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: GREEN_THEME.darkGreenText,
  },
  headerSub: {
    fontSize: 13,
    color: GREEN_THEME.textGray,
    marginTop: 4,
  },

  // Filters
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: GREEN_THEME.borderLight,
    alignItems: "center",
  },
  filterActive: {
    backgroundColor: GREEN_THEME.primaryGreen,
    borderColor: GREEN_THEME.primaryGreen,
  },
  filterText: {
    fontSize: 11,
    fontWeight: "700",
    color: GREEN_THEME.textDark,
  },
  filterTextActive: { color: "#fff" },

  // Card
  card: {
    backgroundColor: GREEN_THEME.white,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GREEN_THEME.borderLight,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN_THEME.infoText,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  studentName: {
    fontSize: 15,
    fontWeight: "700",
    color: GREEN_THEME.textDark,
  },
  subject: {
    fontSize: 12,
    color: GREEN_THEME.textGray,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 12,
  },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12, color: GREEN_THEME.textDark },

  noteBox: {
    flexDirection: "row",
    backgroundColor: "#F5FAF2",
    padding: 10,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: GREEN_THEME.textDark,
    fontStyle: "italic",
  },

  actionsRow: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 10,
    gap: 4,
  },
  cancelBtn: { backgroundColor: GREEN_THEME.dangerLight },
  completeBtn: { backgroundColor: GREEN_THEME.primaryGreen },
  cancelText: {
    color: GREEN_THEME.danger,
    fontWeight: "700",
    fontSize: 12,
  },
  completeText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  infoMsg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  infoMsgText: { fontSize: 12, fontWeight: "600" },

  // Empty
  emptyBox: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: GREEN_THEME.darkGreenText,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 12,
    color: GREEN_THEME.textGray,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
