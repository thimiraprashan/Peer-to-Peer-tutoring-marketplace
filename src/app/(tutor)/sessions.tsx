import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import {
    getTutorBookings,
    markSessionCompleted,
} from "../../services/bookingService";

const COLORS: Record<string, string> = {
  background: "#EAF2E5",
  primary: "#5E8C5A",
  primaryLight: "#D6E8D0",
  backgroundAlt: "#F5FAF2",
  textDark: "#2E2E2E",
  textGray: "#7A8A7A",
  border: "#DDE8D8",
};

interface BookingRecord {
  id: string;
  slotId: string;
  status: string;
  subjectCode: string;
  studentName?: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: string;
}

interface AuthUser {
  uid?: string;
  id?: string;
  _id?: string;
}

interface Session {
  id: string;
  slotId: string;
  status: string;
  subjectCode: string;
  studentName?: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: string;
}

export default function UpcomingSession() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // ---------- Load upcoming sessions ----------
  const loadSessions = async (): Promise<void> => {
    try {
      const uid: string | undefined = user?.uid || user?.id || user?._id;
      if (!uid) {
        setSessions([]);
        return;
      }
      const data: BookingRecord[] = await getTutorBookings(uid);
      const upcoming: BookingRecord[] = data.filter((b: BookingRecord) =>
        ["approved", "rescheduled"].includes(b.status),
      );
      setSessions(upcoming);
    } catch (error: unknown) {
      console.log(
        "Sessions load error:",
        error instanceof Error ? error.message : String(error),
      );
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback((): void => {
      void loadSessions();
    }, [user]),
  );

  // ---------- Mark a session as completed ----------
  const handleComplete = (id: string, slotId: string): void => {
    Alert.alert("Complete Session?", "Mark this session as completed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: async (): Promise<void> => {
          try {
            await markSessionCompleted(id, slotId);
            void loadSessions();
            Alert.alert("Success", "Session marked as completed!");
          } catch (error: unknown) {
            Alert.alert(
              "Error",
              error instanceof Error ? error.message : "Something went wrong.",
            );
          }
        },
      },
    ]);
  };

  const handleJoinZoom = (): void => {
    void Linking.openURL("https://zoom.us/j/1234567890");
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Upcoming Sessions</Text>

      {sessions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="videocam-outline" size={60} color={COLORS.border} />
          <Text style={styles.emptyText}>No upcoming sessions</Text>
          <Text style={styles.emptySub}>
            Approved requests will appear here
          </Text>
        </View>
      ) : (
        sessions.map((session) => (
          <View key={session.id} style={styles.card}>
            {/* Status badge */}
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {session.status === "approved" ? "CONFIRMED" : "RESCHEDULED"}
              </Text>
            </View>

            {/* Title */}
            <Text style={styles.sessionTitle}>
              {session.subjectCode} - {session.studentName}
            </Text>
            <Text style={styles.sessionSub}>
              with {session.studentName || "Student"}
            </Text>

            {/* Details */}
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color={COLORS.primary} />
              <Text style={styles.detailText}>{session.date}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color={COLORS.primary} />
              <Text style={styles.detailText}>
                {session.startTime} - {session.endTime}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons
                name={session.mode === "Online" ? "videocam" : "location"}
                size={16}
                color={COLORS.primary}
              />
              <Text style={styles.detailText}>
                {session.mode} {session.mode === "Online" && "(Zoom)"}
              </Text>
            </View>

            {/* Start Session (Zoom) button */}
            {session.mode === "Online" && (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={handleJoinZoom}
              >
                <Ionicons name="videocam" size={18} color="#fff" />
                <Text style={styles.startText}>Start Session</Text>
              </TouchableOpacity>
            )}

            {/* Complete button */}
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => handleComplete(session.id, session.slotId)}
            >
              <Text style={styles.completeText}>Mark as Completed</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 50,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusBadge: {
    backgroundColor: COLORS.backgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  statusText: { fontSize: 10, fontWeight: "700", color: COLORS.textGray },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  sessionSub: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 2,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  detailText: { fontSize: 13, color: COLORS.textDark },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  startText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  completeBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  completeText: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  emptyBox: { alignItems: "center", marginTop: 80 },
  emptyText: {
    color: COLORS.textGray,
    marginTop: 16,
    fontSize: 15,
    fontWeight: "600",
  },
  emptySub: { color: COLORS.textGray, marginTop: 6, fontSize: 12 },
});
