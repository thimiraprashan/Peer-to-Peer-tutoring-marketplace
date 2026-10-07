import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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

const UNIVERSITIES = [
  "SLIIT",
  "University of Colombo",
  "University of Moratuwa",
  "NSBM",
  "NIBM",
];

const FACULTIES = [
  "Faculty of Computing",
  "Faculty of Engineering",
  "Faculty of Business",
  "Faculty of Humanities",
];

const SUBJECTS = [
  "Programming",
  "Database",
  "Data Structures",
  "Networking",
  "Mathematics",
  "Software Engineering",
];

interface FormErrors {
  university?: string;
  faculty?: string;
  studentId?: string;
  yearOfStudy?: string;
  subjects?: string;
}

export default function TutorProfileForm() {
  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [studentId, setStudentId] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  const toggleSubject = (subject: string) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
    }
    if (errors.subjects) setErrors({ ...errors, subjects: "" });
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    if (!university) newErrors.university = "Please select your university";
    if (!faculty) newErrors.faculty = "Please select your faculty";
    if (!studentId.trim()) {
      newErrors.studentId = "Student ID is required";
    } else if (!/^[A-Z]{2}\d{8}$/i.test(studentId.trim())) {
      newErrors.studentId = "Invalid format. Example: IT23539440";
    }
    if (!yearOfStudy.trim()) {
      newErrors.yearOfStudy = "Year of study is required";
    } else if (!/^[1-5]$/.test(yearOfStudy.trim())) {
      newErrors.yearOfStudy = "Enter a valid year (1-5)";
    }
    if (selectedSubjects.length === 0) {
      newErrors.subjects = "Select at least one subject";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fix the highlighted fields.");
      return;
    }

    // Pass form data to Step 2 via router params
    router.push({
      pathname: "/(tutor)/tutor-document-upload",
      params: {
        university,
        faculty,
        studentId: studentId.trim().toUpperCase(),
        yearOfStudy: yearOfStudy,
        subjects: JSON.stringify(selectedSubjects),
      },
    } as Href);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
          <Text style={styles.headerTitle}>Profile Details</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* ================= STEP INDICATOR ================= */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View
            style={[
              styles.stepLine,
              { backgroundColor: GREEN_THEME.borderLight },
            ]}
          />
          <View
            style={[
              styles.stepDot,
              { backgroundColor: GREEN_THEME.borderLight },
            ]}
          />
        </View>
        <Text style={styles.stepText}>Step 1 of 2 — Basic Details</Text>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ---------- UNIVERSITY ---------- */}
          <Text style={styles.label}>University *</Text>
          <View style={styles.chipRow}>
            {UNIVERSITIES.map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.chip, university === u && styles.chipSelected]}
                onPress={() => {
                  setUniversity(u);
                  if (errors.university)
                    setErrors({ ...errors, university: "" });
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    university === u && styles.chipTextSelected,
                  ]}
                >
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.university ? (
            <Text style={styles.errorText}>{errors.university}</Text>
          ) : null}

          {/* ---------- FACULTY ---------- */}
          <Text style={styles.label}>Faculty *</Text>
          <View style={styles.chipRow}>
            {FACULTIES.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, faculty === f && styles.chipSelected]}
                onPress={() => {
                  setFaculty(f);
                  if (errors.faculty) setErrors({ ...errors, faculty: "" });
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    faculty === f && styles.chipTextSelected,
                  ]}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.faculty ? (
            <Text style={styles.errorText}>{errors.faculty}</Text>
          ) : null}

          {/* ---------- STUDENT ID ---------- */}
          <Text style={styles.label}>Student ID *</Text>
          <TextInput
            style={[styles.input, errors.studentId ? styles.inputError : null]}
            placeholder="Example: IT23539440"
            placeholderTextColor={GREEN_THEME.textGray}
            value={studentId}
            onChangeText={(text) => {
              setStudentId(text);
              if (errors.studentId) setErrors({ ...errors, studentId: "" });
            }}
            autoCapitalize="characters"
          />
          {errors.studentId ? (
            <Text style={styles.errorText}>{errors.studentId}</Text>
          ) : null}

          {/* ---------- YEAR OF STUDY ---------- */}
          <Text style={styles.label}>Year of Study *</Text>
          <View style={styles.chipRow}>
            {["1", "2", "3", "4"].map((y) => (
              <TouchableOpacity
                key={y}
                style={[
                  styles.chip,
                  styles.yearChip,
                  yearOfStudy === y && styles.chipSelected,
                ]}
                onPress={() => {
                  setYearOfStudy(y);
                  if (errors.yearOfStudy)
                    setErrors({ ...errors, yearOfStudy: "" });
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    yearOfStudy === y && styles.chipTextSelected,
                  ]}
                >
                  Year {y}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.yearOfStudy ? (
            <Text style={styles.errorText}>{errors.yearOfStudy}</Text>
          ) : null}

          {/* ---------- SUBJECTS ---------- */}
          <Text style={styles.label}>Subjects You Can Teach *</Text>
          <View style={styles.chipRow}>
            {SUBJECTS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.chip,
                  selectedSubjects.includes(s) && styles.chipSelected,
                ]}
                onPress={() => toggleSubject(s)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedSubjects.includes(s) && styles.chipTextSelected,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.subjects ? (
            <Text style={styles.errorText}>{errors.subjects}</Text>
          ) : null}

          {/* ================= CONTINUE BUTTON ================= */}
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
            <Text style={styles.continueText}>Continue →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

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
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN_THEME.textDark,
    marginTop: 18,
    marginBottom: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: GREEN_THEME.white,
    borderWidth: 1,
    borderColor: GREEN_THEME.borderLight,
  },
  chipSelected: {
    backgroundColor: GREEN_THEME.primaryGreen,
    borderColor: GREEN_THEME.primaryGreen,
  },
  chipText: {
    fontSize: 12,
    color: GREEN_THEME.textDark,
    fontWeight: "500",
  },
  chipTextSelected: { color: GREEN_THEME.white, fontWeight: "600" },
  yearChip: { minWidth: 70, alignItems: "center" },
  input: {
    backgroundColor: GREEN_THEME.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GREEN_THEME.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: GREEN_THEME.textDark,
  },
  inputError: { borderColor: GREEN_THEME.errorRed },
  errorText: {
    fontSize: 11,
    color: GREEN_THEME.errorRed,
    marginTop: 4,
    marginLeft: 2,
  },
  continueBtn: {
    backgroundColor: GREEN_THEME.primaryGreen,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  continueText: { color: GREEN_THEME.white, fontSize: 15, fontWeight: "600" },
});