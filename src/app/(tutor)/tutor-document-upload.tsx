import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams, type Href } from "expo-router";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
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
import { auth, storage } from "../../firebase";
import {
  addTutorSubject,
  submitVerificationRequest,
  updateTutorProfile,
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
  errorRed: "#C62828",
};

// ============================================================
// 🔑 BULLETPROOF UID RETRIEVAL
// ============================================================
function resolveUid(user: any): string | null {
  const firebaseUid = auth?.currentUser?.uid;
  if (firebaseUid) return firebaseUid;

  if (user && typeof user === "object") {
    const candidates = [
      user.uid,
      user.id,
      user._id,
      user.userId,
      user.userID,
      user.user_id,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.length > 0) return c;
    }
  }

  return null;
}

// ============================================================
// 🔑 BULLETPROOF EMAIL RETRIEVAL
// ============================================================
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
  // Pick image from gallery
  // ------------------------------------------
  const pickImage = async (type: "id" | "cv") => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your gallery."
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

  // ------------------------------------------
  // Validate both documents uploaded
  // ------------------------------------------
  const validate = () => {
    const newErrors: { studentIdImage?: string; cvImage?: string } = {};
    if (!studentIdImage)
      newErrors.studentIdImage = "Student ID image is required";
    if (!cvImage) newErrors.cvImage = "CV / Resume image is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // Upload local image URI to Firebase Storage
  // Uses uploadBytesResumable (works in RN/Expo)
  // ============================================
  const uploadImageToStorage = (
    uri: string,
    path: string
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const storageRef = ref(storage, path);

        const uploadTask = uploadBytesResumable(storageRef, blob, {
          contentType: "image/jpeg",
        });

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const label = path.includes("studentId") ? "ID" : "CV";
            setUploadProgress(
              `Uploading ${label}: ${progress.toFixed(0)}%`
            );
            console.log(`📤 ${path}: ${progress.toFixed(0)}%`);
          },
          (error) => {
            console.error(`❌ Upload error for ${path}:`, error);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log(`✅ ${path} uploaded:`, downloadURL);
              resolve(downloadURL);
            } catch (err) {
              reject(err);
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  };

  // ------------------------------------------
  // Submit everything to Firestore + Storage
  // ------------------------------------------
  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert("Missing Documents", "Please upload both documents.");
      return;
    }

    console.log("🔍 AuthContext user:", JSON.stringify(user, null, 2));
    console.log("🔍 auth.currentUser?.uid:", auth?.currentUser?.uid);
    console.log("🔍 auth.currentUser?.email:", auth?.currentUser?.email);

    const uid = resolveUid(user);
    const email = resolveEmail(user);

    console.log("✅ Resolved UID:", uid);
    console.log("✅ Resolved email:", email);

    if (!uid) {
      Alert.alert(
        "Error",
        "You must be logged in. Please log out and log in again."
      );
      return;
    }

    setUploading(true);
    setUploadProgress("Starting upload...");

    try {
      const timestamp = Date.now();

      // ---------- 1. Upload both images to Firebase Storage ----------
      const [idUrl, cvUrl] = await Promise.all([
        uploadImageToStorage(
          studentIdImage!,
          `verification/${uid}/studentId-${timestamp}.jpg`
        ),
        uploadImageToStorage(
          cvImage!,
          `verification/${uid}/cv-${timestamp}.jpg`
        ),
      ]);

      setUploadProgress("Saving profile...");

      // ---------- 2. Save profile fields to Firestore tutors/{uid} ----------
      await updateTutorProfile(uid, {
        university: params.university || "",
        faculty: params.faculty || "",
        studentId: params.studentId || "",
        yearOfStudy: parseInt(params.yearOfStudy || "1", 10),
        verified: false,
      });

      // ---------- 3. Save subjects to tutorSubjects collection ----------
      const subjects: string[] = params.subjects
        ? JSON.parse(params.subjects)
        : [];

      await Promise.all(
        subjects.map((subjectName) =>
          addTutorSubject(uid, {
            moduleCode: subjectName,
            moduleName: subjectName,
            subjectArea: subjectName,
          })
        )
      );

      setUploadProgress("Creating verification request...");

      // ---------- 4. Create verification request ----------
      await submitVerificationRequest(
        uid,
        JSON.stringify({ studentIdUrl: idUrl, cvUrl: cvUrl }),
        email
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
        ]
      );
    } catch (error: any) {
      console.error("❌ Submit error:", error);
      console.error("❌ Error code:", error?.code);
      console.error("❌ Error message:", error?.message);
      setUploading(false);
      setUploadProgress("");

      // Better error messages for common cases
      let userMessage = "Could not submit. Please try again.";
      if (error?.code === "storage/unauthorized") {
        userMessage =
          "Storage permission denied. Please check Firebase Storage rules.";
      } else if (error?.code === "storage/canceled") {
        userMessage = "Upload was canceled.";
      } else if (error?.code === "storage/retry-limit-exceeded") {
        userMessage = "Upload timed out. Check your internet connection.";
      } else if (error?.code === "storage/unknown") {
        userMessage =
          "Upload failed. Check Firebase Storage rules and bucket setup.";
      } else if (error?.message) {
        userMessage = error.message;
      }

      Alert.alert("Upload Error", userMessage);
    }
  };

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
        <Text style={styles.headerTitle}>Upload Documents</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ================= STEP INDICATOR ================= */}
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
        {/* Info box */}
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

        {/* ---------- STUDENT ID ---------- */}
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
              <Text style={styles.uploadSub}>JPG or PNG, max 5MB</Text>
            </>
          )}
        </TouchableOpacity>
        {errors.studentIdImage ? (
          <Text style={styles.errorText}>{errors.studentIdImage}</Text>
        ) : null}

        {/* ---------- CV / RESUME ---------- */}
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

        {/* ================= PROGRESS TEXT ================= */}
        {uploading && uploadProgress ? (
          <Text style={styles.progressText}>{uploadProgress}</Text>
        ) : null}

        {/* ================= SUBMIT BUTTON ================= */}
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
  uploadText: { fontSize: 14, fontWeight: "600", color: GREEN_THEME.textDark },
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