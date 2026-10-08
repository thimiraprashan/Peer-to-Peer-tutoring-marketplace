import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { auth } from "../../firebase";
import {
    addTutorSubject,
    submitVerificationRequest,
    updateTutorProfile,
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
  errorRed: "#C62828",
};

// ============================================================
// UID + EMAIL HELPERS
// ============================================================
function resolveUid(user: any): string | null {
  const firebaseUid = auth?.currentUser?.uid;
  if (firebaseUid) return firebaseUid;
  if (user && typeof user === "object") {
    const candidates = [user.uid, user.id, user._id, user.userId];
    for (const c of candidates) {
      if (typeof c === "string" && c.length > 0) return c;
    }
  }
  return null;
}

function resolveEmail(user: any): string {
  return (
    auth?.currentUser?.email ||
    (user && typeof user === "object" && user.email) ||
    ""
  );
}

export default function TutorDocumentUpload() {
  const params = useLocalSearchParams<{
    university?: string;
    faculty?: string;
    studentId?: string;
    yearOfStudy?: string;
    subjects?: string;
  }>();

  const { user } = useAuth();

  const [studentIdImage, setStudentIdImage] = useState<string | null>(null);
  const [cvImage, setCvImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [errors, setErrors] = useState<{
    studentIdImage?: string;
    cvImage?: string;
  }>({});

  // ------------------------------------------
  // Pick image
  // ------------------------------------------
  const pickImage = async (type: "id" | "cv") => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your gallery.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (type === "id") {
          setStudentIdImage(uri);
          if (errors.studentIdImage)
            setErrors({ ...errors, studentIdImage: "" });
        } else {
          setCvImage(uri);
          if (errors.cvImage) setErrors({ ...errors, cvImage: "" });
        }
      }
    } catch (error) {
      console.log("Image picker error:", error);
      Alert.alert("Error", "Could not open image picker.");
    }
  };

  const validate = () => {
    const newErrors: { studentIdImage?: string; cvImage?: string } = {};
    if (!studentIdImage)
      newErrors.studentIdImage = "Student ID image is required";
    if (!cvImage) newErrors.cvImage = "CV / Resume image is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // Upload to ImgBB (replaces Firebase Storage)
  // ============================================
  const uploadToImgBB = async (uri: string, name: string): Promise<string> => {
    const apiKey = process.env.EXPO_PUBLIC_IMGBB_API_KEY;

    if (!apiKey) {
      throw new Error(
        "ImgBB API key not configured. Check .env for EXPO_PUBLIC_IMGBB_API_KEY.",
      );
    }

    const formData = new FormData();
    formData.append("image", {
      uri,
      type: "image/jpeg",
      name: `${name}-${Date.now()}.jpg`,
    } as any);

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${apiKey}`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message || `ImgBB upload failed (${response.status})`,
      );
    }

    const data = await response.json();

    if (!data?.success || !data?.data?.url) {
      throw new Error("ImgBB returned an unexpected response");
    }

    return data.data.url; // ImgBB URL — data.data.url
  };

  // ------------------------------------------
  // Submit everything
  // ------------------------------------------
  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert("Missing Documents", "Please upload both documents.");
      return;
    }

    const uid = resolveUid(user);
    const email = resolveEmail(user);

    if (!uid) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    setUploading(true);
    setUploadProgress("Uploading documents to ImgBB...");

    try {
      // ---------- 1. Upload both images to ImgBB ----------
      const [idUrl, cvUrl] = await Promise.all([
        uploadToImgBB(studentIdImage!, "student-id"),
        uploadToImgBB(cvImage!, "cv"),
      ]);

      setUploadProgress("Saving profile...");

      // ---------- 2. Save tutor profile ----------
      await updateTutorProfile(uid, {
        university: params.university || "",
        faculty: params.faculty || "",
        studentId: params.studentId || "",
        yearOfStudy: parseInt(params.yearOfStudy || "1", 10),
        verified: false,
      });

      // ---------- 3. Save subjects ----------
      const subjects: string[] = params.subjects
        ? JSON.parse(params.subjects)
        : [];

      await Promise.all(
        subjects.map((subjectName) =>
          addTutorSubject(uid, {
            moduleCode: subjectName,
            moduleName: subjectName,
            subjectArea: subjectName,
          }),
        ),
      );

      setUploadProgress("Creating verification request...");

      // ---------- 4. Create verification request ----------
      await submitVerificationRequest(
        uid,
        JSON.stringify({ studentIdUrl: idUrl, cvUrl: cvUrl }),
        email,
      );

      setUploading(false);
      setUploadProgress("");

      Alert.alert(
        "Success",
        "Your profile has been submitted for verification.",
        [
          {
            text: "OK",
            onPress: () =>
              router.replace("/(tutor)/tutor-verification-status" as Href),
          },
        ],
      );
    } catch (error: any) {
      console.error("❌ Submit error:", error);
      setUploading(false);
      setUploadProgress("");
      Alert.alert(
        "Upload Error",
        error?.message || "Could not submit. Please try again.",
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="chevron-back"
            size={24}
            color={GREEN_THEME.darkGreenText}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Documents</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* STEP INDICATOR */}
      <View style={styles.stepRow}>
        <View
          style={[
            styles.stepDot,
            { backgroundColor: GREEN_THEME.primaryGreen },
          ]}
        />
        <View
          style={[
            styles.stepLine,
            { backgroundColor: GREEN_THEME.primaryGreen },
          ]}
        />
        <View style={[styles.stepDot, styles.stepDotActive]} />
      </View>
      <Text style={styles.stepText}>Step 2 of 2 — Documents</Text>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={GREEN_THEME.darkGreenText}
          />
          <Text style={styles.infoText}>
            Upload clear photos. Admin will review them within 24 hours.
          </Text>
        </View>

        {/* STUDENT ID */}
        <Text style={styles.label}>Student ID Card *</Text>
        <TouchableOpacity
          style={[
            styles.uploadBox,
            errors.studentIdImage ? styles.uploadBoxError : null,
          ]}
          onPress={() => pickImage("id")}
          disabled={uploading}
        >
          {studentIdImage ? (
            <Image
              source={{ uri: studentIdImage }}
              style={styles.previewImage}
            />
          ) : (
            <>
              <Ionicons
                name="cloud-upload-outline"
                size={40}
                color={GREEN_THEME.primaryGreen}
              />
              <Text style={styles.uploadText}>Tap to upload</Text>
              <Text style={styles.uploadSub}>JPG or PNG</Text>
            </>
          )}
        </TouchableOpacity>
        {errors.studentIdImage ? (
          <Text style={styles.errorText}>{errors.studentIdImage}</Text>
        ) : null}

        {/* CV */}
        <Text style={styles.label}>CV / Resume *</Text>
        <TouchableOpacity
          style={[
            styles.uploadBox,
            errors.cvImage ? styles.uploadBoxError : null,
          ]}
          onPress={() => pickImage("cv")}
          disabled={uploading}
        >
          {cvImage ? (
            <Image source={{ uri: cvImage }} style={styles.previewImage} />
          ) : (
            <>
              <Ionicons
                name="document-outline"
                size={40}
                color={GREEN_THEME.primaryGreen}
              />
              <Text style={styles.uploadText}>Tap to upload</Text>
              <Text style={styles.uploadSub}>
                Screenshot or scan of your CV
              </Text>
            </>
          )}
        </TouchableOpacity>
        {errors.cvImage ? (
          <Text style={styles.errorText}>{errors.cvImage}</Text>
        ) : null}

        {/* PROGRESS */}
        {uploading && uploadProgress ? (
          <Text style={styles.progressText}>{uploadProgress}</Text>
        ) : null}

        {/* SUBMIT */}
        <TouchableOpacity
          style={[styles.submitBtn, uploading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={GREEN_THEME.white} />
          ) : (
            <Text style={styles.submitText}>Submit for Verification</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Once submitted, you cannot edit until admin reviews it.
        </Text>
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
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GREEN_THEME.borderLight,
  },
  stepDotActive: { backgroundColor: GREEN_THEME.primaryGreen },
  stepLine: { flex: 1, height: 2, marginHorizontal: 6 },
  stepText: {
    fontSize: 12,
    color: GREEN_THEME.textGray,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_THEME.lightGreenBtn,
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 10,
  },
  infoText: { flex: 1, fontSize: 12, color: GREEN_THEME.darkGreenText },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN_THEME.textDark,
    marginTop: 18,
    marginBottom: 10,
  },
  uploadBox: {
    backgroundColor: GREEN_THEME.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GREEN_THEME.borderLight,
    borderStyle: "dashed",
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },
  uploadBoxError: { borderColor: GREEN_THEME.errorRed },
  uploadText: {
    fontSize: 14,
    fontWeight: "600",
    color: GREEN_THEME.textDark,
  },
  uploadSub: { fontSize: 11, color: GREEN_THEME.textGray },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  errorText: {
    fontSize: 11,
    color: GREEN_THEME.errorRed,
    marginTop: 4,
    marginLeft: 2,
  },
  progressText: {
    fontSize: 12,
    color: GREEN_THEME.primaryGreen,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 16,
  },
  submitBtn: {
    backgroundColor: GREEN_THEME.primaryGreen,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  submitText: { color: GREEN_THEME.white, fontSize: 15, fontWeight: "600" },
  footerNote: {
    fontSize: 11,
    color: GREEN_THEME.textGray,
    textAlign: "center",
    marginTop: 12,
    fontStyle: "italic",
  },
});
