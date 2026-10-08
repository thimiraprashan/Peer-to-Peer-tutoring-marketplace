import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { auth, db } from "../../firebase";
import { getTutorBookings } from "../../services/bookingService";
import {
    createNotification,
    proposeReschedule,
    updateBookingStatus,
} from "../../services/tutorService";

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
};

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

export default function TutorRequests() {
  const router = useRouter();
  const uid = auth?.currentUser?.uid;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(
    null,
  );
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const loadData = async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      const data = await getTutorBookings(uid);
      const pendingOnly = (data as Booking[]).filter(
        (b) => b.status === "pending",
      );
      setBookings(pendingOnly);
    } catch (error: any) {
      console.log("Requests load error:", error?.message || error);
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

  // ---------- Approve ----------
  const handleApprove = async (booking: Booking) => {
    if (!uid) return;
    Alert.alert(
      "Approve Request",
      `Approve ${booking.studentName || "student"}'s booking?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            setProcessingId(booking.id);
            try {
              await updateBookingStatus(booking.id, "approved");
              if (booking.studentId) {
                await createNotification(
                  booking.studentId,
                  "booking_approved",
                  `Your booking for ${booking.subjectCode} on ${booking.date} at ${booking.startTime} has been approved.`,
                  booking.id,
                );
              }
              Alert.alert("✅ Approved", "Booking confirmed.");
              loadData();
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Could not approve.");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  // ---------- Reject ----------
  const handleReject = async (booking: Booking) => {
    if (!uid) return;
    Alert.alert(
      "Reject Request",
      "Reject this booking request? The slot will be freed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            setProcessingId(booking.id);
            try {
              await updateBookingStatus(booking.id, "cancelled");
              if (booking.slotId) {
                try {
                  await updateDoc(doc(db, "availability", booking.slotId), {
                    isBooked: false,
                  });
                } catch (e) {
                  console.log("Slot free error:", e);
                }
              }
              if (booking.studentId) {
                await createNotification(
                  booking.studentId,
                  "booking_rejected",
                  `Your booking for ${booking.subjectCode} was declined.`,
                  booking.id,
                );
              }
              Alert.alert("Rejected", "The student has been notified.");
              loadData();
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Could not reject.");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  // ---------- Reschedule ----------
  const openRescheduleModal = (booking: Booking) => {
    setRescheduleBooking(booking);
    setNewDate(booking.date || "");
    setNewStart(booking.startTime || "");
    setNewEnd(booking.endTime || "");
  };

  const handleSubmitReschedule = async () => {
    if (!rescheduleBooking || !uid) return;

    if (!newDate || !newStart || !newEnd) {
      Alert.alert("Missing Info", "Please fill in all fields.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      Alert.alert("Invalid Date", "Use format: YYYY-MM-DD");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(newStart) || !/^\d{2}:\d{2}$/.test(newEnd)) {
      Alert.alert("Invalid Time", "Use format: HH:mm (24-hour)");
      return;
    }

    setProcessingId(rescheduleBooking.id);
    try {
      await proposeReschedule(rescheduleBooking.id, {
        date: newDate,
        startTime: newStart,
        endTime: newEnd,
      });
      if (rescheduleBooking.studentId) {
        await createNotification(
          rescheduleBooking.studentId,
          "reschedule",
          `New time proposed: ${newDate} at ${newStart} - ${newEnd}. Please review.`,
          rescheduleBooking.id,
        );
      }
      setRescheduleBooking(null);
      Alert.alert(
        "✅ Reschedule Proposed",
        `New time: ${newDate} at ${newStart}\n\nStatus: Waiting for student confirmation.\nThe student has been notified.`,
        [{ text: "OK", onPress: loadData }],
      );
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not reschedule.");
    } finally {
      setProcessingId(null);
    }
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
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Pending Requests</Text>
          <Text style={styles.headerSub}>
            {bookings.length} request{bookings.length !== 1 ? "s" : ""} waiting
          </Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {bookings.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={64}
              color={GREEN_THEME.borderLight}
            />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>No pending requests right now.</Text>
          </View>
        ) : (
          bookings.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: "/(tutor)/RequestDetails",
                  params: { bookingId: item.id },
                } as Href)
              }
            >
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
                  <Text style={styles.subject}>
                    {item.subjectCode || "Subject"}
                  </Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>PENDING</Text>
                </View>
              </View>

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

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.rejectBtn]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleReject(item);
                  }}
                  disabled={processingId === item.id}
                >
                  {processingId === item.id ? (
                    <ActivityIndicator
                      size="small"
                      color={GREEN_THEME.danger}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="close"
                        size={16}
                        color={GREEN_THEME.danger}
                      />
                      <Text style={styles.rejectText}>Reject</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.rescheduleBtn]}
                  onPress={(e) => {
                    e.stopPropagation();
                    openRescheduleModal(item);
                  }}
                  disabled={processingId === item.id}
                >
                  <Ionicons
                    name="calendar"
                    size={16}
                    color={GREEN_THEME.infoText}
                  />
                  <Text style={styles.rescheduleText}>Reschedule</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.approveBtn]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleApprove(item);
                  }}
                  disabled={processingId === item.id}
                >
                  {processingId === item.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.approveText}>Approve</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Reschedule Modal */}
      <Modal
        visible={!!rescheduleBooking}
        transparent
        animationType="slide"
        onRequestClose={() => setRescheduleBooking(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Propose New Time</Text>
            <Text style={styles.modalSub}>
              {rescheduleBooking?.studentName} •{" "}
              {rescheduleBooking?.subjectCode}
            </Text>

            <Text style={styles.modalLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              value={newDate}
              onChangeText={setNewDate}
              placeholder="2026-10-15"
              placeholderTextColor={GREEN_THEME.textGray}
            />

            <Text style={styles.modalLabel}>Start Time (HH:mm)</Text>
            <TextInput
              style={styles.modalInput}
              value={newStart}
              onChangeText={setNewStart}
              placeholder="14:00"
              placeholderTextColor={GREEN_THEME.textGray}
            />

            <Text style={styles.modalLabel}>End Time (HH:mm)</Text>
            <TextInput
              style={styles.modalInput}
              value={newEnd}
              onChangeText={setNewEnd}
              placeholder="16:00"
              placeholderTextColor={GREEN_THEME.textGray}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setRescheduleBooking(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSubmit]}
                onPress={handleSubmitReschedule}
                disabled={processingId === rescheduleBooking?.id}
              >
                {processingId === rescheduleBooking?.id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Propose</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
    flexDirection: "row",
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
  card: {
    backgroundColor: GREEN_THEME.white,
    marginHorizontal: 20,
    marginTop: 14,
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
  pendingBadge: {
    backgroundColor: GREEN_THEME.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: "700",
    color: GREEN_THEME.warningText,
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
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  rejectBtn: { backgroundColor: GREEN_THEME.dangerLight },
  rescheduleBtn: { backgroundColor: "#E8F0FE" },
  approveBtn: { backgroundColor: GREEN_THEME.primaryGreen },
  rejectText: { color: GREEN_THEME.danger, fontWeight: "700", fontSize: 12 },
  rescheduleText: {
    color: GREEN_THEME.infoText,
    fontWeight: "700",
    fontSize: 12,
  },
  approveText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  emptyBox: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: GREEN_THEME.darkGreenText,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: GREEN_THEME.textGray,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: GREEN_THEME.textDark,
  },
  modalSub: {
    fontSize: 12,
    color: GREEN_THEME.textGray,
    marginTop: 4,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: GREEN_THEME.textGray,
    marginTop: 10,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: "#F5FAF2",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: GREEN_THEME.textDark,
    borderWidth: 1,
    borderColor: GREEN_THEME.borderLight,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  modalCancel: { backgroundColor: "#EEE" },
  modalCancelText: { color: GREEN_THEME.textDark, fontWeight: "700" },
  modalSubmit: { backgroundColor: GREEN_THEME.primaryGreen },
  modalSubmitText: { color: "#fff", fontWeight: "700" },
});
