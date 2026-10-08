import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../../firebase";
import {
  addAvailabilitySlot,
  deleteAvailabilitySlot,
  getMyAvailability,
  updateAvailabilitySlot,
} from "../../../services/tutorService";

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

type DayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
// ⚠️ Schema-compliant modes (lowercase)
type SessionMode = "online" | "face" | "both";
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

const MODE_OPTIONS: { value: SessionMode; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "face", label: "Face-to-face" },
  { value: "both", label: "Both" },
];

const DURATION_OPTIONS: SessionDuration[] = ["30 min", "1 hour", "2 hours"];

const COLORS: Record<string, string> = {
  background: "#EAF2E5",
  primary: "#5E8C5A",
  primaryLight: "#D6E8D0",
  textDark: "#2E2E2E",
  textGray: "#7A8A7A",
  border: "#DDE8D8",
  white: "#FFFFFF",
  danger: "#E74C3C",
  dangerLight: "#FFE8E8",
};

const createEmptyWeeklySlots = (): WeeklySlots => {
  const empty: WeeklySlots = {};
  DAYS.forEach((day) => {
    empty[day] = [];
  });
  return empty;
};

// Helper: display mode in user-friendly way
const formatMode = (mode?: string) => {
  if (mode === "online") return "Online";
  if (mode === "face") return "Face-to-face";
  if (mode === "both") return "Both";
  return mode || "";
};

export default function TutorAvailability() {
  // 🔑 Firebase Auth = source of truth
  const uid = auth?.currentUser?.uid;

  const [weeklySlots, setWeeklySlots] = useState<WeeklySlots>(
    createEmptyWeeklySlots(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMode, setSelectedMode] = useState<SessionMode>("online");
  const [selectedDuration, setSelectedDuration] =
    useState<SessionDuration>("1 hour");
  const [savedSlots, setSavedSlots] = useState<SavedSlot[]>([]);

  // ---------- LOAD existing slots ----------
  const loadAvailability = async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      const slots = await getMyAvailability(uid);
      // Sort by date + start time
      const sorted = (slots as SavedSlot[]).sort((a, b) => {
        const ka = `${a.date || ""}${a.startTime || ""}`;
        const kb = `${b.date || ""}${b.startTime || ""}`;
        return ka.localeCompare(kb);
      });
      setSavedSlots(sorted);

      // Reset weekly grid
      setWeeklySlots(createEmptyWeeklySlots());
    } catch (error: any) {
      console.log("Availability load error:", error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  // Reload on tab focus
  useFocusEffect(
    useCallback(() => {
      loadAvailability();
    }, [uid]),
  );

  // ---------- TOGGLE slot in weekly grid ----------
  const toggleSlot = (day: DayName, time: string) => {
    setWeeklySlots((prev) => {
      const daySlots = prev[day] || [];
      const has = daySlots.includes(time);
      const updated = has
        ? daySlots.filter((t) => t !== time)
        : [...daySlots, time];
      return { ...prev, [day]: updated };
    });
  };

  // ---------- SAVE all selected slots (CREATE) ----------
  const saveAvailability = async () => {
    if (!uid) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    // Count total selected
    const totalSelected = DAYS.reduce(
      (sum, d) => sum + (weeklySlots[d]?.length || 0),
      0,
    );

    if (totalSelected === 0) {
      Alert.alert("Nothing to save", "Please select at least one slot.");
      return;
    }

    Alert.alert(
      "Save Availability",
      `Save ${totalSelected} slot${totalSelected !== 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async () => {
            setSaving(true);
            try {
              let slotsAdded = 0;

              for (const day of DAYS) {
                const times = weeklySlots[day] || [];

                // Compute real date for this weekday
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
                const dateString = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

                for (const time of times) {
                  // Convert 12-hour to 24-hour
                  const [hhmm, period] = time.split(" ");
                  let [h, m] = hhmm.split(":").map(Number);
                  if (period === "PM" && h !== 12) h += 12;
                  if (period === "AM" && h === 12) h = 0;

                  let addHours = 1;
                  if (selectedDuration === "30 min") addHours = 0.5;
                  if (selectedDuration === "2 hours") addHours = 2;

                  const endTotalMin = h * 60 + m + addHours * 60;
                  const endH = Math.floor(endTotalMin / 60);
                  const endM = endTotalMin % 60;

                  const startTime = `${String(h).padStart(2, "0")}:${String(
                    m,
                  ).padStart(2, "0")}`;
                  const endTime = `${String(endH).padStart(2, "0")}:${String(
                    endM,
                  ).padStart(2, "0")}`;

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

              Alert.alert(
                "Success",
                `${slotsAdded} slot${slotsAdded !== 1 ? "s" : ""} saved!`,
              );
              loadAvailability();
            } catch (error: any) {
              console.log("Save error:", error?.message || error);
              Alert.alert("Error", "Failed to save availability.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  // ---------- DELETE slot (D) ----------
  const handleDeleteSlot = (slotId: string, isBooked?: boolean) => {
    if (isBooked) {
      Alert.alert(
        "Cannot Delete",
        "This slot is already booked. Cancel the booking first.",
      );
      return;
    }

    Alert.alert("Delete Slot", "Are you sure you want to delete this slot?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAvailabilitySlot(slotId);
            loadAvailability();
          } catch (error: any) {
            Alert.alert("Error", error?.message || "Could not delete.");
          }
        },
      },
    ]);
  };

  // ---------- EDIT slot mode (U) ----------
  const handleEditSlot = (slot: SavedSlot) => {
    if (slot.isBooked) {
      Alert.alert("Cannot Edit", "This slot is already booked.");
      return;
    }

    Alert.alert(
      "Change Session Mode",
      `Current: ${formatMode(slot.mode)}\n\nSelect new mode:`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Online",
          onPress: () => updateSlotMode(slot.id, "online"),
        },
        {
          text: "Face-to-face",
          onPress: () => updateSlotMode(slot.id, "face"),
        },
        {
          text: "Both",
          onPress: () => updateSlotMode(slot.id, "both"),
        },
      ],
    );
  };

  const updateSlotMode = async (slotId: string, newMode: SessionMode) => {
    try {
      await updateAvailabilitySlot(slotId, { mode: newMode });
      Alert.alert("Updated", `Mode changed to "${formatMode(newMode)}"`);
      loadAvailability();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not update.");
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
        <Text style={styles.headerTitle}>My Availability</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ============ SAVED SLOTS (Read + Update + Delete) ============ */}
        <Text style={styles.sectionTitle}>My Slots ({savedSlots.length})</Text>
        {savedSlots.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={36} color={COLORS.border} />
            <Text style={styles.emptyText}>No slots yet. Add some below.</Text>
          </View>
        ) : (
          savedSlots.map((slot) => (
            <View key={slot.id} style={styles.savedSlotRow}>
              <View
                style={[
                  styles.slotIcon,
                  slot.isBooked && { backgroundColor: "#FFE8E8" },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={slot.isBooked ? COLORS.danger : COLORS.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedSlotDate}>
                  {slot.date} • {slot.startTime} - {slot.endTime}
                </Text>
                <Text style={styles.savedSlotMode}>
                  {formatMode(slot.mode)}
                  {slot.isBooked ? " • Booked" : ""}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => handleEditSlot(slot)}
                disabled={slot.isBooked}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={slot.isBooked ? COLORS.border : COLORS.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, styles.deleteBtn]}
                onPress={() => handleDeleteSlot(slot.id, slot.isBooked)}
                disabled={slot.isBooked}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={slot.isBooked ? COLORS.border : COLORS.danger}
                />
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* ============ NEW SLOT CREATION ============ */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          Add New Slots
        </Text>

        {/* Session Mode */}
        <Text style={styles.label}>Session Mode</Text>
        <View style={styles.modeRow}>
          {MODE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.modeChip,
                selectedMode === opt.value && styles.modeActive,
              ]}
              onPress={() => setSelectedMode(opt.value)}
            >
              <Text
                style={[
                  styles.modeText,
                  selectedMode === opt.value && styles.modeTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Session Duration */}
        <Text style={styles.label}>Session Duration</Text>
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
          <Text style={styles.label}>Tap cells to select</Text>
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

        <View style={styles.legend}>
          <View
            style={[styles.legendBox, { backgroundColor: COLORS.primary }]}
          />
          <Text style={styles.legendText}>Selected</Text>
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
          <Text style={styles.legendText}>Not selected</Text>
        </View>
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
            <Text style={styles.saveText}>Save New Slots</Text>
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 50,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textGray,
    marginTop: 16,
    marginBottom: 8,
  },

  // Mode chips
  modeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  modeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  modeActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeText: {
    color: COLORS.textDark,
    fontWeight: "600",
    fontSize: 13,
  },
  modeTextActive: { color: "#fff" },

  // Weekly grid
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
  slotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  // Legend
  legend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  legendBox: { width: 16, height: 16, borderRadius: 4 },
  legendText: {
    fontSize: 12,
    color: COLORS.textGray,
    marginRight: 12,
  },

  // Saved slot rows
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
  slotIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  savedSlotDate: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  savedSlotMode: {
    fontSize: 11,
    color: COLORS.textGray,
    marginTop: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
  },
  deleteBtn: { backgroundColor: COLORS.dangerLight },

  emptyBox: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    color: COLORS.textGray,
    fontSize: 13,
    marginTop: 8,
  },

  // Bottom bar
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
  saveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
