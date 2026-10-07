import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import {
    addAvailabilitySlot,
    getMyAvailability,
} from "../../services/tutorService";

// ---------- TYPES ----------
interface SavedSlot {
  id: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  mode?: string;
  isBooked?: boolean;
}

interface WeeklySlots {
  [key: string]: string[];
}

interface AvailabilitySlotPayload {
  tutorId?: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: SessionMode;
  isBooked: boolean;
}

type DayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
type SessionMode = "Online" | "Face-to-face";
type SessionDuration = "30 min" | "1 hour" | "2 hours";

const DAYS: DayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMES: string[] = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
];
const MODE_OPTIONS: SessionMode[] = ["Online", "Face-to-face"];
const DURATION_OPTIONS: SessionDuration[] = ["30 min", "1 hour", "2 hours"];

const COLORS: Record<string, string> = {
  background: "#EAF2E5",
  primary: "#5E8C5A",
  primaryLight: "#D6E8D0",
  textDark: "#2E2E2E",
  textGray: "#7A8A7A",
  border: "#DDE8D8",
  white: "#FFFFFF",
};

const createEmptyWeeklySlots = (): WeeklySlots => {
  const empty: WeeklySlots = {};
  DAYS.forEach((day: DayName) => {
    empty[day] = [];
  });
  return empty;
};

export default function TutorAvailability() {
  const router = useRouter();
  const { user } = useAuth();

  const [weeklySlots, setWeeklySlots] = useState<WeeklySlots>(createEmptyWeeklySlots());
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<SessionMode>("Online");
  const [selectedDuration, setSelectedDuration] = useState<SessionDuration>("1 hour");
  const [savedSlots, setSavedSlots] = useState<SavedSlot[]>([]);

  useEffect(() => {
    loadAvailability();
  }, []);

  // ---------- LOAD existing slots from Firestore ----------
  const loadAvailability = async (): Promise<void> => {
    try {
      const uid: string | undefined = user?.uid || user?.id || user?._id;
      const slots: SavedSlot[] = await getMyAvailability(uid);
      setSavedSlots(slots);

      // Empty weekly grid (this grid is for creating new slots)
      const empty: WeeklySlots = {};
      DAYS.forEach((d: DayName) => (empty[d] = []));
      setWeeklySlots(empty);
    } catch (error: unknown) {
      console.log(
        "Availability load error:",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------- TOGGLE a slot in the weekly grid ----------
  const toggleSlot = (day: DayName, time: string): void => {
    setWeeklySlots((prev: WeeklySlots): WeeklySlots => {
      const daySlots: string[] = prev[day] || [];
      const has: boolean = daySlots.includes(time);
      const updated: string[] = has
        ? daySlots.filter((t: string) => t !== time)
        : [...daySlots, time];
      return { ...prev, [day]: updated };
    });
  };

  // ---------- SAVE all selected slots to Firestore ----------
  const saveAvailability = async (): Promise<void> => {
    setSaving(true);
    try {
      const uid = user?.uid || user?.id || user?._id;
      let slotsAdded = 0;

      // For each day that has selected times, create Firestore documents
      for (const day of DAYS) {
        const times = weeklySlots[day] || [];

        // Calculate the real date (YYYY-MM-DD) for this weekday
        const today = new Date();
        const dayIndex = [
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
        ].indexOf(day);
        const diff = dayIndex - today.getDay();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + diff);
        const dateString = targetDate.toISOString().split("T")[0];

        for (const time of times) {
          // Compute endTime based on duration (simple approximation)
          const [hhmm, period] = time.split(" ");
          let [h, m] = hhmm.split(":").map(Number);
          if (period === "PM" && h !== 12) h += 12;
          if (period === "AM" && h === 12) h = 0;

          let addHours = 1;
          if (selectedDuration === "30 min") addHours = 0.5;
          if (selectedDuration === "2 hours") addHours = 2;

          const endH = Math.floor(h + addHours);
          const endM = m;
          const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
          const startTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

          await addAvailabilitySlot({
            tutorId: uid,
            date: dateString,
            startTime,
            endTime,
            mode: selectedMode,
            isBooked: false,
          });
          slotsAdded++;
        }
      }

      if (slotsAdded === 0) {
        Alert.alert("Nothing to save", "Please select at least one slot.");
      } else {
        Alert.alert(
          "Success",
          `${slotsAdded} availability slot${slotsAdded !== 1 ? "s" : ""} saved successfully!`,
        );
        loadAvailability();
      }
    } catch (error) {
      console.log("Save error:", error instanceof Error ? error.message : String(error));
      Alert.alert("Error", "Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Availability</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Session Mode */}
        <Text style={styles.sectionTitle}>Session Mode</Text>
        <View style={styles.modeRow}>
          {(["Online", "Face-to-face"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeChip, selectedMode === m && styles.modeActive]}
              onPress={() => setSelectedMode(m)}
            >
              <Text
                style={[
                  styles.modeText,
                  selectedMode === m && styles.modeTextActive,
                ]}
              >
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Session Duration */}
        <Text style={styles.sectionTitle}>Session Duration</Text>
        <View style={styles.modeRow}>
          {DURATION_OPTIONS.map((dur) => (
            <TouchableOpacity
              key={dur}
              style={[
                styles.modeChip,
                selectedDuration === dur && styles.modeActive,
              ]}
              onPress={() => setSelectedDuration(dur)}
            >
              <Text
                style={[
                  styles.modeText,
                  selectedDuration === dur && styles.modeTextActive,
                ]}
              >
                {dur}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Weekly Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Weekly Availability</Text>
          <Text style={styles.hint}>Tap to toggle</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.gridRow}>
              <View style={styles.timeLabel} />
              {DAYS.map((day) => (
                <View key={day} style={styles.dayHeader}>
                  <Text style={styles.dayHeaderText}>{day}</Text>
                </View>
              ))}
            </View>

            {TIMES.map((time) => (
              <View key={time} style={styles.gridRow}>
                <View style={styles.timeLabel}>
                  <Text style={styles.timeLabelText}>{time}</Text>
                </View>
                {DAYS.map((day) => {
                  const isActive = (weeklySlots[day] || []).includes(time);
                  return (
                    <TouchableOpacity
                      key={`${day}-${time}`}
                      style={[styles.slot, isActive && styles.slotActive]}
                      onPress={() => toggleSlot(day, time)}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Legend */}
        <View style={styles.legend}>
          <View
            style={[styles.legendBox, { backgroundColor: COLORS.primary }]}
          />
          <Text style={styles.legendText}>Available</Text>
          <View
            style={[
              styles.legendBox,
              {
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: COLORS.border,
              },
            ]}
          />
          <Text style={styles.legendText}>Not available</Text>
        </View>

        {/* Existing saved slots */}
        <Text style={styles.sectionTitle}>
          Saved Slots ({savedSlots.length})
        </Text>
        {savedSlots.length === 0 ? (
          <Text style={styles.emptyText}>No saved slots yet</Text>
        ) : (
          savedSlots.map((slot) => (
            <View key={slot.id} style={styles.savedSlotRow}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.savedSlotText}>
                {slot.date} • {slot.startTime} - {slot.endTime} • {slot.mode}
              </Text>
              {slot.isBooked && (
                <View style={styles.bookedBadge}>
                  <Text style={styles.bookedText}>Booked</Text>
                </View>
              )}
            </View>
          ))
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={saveAvailability}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Save Availability</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const CELL_SIZE = 44;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 50,
    marginBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textDark },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hint: { fontSize: 11, color: COLORS.textGray, marginTop: 16 },
  modeRow: { flexDirection: "row", gap: 10 },
  modeChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  modeActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeText: { color: COLORS.textDark, fontWeight: "600", fontSize: 13 },
  modeTextActive: { color: "#fff" },
  gridRow: { flexDirection: "row" },
  timeLabel: { width: 70, height: CELL_SIZE, justifyContent: "center" },
  timeLabelText: { fontSize: 11, color: COLORS.textGray },
  dayHeader: {
    width: CELL_SIZE,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    marginHorizontal: 2,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  slot: {
    width: CELL_SIZE - 4,
    height: CELL_SIZE - 4,
    margin: 2,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  legend: { flexDirection: "row", alignItems: "center", marginTop: 20, gap: 8 },
  legendBox: { width: 16, height: 16, borderRadius: 4 },
  legendText: { fontSize: 12, color: COLORS.textGray, marginRight: 12 },
  emptyText: { color: COLORS.textGray, fontSize: 13, marginTop: 6 },
  savedSlotRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  savedSlotText: { flex: 1, fontSize: 12, color: COLORS.textDark },
  bookedBadge: {
    backgroundColor: "#FFE8E8",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  bookedText: { fontSize: 10, color: "#E74C3C", fontWeight: "700" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
