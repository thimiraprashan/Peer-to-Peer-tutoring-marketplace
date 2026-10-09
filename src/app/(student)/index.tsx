import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../../components/ui/AppButton";
import { AppInput } from "../../components/ui/AppInput";
import { Avatar } from "../../components/ui/Avatar";
import { VerifiedBadge } from "../../components/ui/VerifiedBadge";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
  addSavedModule,
  getSavedModules,
  removeSavedModule,
} from "../../services/savedModuleService";
import { fetchTutors } from "../../services/tutorService";
import { getStudyTasks, daysUntil, formatCountdown } from "../../services/studyTaskService";
import { colors } from "../../theme/colors";

const FILTER_SUBJECTS = ["IT", "Business", "Engineering"];

export default function StudentHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useCurrentUser();

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Tutors list state
  const [tutors, setTutors] = useState<any[]>([]);
  const [loadingTutors, setLoadingTutors] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);

  // Saved modules state
  const [savedModules, setSavedModules] = useState<any[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [moduleError, setModuleError] = useState<string | null>(null);

  // Add Module Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [savingModule, setSavingModule] = useState(false);
  const [formError, setFormError] = useState<{
    code?: string;
    name?: string;
    general?: string;
  }>({});

  // Study Planner state
  const [nextTask, setNextTask] = useState<any>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        setLoadingTasks(true);
        getStudyTasks(user.uid)
          .then((tasks) => {
            const next = tasks.find((t) => t.status !== "done");
            setNextTask(next || null);
          })
          .catch(console.error)
          .finally(() => setLoadingTasks(false));
      }
    }, [user?.uid])
  );

  // 1. Load tutors from service
  const loadTutors = useCallback(async (subject: string | null) => {
    setTutorError(null);
    try {
      const data = await fetchTutors();
      setTutors(data);
    } catch {
      setTutorError("Unable to load tutors. Please check your connection.");
    } finally {
      setLoadingTutors(false);
      setRefreshing(false);
    }
  }, []);

  // 2. Load saved modules for current user
  const loadSavedModules = useCallback(async () => {
    if (!user?.uid) return;
    setModuleError(null);
    try {
      const data = await getSavedModules(user.uid);
      setSavedModules(data);
    } catch {
      setModuleError("Could not load modules.");
    } finally {
      setLoadingModules(false);
    }
  }, [user?.uid]);

  // Initial and reactive loads
  useEffect(() => {
    setLoadingTutors(true);
    loadTutors(selectedSubject);
  }, [selectedSubject, loadTutors]);

  useEffect(() => {
    if (user?.uid) {
      setLoadingModules(true);
      loadSavedModules();
    }
  }, [user?.uid, loadSavedModules]);

  // Pull to refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTutors(selectedSubject), loadSavedModules()]);
    setRefreshing(false);
  };

  // Toggle filter chip
  const handleChipPress = (subject: string) => {
    setSelectedSubject((prev) => (prev === subject ? null : subject));
  };

  // Handle Search input enter/submit
  const handleSearchSubmit = () => {
    const query = searchQuery.trim();
    if (query) {
      router.push({
        pathname: "/(student)/search",
        params: { q: query },
      } as any);
    } else {
      router.push("/(student)/search" as any);
    }
  };

  // Save Module Modal submit handler
  const handleSaveModule = async () => {
    const upperCode = newCode.trim().toUpperCase();
    const trimmedName = newName.trim();
    const errors: { code?: string; name?: string; general?: string } = {};

    if (!upperCode) {
      errors.code = "Module code is required";
    } else if (upperCode.length < 5 || upperCode.length > 8) {
      errors.code = "Must be between 5 and 8 characters (e.g., IT3010)";
    }

    if (!trimmedName) {
      errors.name = "Module name is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormError(errors);
      return;
    }

    setSavingModule(true);
    setFormError({});
    try {
      await addSavedModule(user?.uid, upperCode, trimmedName);
      setModalVisible(false);
      setNewCode("");
      setNewName("");
      loadSavedModules();
    } catch (err: any) {
      setFormError({ general: err.message || "Failed to save module." });
    } finally {
      setSavingModule(false);
    }
  };

  // Remove saved module handler with confirmation alert
  const handleConfirmRemove = (mod: any) => {
    Alert.alert("Remove Module", `Remove ${mod.moduleCode}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeSavedModule(mod.id);
            loadSavedModules();
          } catch {
            Alert.alert("Error", "Could not remove module.");
          }
        },
      },
    ]);
  };

  // Extract first name for greeting
  const firstName = profile?.name
    ? profile.name.trim().split(" ")[0]
    : "Student";

  return (
    <View style={styles.screenWrapper}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 12, 44),
            paddingBottom: Math.max(insets.bottom + 84, 96),
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* 1. Header greeting area */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>Hi {firstName} 👋</Text>
            <Text style={styles.subGreetingText}>Ready to learn today?</Text>
          </View>
          <Pressable
            onPress={() => router.push("/(student)/profile" as any)}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            style={styles.avatarTouchable}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Avatar name={profile?.name || "Student"} size={48} />
          </Pressable>
        </View>

        {/* 2 & 3. Hero Card with Search */}
        <View style={styles.heroCard}>
          <Text style={styles.heroHeading}>What do you need help with?</Text>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.mutedText}
              style={styles.searchIcon}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Type module name (e.g., IT3010)"
              placeholderTextColor={colors.mutedText}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
              accessibilityLabel="Search modules"
              style={styles.searchInput}
            />
          </View>

          {/* 4. Horizontal filter chips */}
          <View style={styles.chipsRow}>
            {FILTER_SUBJECTS.map((subject) => {
              const isSelected = selectedSubject === subject;
              return (
                <Pressable
                  key={subject}
                  onPress={() => handleChipPress(subject)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${subject}`}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipSelected : styles.chipOutline,
                  ]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected
                        ? styles.chipTextSelected
                        : styles.chipTextOutline,
                    ]}
                  >
                    {subject}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* My Modules Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Modules</Text>
          <Pressable
            onPress={() => {
              setFormError({});
              setModalVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add module"
            style={styles.addButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        {/* Saved Modules Horizontal List / Loading / Empty */}
        {loadingModules ? (
          <View style={styles.modulesLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : moduleError ? (
          <Text style={styles.moduleErrorText}>{moduleError}</Text>
        ) : savedModules.length === 0 ? (
          <View style={styles.emptyModulesCard}>
            <Ionicons
              name="bookmark-outline"
              size={24}
              color={colors.mutedText}
            />
            <Text style={styles.emptyModulesText}>
              No saved modules yet. Tap + Add to save the ones you study.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedModulesRow}
          >
            {savedModules.map((mod) => (
              <View key={mod.id} style={styles.savedModuleChip}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(student)/search",
                      params: { q: mod.moduleCode },
                    } as any)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${mod.moduleCode}`}
                  style={styles.savedModuleContent}
                >
                  <Text style={styles.savedModuleCode}>{mod.moduleCode}</Text>
                  <Text style={styles.savedModuleDot}>·</Text>
                  <Text style={styles.savedModuleName} numberOfLines={1}>
                    {mod.moduleName}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleConfirmRemove(mod)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${mod.moduleCode}`}
                  style={styles.removeIconBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={16} color={colors.mutedText} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {/* 5. Tutors Section */}
        <View style={[styles.sectionHeader, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>Tutors</Text>
          <Pressable
            onPress={() => router.push("/(student)/search" as any)}
            accessibilityRole="button"
            accessibilityLabel="See all tutors"
            style={styles.seeAllTouchable}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.seeAllText}>See All →</Text>
          </Pressable>
        </View>

        {/* Tutors loading / error / empty / list */}
        {loadingTutors ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : tutorError ? (
          <View style={styles.stateCard}>
            <Ionicons
              name="alert-circle-outline"
              size={36}
              color={colors.error}
            />
            <Text style={styles.errorText}>{tutorError}</Text>
            <View style={styles.retryButtonWrapper}>
              <AppButton
                title="Try again"
                onPress={() => loadTutors(selectedSubject)}
                variant="outline"
              />
            </View>
          </View>
        ) : tutors.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons
              name="school-outline"
              size={40}
              color={colors.mutedText}
            />
            <Text style={styles.emptyText}>
              No tutors found for this subject
            </Text>
          </View>
        ) : (
          <View style={styles.tutorsList}>
            {tutors.map((tutor) => (
              <Pressable
                key={tutor.tutorId}
                onPress={() => {
                  // TODO: Navigate to tutor profile screen once implemented
                }}
                style={({ pressed }) => [
                  styles.tutorCard,
                  pressed && styles.tutorCardPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Tutor ${tutor.name}`}
              >
                <Avatar name={tutor.name} size={48} />

                <View style={styles.tutorInfo}>
                  <Text style={styles.tutorName}>{tutor.name}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color={colors.star} />
                    <Text style={styles.ratingText}>
                      {Number(tutor.ratingAvg || 5).toFixed(1)}{" "}
                      <Text style={styles.ratingCount}>
                        ({tutor.ratingCount || 0})
                      </Text>
                    </Text>
                  </View>
                  <Text style={styles.moduleText} numberOfLines={1}>
                    {tutor.moduleCode}
                    {tutor.moduleName ? ` - ${tutor.moduleName}` : ""}
                  </Text>
                </View>

                {tutor.verified ? (
                  <View style={styles.badgeWrapper}>
                    <VerifiedBadge />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        {/* Next Deadline Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Next Deadline</Text>
        </View>

        {loadingTasks ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : nextTask ? (
          <View style={styles.deadlineCard}>
            <View style={styles.deadlineInfo}>
              <Text style={styles.deadlineTitle} numberOfLines={1}>
                {nextTask.title}
              </Text>
              <Text style={styles.deadlineModule}>
                {nextTask.moduleCode} • {formatCountdown(daysUntil(nextTask.dueDate))}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/(student)/planner" as any)}
              accessibilityRole="button"
              accessibilityLabel="View planner"
              style={styles.viewPlannerButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.viewPlannerText}>View planner</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.deadlineEmptyCard}>
            <Text style={styles.emptyModulesText}>No deadlines yet.</Text>
            <Pressable
              onPress={() => router.push("/(student)/planner" as any)}
              accessibilityRole="button"
              accessibilityLabel="Add deadline"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.viewPlannerText}>Add one</Text>
            </Pressable>
          </View>
        )}

        {/* 6. Upcoming Bookings Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
        </View>
        {/* TODO: Member 2's bookings collection will feed this later */}
        <View style={styles.bookingPlaceholderCard}>
          <Ionicons
            name="calendar-outline"
            size={32}
            color={colors.mutedText}
            style={styles.calendarIcon}
          />
          <Text style={styles.bookingPlaceholderText}>
            No upcoming bookings yet
          </Text>
        </View>

        {/* Add Module Modal */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add My Module</Text>

              {formError.general ? (
                <Text style={styles.generalErrorText}>{formError.general}</Text>
              ) : null}

              <AppInput
                label="Module Code"
                value={newCode}
                onChangeText={(txt) => {
                  setNewCode(txt.toUpperCase());
                  if (formError.code)
                    setFormError((e) => ({ ...e, code: undefined }));
                }}
                placeholder="e.g. IT3010"
                icon="book-outline"
                returnKeyType="next"
                error={formError.code}
              />

              <AppInput
                label="Module Name"
                value={newName}
                onChangeText={(txt) => {
                  setNewName(txt);
                  if (formError.name)
                    setFormError((e) => ({ ...e, name: undefined }));
                }}
                placeholder="e.g. Data Structures"
                icon="document-text-outline"
                returnKeyType="done"
                onSubmitEditing={handleSaveModule}
                error={formError.name}
              />

              <View style={styles.modalActions}>
                <View style={styles.modalButtonFlex}>
                  <AppButton
                    title="Cancel"
                    onPress={() => {
                      setModalVisible(false);
                      setNewCode("");
                      setNewName("");
                      setFormError({});
                    }}
                    variant="outline"
                    disabled={savingModule}
                  />
                </View>
                <View style={styles.modalButtonFlex}>
                  <AppButton
                    title="Save"
                    onPress={handleSaveModule}
                    loading={savingModule}
                    disabled={savingModule}
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  subGreetingText: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
  avatarTouchable: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20,
  },
  heroHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: colors.card,
  },
  chipTextOutline: {
    color: colors.text,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  seeAllTouchable: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minHeight: 48,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  modulesLoading: {
    paddingVertical: 14,
    alignItems: "center",
  },
  moduleErrorText: {
    fontSize: 13,
    color: colors.error,
    marginBottom: 10,
  },
  emptyModulesCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  emptyModulesText: {
    flex: 1,
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
  },
  savedModulesRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  savedModuleChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  savedModuleContent: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
  },
  savedModuleCode: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  savedModuleDot: {
    marginHorizontal: 4,
    color: colors.mutedText,
  },
  savedModuleName: {
    fontSize: 13,
    color: colors.text,
    maxWidth: 120,
  },
  removeIconBtn: {
    marginLeft: 8,
    padding: 6,
    minWidth: 32,
    minHeight: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  centerContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  stateCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 8,
    textAlign: "center",
  },
  retryButtonWrapper: {
    marginTop: 12,
    width: 140,
  },
  tutorsList: {
    gap: 10,
    marginBottom: 24,
  },
  tutorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    minHeight: 64,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tutorCardPressed: {
    opacity: 0.9,
  },
  tutorInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  tutorName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  ratingCount: {
    color: colors.mutedText,
    fontWeight: "400",
  },
  moduleText: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  badgeWrapper: {
    alignSelf: "center",
  },
  bookingPlaceholderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    minHeight: 56,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 24,
  },
  calendarIcon: {
    marginRight: 12,
  },
  bookingPlaceholderText: {
    fontSize: 14,
    color: colors.mutedText,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 16,
    textAlign: "center",
  },
  generalErrorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: "center",
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButtonFlex: {
    flex: 1,
  },
  deadlineCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    justifyContent: "space-between",
  },
  deadlineInfo: {
    flex: 1,
    marginRight: 12,
  },
  deadlineTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  deadlineModule: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "500",
    marginTop: 4,
  },
  viewPlannerButton: {
    backgroundColor: colors.lightGreen,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  viewPlannerText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  deadlineEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    justifyContent: "space-between",
  },
});
