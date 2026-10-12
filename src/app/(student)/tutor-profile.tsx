import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../components/ui/AppButton";
import { Avatar } from "../../components/ui/Avatar";
import { VerifiedBadge } from "../../components/ui/VerifiedBadge";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useStudentFavourites } from "../../hooks/useStudentFavourites";
import { createBooking } from "../../services/bookingService";
import { getOrCreateConversation } from "../../services/chatService";
import {
  addReview,
  deleteReview,
  getReviewsForTutor,
  updateReview,
} from "../../services/reviewService";
import {
  formatNextSlot,
  getTutorProfile,
  getUpcomingSlots,
} from "../../services/tutorService";
import { colors } from "../../theme/colors";

// ── Types ──────────────────────────────────────────────────────────

interface Review {
  id: string;
  studentId: string;
  studentName: string;
  rating: number;
  comment: string;
  createdAt: any;
  updatedAt?: any;
}

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  mode?: string;
  slotDate: Date;
}

interface TutorSubject {
  id?: string;
  moduleCode: string;
  moduleName: string;
  subjectArea?: string;
}

interface TutorProfileData {
  id: string;
  tutorId?: string;
  name: string;
  email?: string;
  avatar?: string | null;
  university?: string;
  faculty?: string;
  degree?: string;
  bio?: string;
  yearOfStudy?: number;
  studentId?: string;
  gpa?: number;
  completedModules?: number;
  hourlyRate?: number;
  sessionMode?: "online" | "in-person" | "both" | string;
  verified?: boolean;
  ratingAvg?: number;
  ratingCount?: number;
  totalSessions?: number;
  languages?: string[];
  experience?: string;
  responseTime?: string;
  subjects?: TutorSubject[];
  [key: string]: any;
}

// ── Helpers ─────────────────────────────────────────────────────────

const StarRow = ({
  rating,
  size = 16,
  gap = 2,
}: {
  rating: number;
  size?: number;
  gap?: number;
}) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Ionicons
        key={n}
        name={n <= Math.round(rating) ? "star" : "star-outline"}
        size={size}
        color={colors.star}
      />
    ))}
  </View>
);

const TappableStars = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) => (
  <View style={styles.tappableStarRow} accessibilityRole="radiogroup">
    {[1, 2, 3, 4, 5].map((n) => (
      <Pressable
        key={n}
        onPress={() => onChange(n)}
        accessibilityRole="radio"
        accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
        accessibilityState={{ checked: value === n }}
        style={styles.tappableStar}
        hitSlop={8}
      >
        <Ionicons
          name={n <= value ? "star" : "star-outline"}
          size={36}
          color={colors.star}
        />
      </Pressable>
    ))}
  </View>
);

const formatRelativeDate = (ts: any): string => {
  if (!ts) return "";
  const ms: number = ts?.toMillis?.() ?? (typeof ts === "number" ? ts : new Date(ts).getTime());
  if (isNaN(ms) || ms <= 0) return "";
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (amount?: number): string => {
  const val = typeof amount === "number" ? amount : 0;
  return `LKR ${val.toLocaleString()}`;
};

const formatAcademicYear = (year?: number): string => {
  if (!year) return "Undergraduate";
  if (year === 1) return "1st Year Undergraduate";
  if (year === 2) return "2nd Year Undergraduate";
  if (year === 3) return "3rd Year Undergraduate";
  if (year === 4) return "4th Year Undergraduate";
  return `Year ${year} Undergraduate`;
};

// ── Main Screen ────────────────────────────────────────────────────

export default function TutorProfileScreen() {
  const { tutorId: tutorIdParam } = useLocalSearchParams<{ tutorId?: string | string[] }>();
  const tutorId = Array.isArray(tutorIdParam) ? tutorIdParam[0] : tutorIdParam;
  const router = useRouter();
  const { user, profile: currentProfile } = useCurrentUser();
  const isStudent = currentProfile?.role === "student" || !currentProfile?.role;

  const { favouriteIds, toggleFavourite } = useStudentFavourites(user?.uid);
  const isFavourited = tutorId ? favouriteIds.has(tutorId) : false;

  // Data state
  const [tutorProfile, setTutorProfile] = useState<TutorProfileData | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // UI state
  const [bioExpanded, setBioExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"about" | "modules" | "schedule" | "reviews">("about");

  // Review modal state
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [draftRating, setDraftRating] = useState<number>(5);
  const [draftComment, setDraftComment] = useState<string>("");
  const [ratingError, setRatingError] = useState<string>("");
  const [commentError, setCommentError] = useState<string>("");
  const [savingReview, setSavingReview] = useState<boolean>(false);

  // Booking modal state
  const [bookingModalVisible, setBookingModalVisible] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [customDate, setCustomDate] = useState<string>("");
  const [customTime, setCustomTime] = useState<string>("");
  const [bookingMode, setBookingMode] = useState<"online" | "in-person">("online");
  const [bookingNote, setBookingNote] = useState<string>("");
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [startingChat, setStartingChat] = useState<boolean>(false);

  const commentRef = useRef<TextInput>(null);

  // ── Load All Data ────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!tutorId) {
      setTutorProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [tp, sl, rv] = await Promise.all([
        getTutorProfile(tutorId),
        getUpcomingSlots(tutorId),
        getReviewsForTutor(tutorId),
      ]);
      setTutorProfile(tp);
      setSlots(sl);
      setReviews(rv as any);

      // Pre-select first subject if available
      if (tp?.subjects && tp.subjects.length > 0 && !selectedSubject) {
        setSelectedSubject(tp.subjects[0].moduleCode);
      }
    } catch (err) {
      console.error("Error loading tutor profile:", err);
    } finally {
      setLoading(false);
    }
  }, [tutorId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  // Current user's own review
  const myReview = useMemo(
    () => reviews.find((r) => r.studentId === user?.uid) ?? null,
    [reviews, user?.uid]
  );

  // Rating breakdown distribution
  const ratingBreakdown = useMemo(() => {
    const total = reviews.length;
    const counts = [0, 0, 0, 0, 0]; // 1 star to 5 stars
    reviews.forEach((r) => {
      const star = Math.min(Math.max(Math.round(r.rating), 1), 5);
      counts[star - 1] += 1;
    });
    return [5, 4, 3, 2, 1].map((stars) => {
      const count = counts[stars - 1];
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return { stars, count, percentage };
    });
  }, [reviews]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleShare = async () => {
    if (!tutorProfile) return;
    try {
      await Share.share({
        title: `${tutorProfile.name} - Peer Tutor`,
        message: `Check out ${tutorProfile.name}'s tutoring profile on Peer Tutor App! Specializing in ${
          tutorProfile.subjects?.[0]?.moduleName || "Academic modules"
        } at ${tutorProfile.university || "University"}.`,
      });
    } catch {
      // dismissed
    }
  };

  const handleStartChat = async () => {
    if (!user?.uid) {
      Alert.alert("Sign In Required", "Please sign in to message this tutor.");
      return;
    }
    if (!tutorProfile) return;
    const targetTutorId = tutorProfile.tutorId || tutorProfile.id || tutorId || "";
    if (user.uid === targetTutorId) {
      Alert.alert("Notice", "You cannot chat with yourself.");
      return;
    }

    setStartingChat(true);
    try {
      const convId = await getOrCreateConversation(
        user.uid,
        currentProfile?.name || "Student",
        targetTutorId,
        tutorProfile.name
      );
      router.push(`/chat/${convId}` as any);
    } catch (err: any) {
      Alert.alert("Chat Error", err?.message || "Could not open chat with this tutor.");
    } finally {
      setStartingChat(false);
    }
  };

  const openBookingModalWithSubject = (subjectCode?: string, slot?: Slot) => {
    if (subjectCode) setSelectedSubject(subjectCode);
    if (slot) {
      setSelectedSlot(slot);
      setCustomDate(slot.date);
      setCustomTime(slot.startTime);
      if (slot.mode) {
        setBookingMode(slot.mode.toLowerCase().includes("person") ? "in-person" : "online");
      }
    } else if (slots.length > 0) {
      setSelectedSlot(slots[0]);
      setCustomDate(slots[0].date);
      setCustomTime(slots[0].startTime);
    }
    setBookingModalVisible(true);
  };

  const handleConfirmBooking = async () => {
    if (!user?.uid) {
      Alert.alert("Sign in required", "Please sign in to book a session.");
      return;
    }
    if (!tutorProfile) return;

    const targetTutorId = tutorProfile.tutorId || tutorProfile.id || tutorId;
    const finalDate = selectedSlot ? selectedSlot.date : customDate.trim();
    const finalTime = selectedSlot ? selectedSlot.startTime : customTime.trim();

    if (!finalDate || !finalTime) {
      Alert.alert("Missing Schedule", "Please select an available slot or enter a preferred date and time.");
      return;
    }

    setBookingLoading(true);
    try {
      await createBooking({
        tutorId: targetTutorId,
        tutorName: tutorProfile.name,
        studentId: user.uid,
        studentName: currentProfile?.name || "Student",
        subjectCode: selectedSubject || tutorProfile.subjects?.[0]?.moduleCode || "General Tutoring",
        slotId: selectedSlot?.id || null,
        date: finalDate,
        startTime: finalTime,
        endTime: selectedSlot?.endTime || "",
        mode: bookingMode,
        note: bookingNote.trim(),
        price: tutorProfile.hourlyRate || 1500,
      });

      setBookingModalVisible(false);
      setBookingNote("");
      Alert.alert(
        "Booking Requested!",
        `Your session request for ${selectedSubject || "tutoring"} with ${tutorProfile.name} on ${finalDate} at ${finalTime} has been sent. The tutor will confirm shortly.`,
        [{ text: "Great!" }]
      );
      loadAll();
    } catch (err: any) {
      Alert.alert("Booking Failed", err?.message || "Could not place booking request.");
    } finally {
      setBookingLoading(false);
    }
  };

  // ── Review Handlers ─────────────────────────────────────────────

  const openReviewModal = (existing: Review | null = null) => {
    setEditingReview(existing);
    setDraftRating(existing?.rating ?? 5);
    setDraftComment(existing?.comment ?? "");
    setRatingError("");
    setCommentError("");
    setModalVisible(true);
  };

  const handleSaveReview = async () => {
    if (draftRating < 1 || draftRating > 5) {
      setRatingError("Please select a rating between 1 and 5 stars.");
      return;
    }
    const trimmed = draftComment.trim();
    if (trimmed.length < 5) {
      setCommentError("Review must be at least 5 characters.");
      return;
    }
    if (trimmed.length > 300) {
      setCommentError("Review must be 300 characters or fewer.");
      return;
    }

    if (!user?.uid || !tutorId) {
      Alert.alert("Sign in required", "Please sign in to write a review.");
      return;
    }

    setSavingReview(true);
    try {
      if (editingReview) {
        await updateReview(editingReview.id, draftRating, trimmed);
      } else {
        await addReview(
          tutorId,
          user.uid,
          currentProfile?.name || "Student",
          draftRating,
          trimmed
        );
      }
      setModalVisible(false);
      await loadAll();
    } catch (err: any) {
      setCommentError(err?.message || "Failed to submit review.");
    } finally {
      setSavingReview(false);
    }
  };

  const handleDeleteReview = (reviewId: string) => {
    Alert.alert(
      "Delete Review",
      "Are you sure you want to remove your review for this tutor?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteReview(reviewId, tutorId);
              await loadAll();
            } catch {
              Alert.alert("Error", "Could not delete review.");
            }
          },
        },
      ]
    );
  };

  // ── Loading & Not Found States ──────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading tutor profile...</Text>
      </SafeAreaView>
    );
  }

  if (!tutorProfile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={54} color={colors.error} />
        <Text style={styles.errorTitle}>Tutor Not Found</Text>
        <Text style={styles.errorSubtitle}>
          We couldn't locate the profile for this tutor. It may have been removed or updated.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backButtonFallback}>
          <Text style={styles.backButtonFallbackText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const {
    name,
    university = "SLIIT",
    faculty = "Faculty of Computing",
    degree = "BSc (Hons) in Information Technology",
    bio = "Passionate peer tutor dedicated to helping fellow university students understand complex concepts and excel in their coursework, lab assessments, and final exams.",
    yearOfStudy = 3,
    studentId = "IT21045982",
    gpa = 3.8,
    completedModules = 12,
    hourlyRate = 1500,
    sessionMode = "online",
    verified = true,
    ratingAvg = 5.0,
    ratingCount = 0,
    totalSessions = 28,
    languages = ["English", "Sinhala"],
    experience = "2+ years tutoring experience",
    responseTime = "Usually responds within 1 hour",
    subjects = [],
  } = tutorProfile;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* ── Top Navigation Bar ── */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.navBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <Text style={styles.navTitle} numberOfLines={1}>
          Tutor Profile
        </Text>

        <View style={styles.navRightActions}>
          <TouchableOpacity
            onPress={() => { if (tutorId) toggleFavourite(tutorId); }}
            accessibilityRole="button"
            accessibilityLabel={isFavourited ? "Remove from favourites" : "Save as favourite"}
            style={styles.navBtn}
            hitSlop={8}
          >
            <Ionicons
              name={isFavourited ? "heart" : "heart-outline"}
              size={24}
              color={isFavourited ? "#E53935" : colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share tutor profile"
            style={styles.navBtn}
            hitSlop={8}
          >
            <Ionicons name="share-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Hero Card (Profile Showcase) ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarWrapper}>
              <Avatar name={name} size={76} />
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
              </View>
            </View>

            <View style={styles.heroDetails}>
              <View style={styles.nameRow}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {name}
                </Text>
                {verified && <VerifiedBadge />}
              </View>

              <Text style={styles.heroUniversity} numberOfLines={1}>
                {university} · {faculty}
              </Text>

              <Text style={styles.heroDegree} numberOfLines={1}>
                {degree} · {formatAcademicYear(yearOfStudy)}
              </Text>

              <View style={styles.heroRatingRow}>
                <StarRow rating={ratingAvg} size={15} gap={2} />
                <Text style={styles.ratingScore}>{ratingAvg.toFixed(1)}</Text>
                <Text style={styles.ratingCountText}>
                  ({ratingCount} {ratingCount === 1 ? "review" : "reviews"})
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Attribute Pills */}
          <View style={styles.heroPillsRow}>
            <View style={styles.pillBadge}>
              <Ionicons name="cash-outline" size={14} color={colors.primary} />
              <Text style={styles.pillText}>{formatCurrency(hourlyRate)} / hr</Text>
            </View>

            <View style={styles.pillBadge}>
              <Ionicons
                name={
                  sessionMode === "in-person"
                    ? "people-outline"
                    : sessionMode === "both"
                    ? "git-merge-outline"
                    : "videocam-outline"
                }
                size={14}
                color={colors.primary}
              />
              <Text style={styles.pillText}>
                {sessionMode === "both"
                  ? "Online & In-person"
                  : sessionMode === "in-person"
                  ? "In-person Only"
                  : "Online Sessions"}
              </Text>
            </View>

            <View style={styles.pillBadge}>
              <Ionicons name="flash-outline" size={14} color={colors.primary} />
              <Text style={styles.pillText}>{responseTime}</Text>
            </View>
          </View>
        </View>

        {/* ── 2. Performance Stats Grid ── */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={styles.statIconWrap}>
              <Ionicons name="school" size={18} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{typeof gpa === "number" ? gpa.toFixed(2) : "3.80"}</Text>
            <Text style={styles.statLabel}>Academic GPA</Text>
            <Text style={styles.statSub}>Top Performer</Text>
          </View>

          <View style={styles.statBox}>
            <View style={styles.statIconWrap}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{totalSessions}+</Text>
            <Text style={styles.statLabel}>Sessions</Text>
            <Text style={styles.statSub}>Completed</Text>
          </View>

          <View style={styles.statBox}>
            <View style={styles.statIconWrap}>
              <Ionicons name="book-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{completedModules}</Text>
            <Text style={styles.statLabel}>Modules</Text>
            <Text style={styles.statSub}>Mastered</Text>
          </View>

          <View style={styles.statBox}>
            <View style={styles.statIconWrap}>
              <Ionicons name="ribbon-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{experience.split(" ")[0] || "2+ yrs"}</Text>
            <Text style={styles.statLabel}>Experience</Text>
            <Text style={styles.statSub}>Peer Mentor</Text>
          </View>
        </View>

        {/* ── 3. Academic Credentials & Verification Card ── */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Verified Academic Credentials</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Official university enrollment and identity verified by Peer Tutor platform.
          </Text>

          <View style={styles.credentialsList}>
            <View style={styles.credentialItem}>
              <View style={styles.credentialDot} />
              <View style={styles.credentialTextWrap}>
                <Text style={styles.credentialTitle}>Institution & Campus</Text>
                <Text style={styles.credentialValue}>{university}</Text>
              </View>
            </View>

            <View style={styles.credentialItem}>
              <View style={styles.credentialDot} />
              <View style={styles.credentialTextWrap}>
                <Text style={styles.credentialTitle}>Faculty & Major</Text>
                <Text style={styles.credentialValue}>
                  {faculty} · {degree}
                </Text>
              </View>
            </View>

            <View style={styles.credentialItem}>
              <View style={styles.credentialDot} />
              <View style={styles.credentialTextWrap}>
                <Text style={styles.credentialTitle}>Academic Standing & GPA</Text>
                <Text style={styles.credentialValue}>
                  GPA {typeof gpa === "number" ? gpa.toFixed(2) : "3.80"} / 4.00 · {formatAcademicYear(yearOfStudy)}
                </Text>
              </View>
            </View>

            {studentId ? (
              <View style={styles.credentialItem}>
                <View style={styles.credentialDot} />
                <View style={styles.credentialTextWrap}>
                  <Text style={styles.credentialTitle}>Student Registration</Text>
                  <Text style={styles.credentialValue}>Verified ID #{studentId}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── 4. About the Tutor & Languages ── */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>About the Tutor</Text>
          </View>

          <Text
            style={styles.bioBodyText}
            numberOfLines={bioExpanded ? undefined : 4}
          >
            {bio}
          </Text>

          {bio.length > 160 && (
            <TouchableOpacity
              onPress={() => setBioExpanded(!bioExpanded)}
              style={styles.expandBioBtn}
              hitSlop={6}
            >
              <Text style={styles.expandBioText}>
                {bioExpanded ? "Show Less" : "Read More..."}
              </Text>
              <Ionicons
                name={bioExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}

          {/* Languages */}
          <View style={styles.languagesContainer}>
            <Text style={styles.subSectionTitle}>Languages Spoken</Text>
            <View style={styles.languagesRow}>
              {languages.map((lang, idx) => (
                <View key={idx} style={styles.langPill}>
                  <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.primary} />
                  <Text style={styles.langText}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── 5. Modules & Subjects Taught ── */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="layers-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              Modules & Subjects ({subjects.length})
            </Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Certified to provide tutoring and exam preparation in these specific courses:
          </Text>

          {subjects.length === 0 ? (
            <Text style={styles.emptyNoticeText}>No specific modules registered yet.</Text>
          ) : (
            <View style={styles.subjectsGrid}>
              {subjects.map((subj, index) => (
                <View key={subj.id || `${subj.moduleCode}-${index}`} style={styles.subjectCard}>
                  <View style={styles.subjectHeader}>
                    <View style={styles.moduleCodeBadge}>
                      <Text style={styles.moduleCodeText}>{subj.moduleCode}</Text>
                    </View>
                    <View style={styles.gradeBadge}>
                      <Text style={styles.gradeBadgeText}>Grade A / High Distinction</Text>
                    </View>
                  </View>

                  <Text style={styles.subjectName}>{subj.moduleName}</Text>
                  {subj.subjectArea ? (
                    <Text style={styles.subjectAreaText}>{subj.subjectArea}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={styles.bookModuleBtn}
                    onPress={() => openBookingModalWithSubject(subj.moduleCode)}
                    hitSlop={4}
                  >
                    <Text style={styles.bookModuleBtnText}>Book This Subject</Text>
                    <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── 6. Available Time Slots ── */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              Upcoming Available Slots ({slots.length})
            </Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Instant booking slots published directly by {name}:
          </Text>

          {slots.length === 0 ? (
            <View style={styles.emptySlotCard}>
              <Ionicons name="calendar-clear-outline" size={36} color={colors.mutedText} />
              <Text style={styles.emptySlotTitle}>No fixed slots available right now</Text>
              <Text style={styles.emptySlotSubtitle}>
                You can still request a custom date and time that fits your study schedule.
              </Text>
              <TouchableOpacity
                style={styles.requestSlotBtn}
                onPress={() => openBookingModalWithSubject()}
              >
                <Text style={styles.requestSlotBtnText}>Request Custom Time</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.slotsList}>
              {slots.map((slot) => (
                <View key={slot.id} style={styles.slotCard}>
                  <View style={styles.slotInfo}>
                    <View style={styles.slotTimeRow}>
                      <Ionicons name="calendar" size={14} color={colors.primary} />
                      <Text style={styles.slotDateText}>{formatNextSlot(slot.slotDate)}</Text>
                    </View>
                    <View style={styles.slotTimeRow}>
                      <Ionicons name="time" size={14} color={colors.mutedText} />
                      <Text style={styles.slotHoursText}>
                        {slot.startTime} {slot.endTime ? `– ${slot.endTime}` : ""}
                      </Text>
                    </View>
                    {slot.mode ? (
                      <View style={styles.slotModePill}>
                        <Text style={styles.slotModeText}>{slot.mode}</Text>
                      </View>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.slotBookBtn}
                    onPress={() => openBookingModalWithSubject(undefined, slot)}
                  >
                    <Text style={styles.slotBookBtnText}>Select</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── 7. Ratings & Student Reviews ── */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="star" size={20} color={colors.star} />
              <Text style={styles.sectionTitle}>
                Student Reviews ({reviews.length})
              </Text>
            </View>

            {isStudent && (
              <TouchableOpacity
                onPress={() => openReviewModal(myReview)}
                style={styles.writeReviewCTA}
              >
                <Ionicons
                  name={myReview ? "pencil" : "add-circle-outline"}
                  size={15}
                  color={colors.primary}
                />
                <Text style={styles.writeReviewCTAText}>
                  {myReview ? "Edit Review" : "Write Review"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Rating Summary & Breakdown Bars */}
          <View style={styles.ratingSummaryCard}>
            <View style={styles.ratingScoreCol}>
              <Text style={styles.bigRatingScore}>{ratingAvg.toFixed(1)}</Text>
              <StarRow rating={ratingAvg} size={16} gap={3} />
              <Text style={styles.summaryReviewCount}>
                Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </Text>
            </View>

            <View style={styles.breakdownBarsCol}>
              {ratingBreakdown.map((row) => (
                <View key={row.stars} style={styles.barRow}>
                  <Text style={styles.barStarLabel}>{row.stars}★</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${row.percentage}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.barCountLabel}>{row.count}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Review Items List */}
          {reviews.length === 0 ? (
            <View style={styles.emptyReviewsCard}>
              <Text style={styles.emptyNoticeText}>
                No student reviews yet. Book a session and be the first to leave feedback!
              </Text>
            </View>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map((rev) => {
                const isMyOwn = rev.studentId === user?.uid;
                return (
                  <View key={rev.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <Avatar name={rev.studentName} size={38} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={styles.reviewerName}>{rev.studentName}</Text>
                            {isMyOwn && <Text style={styles.youBadge}>(You)</Text>}
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <StarRow rating={rev.rating} size={12} gap={1} />
                            <Text style={styles.reviewDate}>{formatRelativeDate(rev.createdAt)}</Text>
                          </View>
                        </View>
                      </View>

                      {isMyOwn && (
                        <View style={styles.reviewActions}>
                          <TouchableOpacity
                            onPress={() => openReviewModal(rev)}
                            style={styles.reviewActionBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="pencil" size={15} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteReview(rev.id)}
                            style={styles.reviewActionBtn}
                            hitSlop={6}
                          >
                            <Ionicons name="trash-outline" size={15} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    <Text style={styles.reviewComment}>{rev.comment}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Space so content clears the sticky bottom footer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Sticky Bottom Action Bar ── */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={handleStartChat}
          disabled={startingChat}
          accessibilityRole="button"
          accessibilityLabel="Message tutor"
        >
          {startingChat ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.primary} />
              <Text style={styles.messageBtnText}>Message</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bookNowBtn}
          onPress={() => openBookingModalWithSubject()}
          accessibilityRole="button"
          accessibilityLabel="Book a session"
        >
          <View style={styles.bookNowPriceCol}>
            <Text style={styles.bookNowPriceLabel}>Session Fee</Text>
            <Text style={styles.bookNowPriceText}>{formatCurrency(hourlyRate)}/hr</Text>
          </View>
          <View style={styles.bookNowCtaRow}>
            <Text style={styles.bookNowCtaText}>Book Session</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Booking Modal ── */}
      <Modal
        visible={bookingModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModalSheet}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalSheetTitle}>Book a Session</Text>
                <Text style={styles.modalSheetSubtitle}>with {name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setBookingModalVisible(false)}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* Step 1: Subject Selection */}
              <Text style={styles.inputGroupLabel}>1. Select Subject / Module *</Text>
              {subjects.length > 0 ? (
                <View style={styles.chipsWrap}>
                  {subjects.map((s) => {
                    const isSelected = selectedSubject === s.moduleCode;
                    return (
                      <TouchableOpacity
                        key={s.moduleCode}
                        onPress={() => setSelectedSubject(s.moduleCode)}
                        style={[
                          styles.subjectChip,
                          isSelected && styles.subjectChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.subjectChipText,
                            isSelected && styles.subjectChipTextActive,
                          ]}
                        >
                          {s.moduleCode} · {s.moduleName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Data Structures & Algorithms"
                  placeholderTextColor={colors.mutedText}
                  value={selectedSubject}
                  onChangeText={setSelectedSubject}
                />
              )}

              {/* Step 2: Date & Time */}
              <Text style={[styles.inputGroupLabel, { marginTop: 16 }]}>
                2. Available Slot or Preferred Time *
              </Text>
              {slots.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.inputHelperText}>Tutor's open schedule slots:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    {slots.map((s) => {
                      const isSelected = selectedSlot?.id === s.id;
                      return (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => {
                            setSelectedSlot(s);
                            setCustomDate(s.date);
                            setCustomTime(s.startTime);
                          }}
                          style={[
                            styles.slotChip,
                            isSelected && styles.slotChipActive,
                          ]}
                        >
                          <Text style={[styles.slotChipDate, isSelected && styles.slotChipTextActive]}>
                            {formatNextSlot(s.slotDate)}
                          </Text>
                          <Text style={[styles.slotChipTime, isSelected && styles.slotChipTextActive]}>
                            {s.startTime} {s.endTime ? `– ${s.endTime}` : ""}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={styles.dateTimeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputHelperText}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="2026-10-15"
                    placeholderTextColor={colors.mutedText}
                    value={customDate}
                    onChangeText={(t) => {
                      setCustomDate(t);
                      setSelectedSlot(null);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputHelperText}>Start Time (e.g. 15:00)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="14:00"
                    placeholderTextColor={colors.mutedText}
                    value={customTime}
                    onChangeText={(t) => {
                      setCustomTime(t);
                      setSelectedSlot(null);
                    }}
                  />
                </View>
              </View>

              {/* Step 3: Session Delivery Mode */}
              <Text style={[styles.inputGroupLabel, { marginTop: 16 }]}>
                3. Session Format
              </Text>
              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.modeToggleBtn,
                    bookingMode === "online" && styles.modeToggleBtnActive,
                  ]}
                  onPress={() => setBookingMode("online")}
                >
                  <Ionicons
                    name="videocam-outline"
                    size={16}
                    color={bookingMode === "online" ? "#FFFFFF" : colors.primary}
                  />
                  <Text
                    style={[
                      styles.modeToggleText,
                      bookingMode === "online" && styles.modeToggleTextActive,
                    ]}
                  >
                    Online (Video Call)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeToggleBtn,
                    bookingMode === "in-person" && styles.modeToggleBtnActive,
                  ]}
                  onPress={() => setBookingMode("in-person")}
                >
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color={bookingMode === "in-person" ? "#FFFFFF" : colors.primary}
                  />
                  <Text
                    style={[
                      styles.modeToggleText,
                      bookingMode === "in-person" && styles.modeToggleTextActive,
                    ]}
                  >
                    In-person (Campus)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Step 4: Notes / Topics */}
              <Text style={[styles.inputGroupLabel, { marginTop: 16 }]}>
                4. Topic / Notes for Tutor (Optional)
              </Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="What specific topic, assignment, or past paper questions would you like help with?"
                placeholderTextColor={colors.mutedText}
                value={bookingNote}
                onChangeText={setBookingNote}
                multiline
                numberOfLines={3}
              />

              {/* Fee Summary */}
              <View style={styles.feeSummaryBox}>
                <View style={styles.feeSummaryRow}>
                  <Text style={styles.feeSummaryLabel}>Estimated Rate (1 Hour)</Text>
                  <Text style={styles.feeSummaryVal}>{formatCurrency(hourlyRate)}</Text>
                </View>
                <View style={styles.feeSummaryRow}>
                  <Text style={styles.feeSummaryLabel}>Platform Student Protection</Text>
                  <Text style={styles.feeFreeVal}>Free</Text>
                </View>
                <View style={[styles.feeSummaryRow, styles.feeTotalRow]}>
                  <Text style={styles.feeTotalLabel}>Total Amount</Text>
                  <Text style={styles.feeTotalVal}>{formatCurrency(hourlyRate)}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                onPress={() => setBookingModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmBooking}
                disabled={bookingLoading}
                style={styles.modalConfirmBtn}
              >
                {bookingLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Confirm Booking</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Review Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {editingReview ? "Edit Your Review" : `Rate & Review ${name}`}
            </Text>
            <Text style={styles.modalSub}>
              Share honest feedback to help fellow students find the right peer tutor.
            </Text>

            <TappableStars value={draftRating} onChange={setDraftRating} />
            {ratingError ? <Text style={styles.errorBanner}>{ratingError}</Text> : null}

            <View style={styles.commentInputWrap}>
              <TextInput
                ref={commentRef}
                style={styles.commentInput}
                placeholder="What did you think of the tutor's teaching pace, explanation clarity, and subject depth? (5–300 characters)"
                placeholderTextColor={colors.mutedText}
                value={draftComment}
                onChangeText={setDraftComment}
                multiline
                maxLength={300}
              />
              <Text style={styles.charCounter}>{draftComment.trim().length} / 300</Text>
            </View>
            {commentError ? <Text style={styles.errorBanner}>{commentError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalBtnCancel}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveReview}
                disabled={savingReview}
                style={styles.modalBtnSave}
              >
                {savingReview ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalBtnSaveText}>
                    {editingReview ? "Update Review" : "Submit Review"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.mutedText,
    fontWeight: "500",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginTop: 14,
  },
  errorSubtitle: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  backButtonFallback: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonFallbackText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  // Navigation Bar
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  navTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginLeft: 8,
  },
  navRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // Hero Card
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 14,
  },
  avatarWrapper: {
    position: "relative",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#388E3C",
  },
  heroDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  heroName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  heroUniversity: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 2,
  },
  heroDegree: {
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: 6,
  },
  heroRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  ratingScore: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  ratingCountText: {
    fontSize: 12,
    color: colors.mutedText,
  },
  heroPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lightGreen,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
    marginTop: 2,
  },
  statSub: {
    fontSize: 10,
    color: colors.mutedText,
  },

  // Common Card Section
  cardSection: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionHeaderRowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: 12,
    lineHeight: 17,
  },

  // Credentials
  credentialsList: {
    gap: 10,
  },
  credentialItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  credentialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  credentialTextWrap: {
    flex: 1,
  },
  credentialTitle: {
    fontSize: 11,
    color: colors.mutedText,
    fontWeight: "500",
  },
  credentialValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },

  // Bio & Languages
  bioBodyText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  expandBioBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  expandBioText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  languagesContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.mutedText,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  languagesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  langText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "500",
  },

  // Subjects / Modules
  subjectsGrid: {
    gap: 10,
  },
  subjectCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subjectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  moduleCodeBadge: {
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  moduleCodeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  gradeBadge: {
    backgroundColor: "#FFF8E1",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#FFE082",
  },
  gradeBadgeText: {
    fontSize: 11,
    color: "#B78103",
    fontWeight: "600",
  },
  subjectName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  subjectAreaText: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  bookModuleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    marginTop: 8,
  },
  bookModuleBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },

  // Slots
  emptySlotCard: {
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  emptySlotTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginTop: 8,
  },
  emptySlotSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  requestSlotBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.lightGreen,
    borderRadius: 14,
  },
  requestSlotBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  slotsList: {
    gap: 8,
  },
  slotCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotInfo: {
    flex: 1,
    gap: 4,
  },
  slotTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  slotDateText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  slotHoursText: {
    fontSize: 12,
    color: colors.mutedText,
  },
  slotModePill: {
    alignSelf: "flex-start",
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  slotModeText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "capitalize",
  },
  slotBookBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  slotBookBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Ratings & Reviews
  writeReviewCTA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  writeReviewCTAText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  ratingSummaryCard: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  ratingScoreCol: {
    alignItems: "center",
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    width: 110,
  },
  bigRatingScore: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
  },
  summaryReviewCount: {
    fontSize: 10,
    color: colors.mutedText,
    marginTop: 4,
    textAlign: "center",
  },
  breakdownBarsCol: {
    flex: 1,
    paddingLeft: 14,
    gap: 4,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  barStarLabel: {
    fontSize: 11,
    color: colors.mutedText,
    width: 22,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.star,
    borderRadius: 3,
  },
  barCountLabel: {
    fontSize: 11,
    color: colors.mutedText,
    width: 18,
    textAlign: "right",
  },
  emptyReviewsCard: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyNoticeText: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: "center",
  },
  reviewsList: {
    gap: 10,
  },
  reviewCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  youBadge: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
  },
  reviewDate: {
    fontSize: 11,
    color: colors.mutedText,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 8,
  },
  reviewActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewComment: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },

  // Sticky Footer
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.lightGreen,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    minWidth: 100,
  },
  messageBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  bookNowBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  bookNowPriceCol: {
    alignItems: "flex-start",
  },
  bookNowPriceLabel: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.8)",
  },
  bookNowPriceText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  bookNowCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookNowCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Booking Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  bookingModalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    maxHeight: "85%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  modalSheetSubtitle: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  inputGroupLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  inputHelperText: {
    fontSize: 11,
    color: colors.mutedText,
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  subjectChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  subjectChipActive: {
    backgroundColor: colors.lightGreen,
    borderColor: colors.primary,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.text,
  },
  subjectChipTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  slotChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: "center",
  },
  slotChipTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  slotChipActive: {
    backgroundColor: colors.lightGreen,
    borderColor: colors.primary,
  },
  slotChipDate: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  slotChipTime: {
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
  },
  modalTextArea: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  modeToggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 12,
    paddingVertical: 10,
  },
  modeToggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  modeToggleTextActive: {
    color: "#FFFFFF",
  },
  feeSummaryBox: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  feeSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  feeSummaryLabel: {
    fontSize: 12,
    color: colors.mutedText,
  },
  feeSummaryVal: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  feeFreeVal: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  feeTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    marginTop: 2,
  },
  feeTotalLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  feeTotalVal: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: colors.lightGreen,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  modalConfirmBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Review Modal
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  modalSub: {
    fontSize: 12,
    color: colors.mutedText,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  tappableStarRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  tappableStar: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  commentInputWrap: {
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    minHeight: 110,
  },
  commentInput: {
    fontSize: 14,
    color: colors.text,
    minHeight: 70,
    textAlignVertical: "top",
  },
  charCounter: {
    fontSize: 11,
    color: colors.mutedText,
    textAlign: "right",
    marginTop: 4,
  },
  errorBanner: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  modalBtnCancel: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.lightGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  modalBtnSave: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
