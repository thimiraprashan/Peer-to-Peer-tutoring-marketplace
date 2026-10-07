import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import {
    getTutorProfile,
    updateTutorProfile,
} from "../../services/tutorService";

const COLORS = {
  background: "#EAF2E5",
  backgroundAlt: "#F5FAF2",
  primary: "#5E8C5A",
  primaryLight: "#D6E8D0",
  success: "#4CAF50",
  danger: "#E74C3C",
  dangerLight: "#FFE8E8",
  textDark: "#2E2E2E",
  textGray: "#7A8A7A",
  border: "#DDE8D8",
};

type TutorProfileData = {
  id?: string;
  verified?: boolean;
  bio?: string;
  hourlyRate?: number;
  sessionMode?: string;
};

export default function TutorProfile() {
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<TutorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [price, setPrice] = useState("");
  const [sessionMode, setSessionMode] = useState("online");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  // ---------- Load profile from Firestore ----------
  const loadProfile = async () => {
    try {
      const uid = user?.uid || user?.id || user?._id;
      const data = (await getTutorProfile(uid)) as TutorProfileData | null;
      if (data) {
        setProfile(data);
        setBio(data.bio || "");
        setPrice(String(data.hourlyRate ?? ""));
        setSessionMode(data.sessionMode || "online");
      }
    } catch (error) {
      console.log(
        "Profile load error:",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------- Save changes to Firestore ----------
  const handleSave = async () => {
    setSaving(true);
    try {
      const uid = user?.uid || user?.id || user?._id;
      await updateTutorProfile(uid, {
        bio,
        hourlyRate: Number(price) || 1500,
        sessionMode,
      });
      Alert.alert("Success", "Profile updated!");
      setEditing(false);
      loadProfile();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      {/* User info */}
      <View style={styles.userBox}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || "T"}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name || "Tutor"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {profile?.verified ? (
          <View style={styles.verifiedBadge}>
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={COLORS.primary}
            />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : (
          <View style={[styles.verifiedBadge, { backgroundColor: "#FFF4E6" }]}>
            <Ionicons name="time" size={14} color="#F5A623" />
            <Text style={[styles.verifiedText, { color: "#F5A623" }]}>
              Pending Verification
            </Text>
          </View>
        )}
      </View>

      {/* Editable fields */}
      <View style={styles.card}>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Hourly Rate (Rs.)</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="number-pad"
              placeholder="1500"
              placeholderTextColor={COLORS.textGray}
            />
          ) : (
            <Text style={styles.value}>Rs. {profile?.hourlyRate || 1500}</Text>
          )}
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.label}>Session Mode</Text>
          {editing ? (
            <View style={styles.modeRow}>
              {["online", "face", "both"].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.modeChip,
                    sessionMode === m && styles.modeActive,
                  ]}
                  onPress={() => setSessionMode(m)}
                >
                  <Text
                    style={[
                      styles.modeText,
                      sessionMode === m && styles.modeTextActive,
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.value}>{profile?.sessionMode || "online"}</Text>
          )}
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.label}>Bio</Text>
          {editing ? (
            <TextInput
              style={[styles.input, { height: 60 }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell students about yourself"
              placeholderTextColor={COLORS.textGray}
              multiline
            />
          ) : (
            <Text style={styles.value}>{profile?.bio || "No bio yet"}</Text>
          )}
        </View>
      </View>

      {/* Edit/Save button */}
      <TouchableOpacity
        style={[styles.editBtn, editing && styles.saveBtn]}
        onPress={editing ? handleSave : () => setEditing(true)}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.editText}>
            {editing ? "Save Changes" : "Edit Profile"}
          </Text>
        )}
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => router.replace("/login")}
      >
        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
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
  userBox: { alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "700" },
  name: { fontSize: 18, fontWeight: "700", color: COLORS.textDark },
  email: { fontSize: 13, color: COLORS.textGray, marginTop: 4 },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
    gap: 4,
  },
  verifiedText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  card: {
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  fieldRow: { marginBottom: 16 },
  label: {
    fontSize: 12,
    color: COLORS.textGray,
    marginBottom: 6,
    fontWeight: "600",
  },
  value: { fontSize: 14, color: COLORS.textDark, fontWeight: "500" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeRow: { flexDirection: "row", gap: 8 },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  modeActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeText: { fontSize: 12, color: COLORS.textDark, fontWeight: "600" },
  modeTextActive: { color: "#fff" },
  editBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  saveBtn: { backgroundColor: COLORS.success },
  editText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.dangerLight,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: { color: COLORS.danger, fontWeight: "700", fontSize: 15 },
});
