import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import {
    getTutorProfile,
    getVerificationStatus,
} from "../../services/tutorService";

// ==========================================
// GREEN THEME COLORS
// ==========================================
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
  successGreen: "#2E7D32",
  errorRed: "#C62828",
  warningText: "#F5A623",
};

type StatusType = "Verified" | "Rejected" | "Pending" | "Submitted";

export default function TutorVerificationStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusType | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);

  // ------------------------------------------
  // Load verification status from Firestore
  // ------------------------------------------
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const uid = user?.uid || user?.id || user?._id;
        if (!uid) {
          setLoading(false);
          return;
        }

        const [profile, verification] = await Promise.all([
          getTutorProfile(uid),
          getVerificationStatus(uid),
        ]);
        const verificationDetails = verification as unknown as
          | { status?: string; adminNote?: string }
          | null
          | undefined;

        // Priority 1: tutors/{uid}.verified === true
        if (profile && "verified" in profile && profile.verified === true) {
          setStatus("Verified");
        }
        // Priority 2: verificationRequests status
        else if (verificationDetails?.status === "verified") {
          setStatus("Verified");
        } else if (verificationDetails?.status === "rejected") {
          setStatus("Rejected");
          setRejectionReason(
            verificationDetails.adminNote || "No reason provided",
          );
        } else if (verificationDetails?.status === "submitted") {
          setStatus("Submitted");
        } else {
          setStatus("Pending");
        }
      } catch (error: any) {
        console.log("Status load error:", error?.message || error);
      } finally {
        setLoading(false);
      }
    };
    loadStatus();
  }, [user]);

  // ------------------------------------------
  // Loading state
  // ------------------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN_THEME.primaryGreen} />
      </View>
    );
  }

  // ------------------------------------------
  // Icon + colors based on status
  // ------------------------------------------
  const getStatusConfig = () => {
    if (status === "Verified") {
      return {
        icon: "checkmark-circle" as const,
        color: GREEN_THEME.successGreen,
        bg: "#E8F5E9",
        title: "Verified",
        subtitle: "Your profile is verified. Students can now book you.",
      };
    }
    if (status === "Rejected") {
      return {
        icon: "close-circle" as const,
        color: GREEN_THEME.errorRed,
        bg: "#FFEBEE",
        title: "Rejected",
        subtitle: "Your verification was rejected.",
      };
    }
    return {
      icon: "time-outline" as const,
      color: GREEN_THEME.warningText,
      bg: "#FFF4E6",
      title: "Pending Review",
      subtitle: "Admin is reviewing your documents. This may take 24 hours.",
    };
  };

  const config = getStatusConfig();

  return (
    <View style={styles.container}>
      {/* ================= HEADER ================= */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="chevron-back"
            size={24}
            color={GREEN_THEME.darkGreenText}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification Status</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status icon */}
        <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={70} color={config.color} />
        </View>

        <Text style={styles.statusTitle}>{config.title}</Text>
        <Text style={styles.statusSubtitle}>{config.subtitle}</Text>

        {/* If rejected, show reason */}
        {status === "Rejected" && rejectionReason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason:</Text>
            <Text style={styles.reasonText}>{rejectionReason}</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        {status === "Rejected" ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              router.replace("/(tutor)/tutor-profile-form" as Href)
            }
          >
            <Text style={styles.primaryBtnText}>Re-submit Profile</Text>
          </TouchableOpacity>
        ) : null}

        {status === "Verified" ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace("/(tutor)/tutor" as Href)}
          >
            <Text style={styles.primaryBtnText}>Go to Dashboard</Text>
          </TouchableOpacity>
        ) : null}

        {status !== "Verified" ? (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace("/(tutor)/tutor" as Href)}
          >
            <Text style={styles.secondaryBtnText}>Back to Dashboard</Text>
          </TouchableOpacity>
        ) : null}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 15,
    backgroundColor: GREEN_THEME.headerBg,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: GREEN_THEME.darkGreenText,
  },

  content: {
    padding: 25,
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 40,
  },

  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  statusTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: GREEN_THEME.textDark,
    textAlign: "center",
  },
  statusSubtitle: {
    fontSize: 13,
    color: GREEN_THEME.textGray,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  reasonBox: {
    backgroundColor: "#FFEBEE",
    borderRadius: 10,
    padding: 14,
    width: "100%",
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: GREEN_THEME.errorRed,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN_THEME.errorRed,
  },
  reasonText: {
    fontSize: 13,
    color: GREEN_THEME.textDark,
    marginTop: 4,
  },

  primaryBtn: {
    backgroundColor: GREEN_THEME.primaryGreen,
    width: "100%",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  primaryBtnText: {
    color: GREEN_THEME.white,
    fontSize: 15,
    fontWeight: "600",
  },

  secondaryBtn: {
    backgroundColor: "#E8E8E8",
    width: "100%",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryBtnText: {
    color: GREEN_THEME.textDark,
    fontSize: 15,
    fontWeight: "600",
  },
});
