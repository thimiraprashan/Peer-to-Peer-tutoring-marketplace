import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, type Href } from "expo-router";
import { signOut } from "firebase/auth";
import { useCallback, useState } from "react";
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
import { useAuth } from "../../../contexts/AuthContext";
import { auth } from "../../../firebase";
import {
  addTutorSubject,
  deleteTutorSubject,
  getTutorProfile,
  getTutorSubjects,
  updateTutorProfile,
} from "../../../services/tutorService";

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
  university?: string;
  faculty?: string;
};

type Subject = {
  id: string;
  tutorId: string;
  moduleCode: string;
  moduleName: string;
  subjectArea: string;
};

export default function TutorProfile() {
  const { user } = useAuth();

  const uid = auth?.currentUser?.uid;

  const [profile, setProfile] = useState<TutorProfileData | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [price, setPrice] = useState("");
  const [sessionMode, setSessionMode] = useState("online");
  const [saving, setSaving] = useState(false);

  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newModuleCode, setNewModuleCode] = useState("");
  const [newModuleName, setNewModuleName] = useState("");

  const loadData = async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      const [profileData, subjectsData] = await Promise.all([
        getTutorProfile(uid),
        getTutorSubjects(uid),
      ]);

      const p = profileData as TutorProfileData | null;
      if (p) {
        setProfile(p);
        setBio(p.bio || "");
        setPrice(String(p.hourlyRate ?? ""));
        setSessionMode(p.sessionMode || "online");
      }
      setSubjects((subjectsData as Subject[]) || []);
    } catch (error) {
      console.log(
        "Profile load error:",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [uid]),
  );

  const handleSave = async () => {
    if (!uid) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }
    setSaving(true);
    try {
      await updateTutorProfile(uid, {
        bio: bio.trim(),
        hourlyRate: Number(price) || 1500,
        sessionMode,
      });
      Alert.alert("Success", "Profile updated!");
      setEditing(false);
      loadData();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubject = async () => {
    if (!uid) return;
    if (!newModuleCode.trim() || !newModuleName.trim()) {
      Alert.alert("Error", "Please enter module code and name.");
      return;
    }

    try {
      await addTutorSubject(uid, {
        moduleCode: newModuleCode.trim().toUpperCase(),
        moduleName: newModuleName.trim(),
        subjectArea: newModuleName.trim(),
      });
      setNewModuleCode("");
      setNewModuleName("");
      setShowAddSubject(false);
      Alert.alert("Success", "Subject added!");
      loadData();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const handleDeleteSubject = (subjectId: string) => {
    Alert.alert("Delete Subject", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTutorSubject(subjectId);
            loadData();
          } catch (error) {
            Alert.alert(
              "Error",
              error instanceof Error ? error.message : String(error),
            );
          }
        },
      },
    ]);
  };

  // ---------- Logout ----------
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            // 👇 Redirect to login page
router.replace("/login" as Href);   
       } catch (error) {
            Alert.alert(
              "Error",
              error instanceof Error ? error.message : String(error),
            );
          }
        },
      },
    ]);
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

      {/* ---------- User info ---------- */}
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
          <TouchableOpacity
            style={[styles.verifiedBadge, { backgroundColor: "#FFF4E6" }]}
            onPress={() =>
              router.push("/(tutor)/tutor-verification-status" as Href)
            }
          >
            <Ionicons name="time" size={14} color="#F5A623" />
            <Text style={[styles.verifiedText, { color: "#F5A623" }]}>
              Pending Verification
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ---------- Verification call-to-action ---------- */}
      {!profile?.verified ? (
        <TouchableOpacity
          style={styles.verificationBanner}
          onPress={() => router.push("/(tutor)/tutor-profile-form" as Href)}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={COLORS.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Complete Your Profile</Text>
            <Text style={styles.bannerDesc}>
              Submit verification to start tutoring
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      ) : null}

      {/* ---------- Editable fields ---------- */}
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

      {/* ---------- Edit/Save button ---------- */}
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

      {/* ---------- Subjects Section ---------- */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Subjects I Teach</Text>
        <TouchableOpacity onPress={() => setShowAddSubject(!showAddSubject)}>
          <Ionicons
            name={showAddSubject ? "close-circle" : "add-circle"}
            size={26}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {showAddSubject ? (
        <View style={styles.addSubjectCard}>
          <TextInput
            style={styles.input}
            placeholder="Module code (e.g. IT3060)"
            placeholderTextColor={COLORS.textGray}
            value={newModuleCode}
            onChangeText={setNewModuleCode}
            autoCapitalize="characters"
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder="Module name (e.g. HCI)"
            placeholderTextColor={COLORS.textGray}
            value={newModuleName}
            onChangeText={setNewModuleName}
          />
          <TouchableOpacity
            style={styles.addSubjectBtn}
            onPress={handleAddSubject}
          >
            <Text style={styles.addSubjectText}>Add Subject</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {subjects.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="school-outline" size={40} color={COLORS.border} />
          <Text style={styles.emptyText}>No subjects added yet</Text>
        </View>
      ) : (
        subjects.map((s) => (
          <View key={s.id} style={styles.subjectCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subjectCode}>{s.moduleCode}</Text>
              <Text style={styles.subjectName}>{s.moduleName}</Text>
            </View>
            <TouchableOpacity
              onPress={() => handleDeleteSubject(s.id)}
              style={styles.deleteIcon}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* ---------- Logout ---------- */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
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
  verifiedText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },

  verificationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  bannerDesc: {
    fontSize: 11,
    color: COLORS.textGray,
    marginTop: 2,
  },

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
  value: {
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: "500",
  },
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
  modeText: {
    fontSize: 12,
    color: COLORS.textDark,
    fontWeight: "600",
  },
  modeTextActive: { color: "#fff" },

  editBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  saveBtn: { backgroundColor: COLORS.success },
  editText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  addSubjectCard: {
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addSubjectBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  addSubjectText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  subjectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subjectCode: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  subjectName: {
    fontSize: 13,
    color: COLORS.textDark,
    marginTop: 2,
  },
  deleteIcon: {
    padding: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 8,
  },

  emptyBox: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    color: COLORS.textGray,
    marginTop: 8,
    fontSize: 13,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
    marginTop: 8,
  },
  logoutText: {
    color: COLORS.danger,
    fontWeight: "700",
    fontSize: 14,
  },
});
