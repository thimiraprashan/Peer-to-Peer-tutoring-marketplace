import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { AppButton } from '../../components/ui/AppButton';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  addStudyTask,
  daysUntil,
  deleteStudyTask,
  formatCountdown,
  getStudyTasks,
  setTaskStatus,
  updateStudyTask,
} from '../../services/studyTaskService';

type FilterType = 'all' | 'upcoming' | 'done';
type TaskType = 'assignment' | 'exam' | 'quiz' | 'project';
type TaskPriority = 'low' | 'medium' | 'high';

interface StudyTask {
  id: string;
  studentId: string;
  title: string;
  moduleCode: string;
  type: TaskType;
  dueDate: string;
  priority: TaskPriority;
  notes?: string;
  status: 'todo' | 'done';
  createdAt?: any;
  updatedAt?: any;
}

interface FormErrors {
  title?: string;
  moduleCode?: string;
  type?: string;
  dueDate?: string;
  priority?: string;
}

const TASK_TYPES: Array<{
  id: TaskType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'assignment', label: 'Assignment', icon: 'document-text-outline' },
  { id: 'exam', label: 'Exam', icon: 'school-outline' },
  { id: 'quiz', label: 'Quiz', icon: 'help-circle-outline' },
  { id: 'project', label: 'Project', icon: 'folder-outline' },
];

const TASK_PRIORITIES: Array<{
  id: TaskPriority;
  label: string;
  color: string;
}> = [
  { id: 'low', label: 'Low', color: colors.priorityLow },
  { id: 'medium', label: 'Medium', color: colors.priorityMedium },
  { id: 'high', label: 'High', color: colors.priorityHigh },
];

export default function StudyPlannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useCurrentUser();

  // Screen state
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Modal & Form state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [moduleCode, setModuleCode] = useState('');
  const [type, setType] = useState<TaskType>('assignment');
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Date conversion helpers
  const formatDateToYYYYMMDD = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const parseYYYYMMDDToDate = (dateStr?: string): Date => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date();
    return new Date(y, m - 1, d);
  };

  const formatDisplayDate = (date: Date): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Load study tasks from Firestore via service
  const loadTasks = useCallback(async () => {
    if (!user?.uid) return;
    setError(null);
    try {
      const data = await getStudyTasks(user.uid);
      setTasks(data as StudyTask[]);
    } catch (err: any) {
      setError(err?.message || 'Unable to load study tasks. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      setLoading(true);
      loadTasks();
    }
  }, [user?.uid, loadTasks]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadTasks();
  }, [loadTasks]);

  // Round checkbox status toggle (optimistic update; revert with an Alert on failure)
  const handleToggleStatus = async (task: StudyTask) => {
    const previousStatus = task.status;
    const nextStatus = previousStatus === 'done' ? 'todo' : 'done';

    // 1. Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    try {
      await setTaskStatus(task.id, nextStatus);
    } catch {
      // 2. Revert with an Alert on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: previousStatus } : t))
      );
      Alert.alert(
        'Update Failed',
        'Failed to update status. Please try again.'
      );
    }
  };

  // Delete task handler (asks "Delete this deadline?" with an Alert, then calls deleteStudyTask and reloads)
  const handleDeleteTask = (task: StudyTask) => {
    Alert.alert(
      'Delete Deadline',
      'Delete this deadline?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStudyTask(task.id);
              await loadTasks();
            } catch {
              Alert.alert('Error', 'Failed to delete task. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Open Modal Empty (Add)
  const handleOpenAddModal = () => {
    setEditingTaskId(null);
    setTitle('');
    setModuleCode('');
    setType('assignment');
    setDueDate(new Date());
    setPriority('medium');
    setNotes('');
    setErrors({});
    setShowDatePicker(false);
    setModalVisible(true);
  };

  // Open Modal Pre-filled (Edit)
  const handleOpenEditModal = (task: StudyTask) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setModuleCode(task.moduleCode);
    setType(task.type);
    setDueDate(parseYYYYMMDDToDate(task.dueDate));
    setPriority(task.priority);
    setNotes(task.notes || '');
    setErrors({});
    setShowDatePicker(false);
    setModalVisible(true);
  };

  // Close Modal
  const handleCloseModal = () => {
    if (saving) return;
    setModalVisible(false);
    setShowDatePicker(false);
  };

  // Validate form fields inline
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      newErrors.title = 'Title is required.';
    } else if (trimmedTitle.length < 3 || trimmedTitle.length > 80) {
      newErrors.title = 'Title must be between 3 and 80 characters.';
    }

    const trimmedModule = moduleCode.trim();
    if (!trimmedModule) {
      newErrors.moduleCode = 'Module code is required.';
    } else if (trimmedModule.length < 5 || trimmedModule.length > 8) {
      newErrors.moduleCode = 'Module code must be between 5 and 8 characters.';
    }

    if (!type || !['assignment', 'exam', 'quiz', 'project'].includes(type)) {
      newErrors.type = 'Please select a valid task type.';
    }

    const formattedDate = formatDateToYYYYMMDD(dueDate);
    if (daysUntil(formattedDate) < 0) {
      newErrors.dueDate = 'Due date must be today or later.';
    }

    if (!priority || !['low', 'medium', 'high'].includes(priority)) {
      newErrors.priority = 'Please select a priority.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save Task (Add or Update)
  const handleSave = async () => {
    if (!validateForm()) return;

    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to save tasks.');
      return;
    }

    setSaving(true);
    try {
      const dueDateStr = formatDateToYYYYMMDD(dueDate);
      const taskPayload = {
        title: title.trim(),
        moduleCode: moduleCode.trim().toUpperCase(),
        type,
        dueDate: dueDateStr,
        priority,
        notes: notes.trim(),
      };

      if (editingTaskId) {
        await updateStudyTask(editingTaskId, taskPayload);
      } else {
        const created = await addStudyTask(user.uid, taskPayload);
      }

      await loadTasks();
      setModalVisible(false);

      Alert.alert(
        'Success',
        editingTaskId
          ? 'Study task updated successfully.'
          : 'Study task added successfully.'
      );
    } catch (err: any) {
      console.error('Error saving study task:', err);
      Alert.alert('Save Failed', err?.message || 'Could not save study task.');
    } finally {
      setSaving(false);
    }
  };

  // Date change handler for DateTimePicker
  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setDueDate(selectedDate);
      if (errors.dueDate) {
        setErrors((prev) => ({ ...prev, dueDate: undefined }));
      }
    }
  };

  // Summary counts (refreshed automatically after every change to tasks)
  const summaryCounts = useMemo(() => {
    let dueIn7Days = 0;
    let overdue = 0;
    let done = 0;

    tasks.forEach((t) => {
      if (t.status === 'done') {
        done += 1;
      } else {
        const days = daysUntil(t.dueDate);
        if (days < 0) {
          overdue += 1;
        } else if (days <= 7) {
          dueIn7Days += 1;
        }
      }
    });

    return { dueIn7Days, overdue, done };
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    if (activeFilter === 'upcoming') {
      return tasks.filter((t) => t.status !== 'done');
    }
    if (activeFilter === 'done') {
      return tasks.filter((t) => t.status === 'done');
    }
    return tasks;
  }, [tasks, activeFilter]);

  // Card date formatting helper
  const formatCardDueDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12) return dateStr;
    return `${d} ${months[m - 1]} ${y}`;
  };

  // Type icon helper
  const getTypeIcon = (typeKey: string): keyof typeof Ionicons.glyphMap => {
    switch (typeKey) {
      case 'exam':
        return 'school-outline';
      case 'quiz':
        return 'help-circle-outline';
      case 'project':
        return 'folder-outline';
      case 'assignment':
      default:
        return 'document-text-outline';
    }
  };

  // Priority color helper
  const getPriorityColor = (priorityKey: string) => {
    switch (priorityKey) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
      default:
        return '#10B981';
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <StatusBar style="dark" />

      {/* 1. Mint Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top + 8, 44) },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <Text style={styles.headerTitle}>Study Planner</Text>

        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Main Content Area */}
      {loading && !refreshing ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your study planner...</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <View style={styles.errorButtonWrapper}>
            <AppButton title="Try again" onPress={loadTasks} />
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 90, 100) },
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
          {/* 2. Summary Strip (3 counts refreshed after every change) */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryCount}>
                {summaryCounts.dueIn7Days}
              </Text>
              <Text style={styles.summaryLabel}>Due in 7 days</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text
                style={[
                  styles.summaryCount,
                  summaryCounts.overdue > 0 && styles.summaryCountOverdue,
                ]}
              >
                {summaryCounts.overdue}
              </Text>
              <Text style={styles.summaryLabel}>Overdue</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryCount, styles.summaryCountDone]}>
                {summaryCounts.done}
              </Text>
              <Text style={styles.summaryLabel}>Done</Text>
            </View>
          </View>

          {/* 3. Filter Chips: All / Upcoming / Done */}
          <View style={styles.filterRow}>
            {(['all', 'upcoming', 'done'] as FilterType[]).map((filter) => {
              const isSelected = activeFilter === filter;
              const label =
                filter === 'all'
                  ? 'All'
                  : filter === 'upcoming'
                  ? 'Upcoming'
                  : 'Done';

              return (
                <Pressable
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter ${label}`}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 4. Task Cards or Empty State */}
          {filteredTasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons
                  name="calendar-outline"
                  size={52}
                  color={colors.mutedText}
                />
              </View>
              <Text style={styles.emptyText}>
                No deadlines yet. Tap + to add your first exam or assignment.
              </Text>
            </View>
          ) : (
            <View style={styles.taskList}>
              {filteredTasks.map((task) => {
                const isDone = task.status === 'done';
                const days = daysUntil(task.dueDate);
                const isOverdue = !isDone && days < 0;
                const isUrgent = !isDone && days >= 0 && days <= 3;
                const countdownText = formatCountdown(days);

                return (
                  <View
                    key={task.id}
                    style={[
                      styles.taskCard,
                      isDone && styles.taskCardDone,
                    ]}
                  >
                    {/* Top Row: Priority Dot, Module Code Chip, Type Icon & Badge, Checkbox, Edit, Delete */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        {/* Priority Dot */}
                        <View
                          style={[
                            styles.priorityDot,
                            { backgroundColor: getPriorityColor(task.priority) },
                          ]}
                          accessibilityLabel={`Priority: ${task.priority}`}
                        />

                        {/* Module Code Chip */}
                        <View style={styles.moduleChip}>
                          <Text style={styles.moduleChipText}>
                            {task.moduleCode}
                          </Text>
                        </View>

                        {/* Type Badge with Icon */}
                        <View style={styles.typeBadge}>
                          <Ionicons
                            name={getTypeIcon(task.type)}
                            size={14}
                            color={colors.primary}
                          />
                          <Text style={styles.typeBadgeText}>
                            {task.type.charAt(0).toUpperCase() +
                              task.type.slice(1)}
                          </Text>
                        </View>
                      </View>

                      {/* Right Header: Round Checkbox, Edit Pencil, Delete */}
                      <View style={styles.cardHeaderRight}>
                        {/* Round Checkbox */}
                        <Pressable
                          onPress={() => handleToggleStatus(task)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Mark as ${isDone ? 'todo' : 'done'}`}
                          style={[
                            styles.roundCheckbox,
                            isDone && styles.roundCheckboxDone,
                          ]}
                        >
                          {isDone ? (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          ) : null}
                        </Pressable>

                        {/* Edit Pencil Button */}
                        <Pressable
                          onPress={() => handleOpenEditModal(task)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          accessibilityRole="button"
                          accessibilityLabel="Edit task"
                          style={styles.cardActionButton}
                        >
                          <Ionicons
                            name="pencil-outline"
                            size={17}
                            color={colors.primary}
                          />
                        </Pressable>

                        {/* Delete Trash Button */}
                        <Pressable
                          onPress={() => handleDeleteTask(task)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          accessibilityRole="button"
                          accessibilityLabel="Delete deadline"
                          style={styles.cardActionButton}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={17}
                            color={colors.mutedText}
                          />
                        </Pressable>
                      </View>
                    </View>

                    {/* Task Title (Strikethrough and muted when done) */}
                    <Text
                      style={[
                        styles.taskTitle,
                        isDone && styles.taskTitleDone,
                      ]}
                      numberOfLines={2}
                    >
                      {task.title}
                    </Text>

                    {/* Optional Notes */}
                    {task.notes ? (
                      <Text
                        style={[
                          styles.taskNotes,
                          isDone && styles.taskNotesDone,
                        ]}
                        numberOfLines={2}
                      >
                        {task.notes}
                      </Text>
                    ) : null}

                    {/* "Find a tutor" outline button on exam and assignment cards that are not done */}
                    {!isDone &&
                      (task.type === 'exam' || task.type === 'assignment') && (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: '/(student)/search',
                              params: { q: task.moduleCode },
                            } as any)
                          }
                          style={({ pressed }) => [
                            styles.findTutorButton,
                            pressed && styles.findTutorButtonPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Find a tutor for ${task.moduleCode}`}
                        >
                          <Ionicons
                            name="search-outline"
                            size={14}
                            color={colors.primary}
                          />
                          <Text style={styles.findTutorButtonText}>
                            Find a tutor
                          </Text>
                        </Pressable>
                      )}

                    {/* Footer Row: Formatted Due Date + Countdown */}
                    <View style={styles.cardFooter}>
                      <View style={styles.dateRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={15}
                          color={colors.mutedText}
                        />
                        <Text style={styles.dateText}>
                          {formatCardDueDate(task.dueDate)}
                        </Text>
                      </View>

                      {/* Countdown badge: Red when overdue, amber within 3 days, muted when completed */}
                      <View
                        style={[
                          styles.countdownBadge,
                          isOverdue && styles.countdownBadgeOverdue,
                          isUrgent && styles.countdownBadgeUrgent,
                          isDone && styles.countdownBadgeDone,
                        ]}
                      >
                        <Ionicons
                          name={
                            isDone
                              ? 'checkmark-circle-outline'
                              : isOverdue
                              ? 'alert-circle-outline'
                              : isUrgent
                              ? 'time-outline'
                              : 'calendar-outline'
                          }
                          size={13}
                          color={
                            isDone
                              ? colors.mutedText
                              : isOverdue
                              ? colors.error
                              : isUrgent
                              ? '#B45309'
                              : colors.primary
                          }
                        />
                        <Text
                          style={[
                            styles.countdownText,
                            isOverdue && styles.countdownTextOverdue,
                            isUrgent && styles.countdownTextUrgent,
                            isDone && styles.countdownTextDone,
                          ]}
                        >
                          {isDone ? 'Completed' : countdownText}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* 5. Floating Green "+" Button (48px+) */}
      <Pressable
        onPress={handleOpenAddModal}
        accessibilityRole="button"
        accessibilityLabel="Add study task"
        style={({ pressed }) => [
          styles.fab,
          { bottom: Math.max(insets.bottom + 24, 28) },
          pressed && styles.fabPressed,
        ]}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </Pressable>

      {/* 6. Bottom-sheet Modal for Adding and Editing Study Task */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={handleCloseModal}
            accessibilityRole="button"
            accessibilityLabel="Close dialog overlay"
          />

          <View style={styles.modalSheet}>
            {/* Drag Handle Indicator */}
            <View style={styles.modalHandleContainer}>
              <View style={styles.modalHandle} />
            </View>

            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingTaskId ? 'Edit Study Task' : 'New Study Task'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editingTaskId
                    ? 'Update your deadline details'
                    : 'Add an exam or assignment to stay on track'}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseModal}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            {/* Form Fields ScrollView */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalFormContent}
            >
              {/* Field 1: Title */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Title *</Text>
                <TextInput
                  value={title}
                  onChangeText={(val) => {
                    setTitle(val);
                    if (errors.title) {
                      setErrors((prev) => ({ ...prev, title: undefined }));
                    }
                  }}
                  placeholder="e.g., Final Research Project"
                  placeholderTextColor={colors.mutedText}
                  accessibilityLabel="Task title"
                  style={[
                    styles.textInput,
                    errors.title ? styles.inputErrorBorder : null,
                  ]}
                />
                {errors.title ? (
                  <Text style={styles.inlineError}>{errors.title}</Text>
                ) : null}
              </View>

              {/* Field 2: Module Code (Uppercase) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Module Code *</Text>
                <TextInput
                  value={moduleCode}
                  onChangeText={(val) => {
                    setModuleCode(val.toUpperCase());
                    if (errors.moduleCode) {
                      setErrors((prev) => ({ ...prev, moduleCode: undefined }));
                    }
                  }}
                  placeholder="e.g., IT3010"
                  placeholderTextColor={colors.mutedText}
                  autoCapitalize="characters"
                  maxLength={8}
                  accessibilityLabel="Module code"
                  style={[
                    styles.textInput,
                    errors.moduleCode ? styles.inputErrorBorder : null,
                  ]}
                />
                {errors.moduleCode ? (
                  <Text style={styles.inlineError}>{errors.moduleCode}</Text>
                ) : null}
              </View>

              {/* Field 3: Type (4 selectable chips with icons) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Type *</Text>
                <View style={styles.chipsGrid}>
                  {TASK_TYPES.map((t) => {
                    const isSelected = type === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => {
                          setType(t.id);
                          if (errors.type) {
                            setErrors((prev) => ({ ...prev, type: undefined }));
                          }
                        }}
                        style={[
                          styles.typeChip,
                          isSelected && styles.typeChipSelected,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${t.label} type`}
                      >
                        <Ionicons
                          name={t.icon}
                          size={16}
                          color={isSelected ? '#FFFFFF' : colors.primary}
                        />
                        <Text
                          style={[
                            styles.typeChipText,
                            isSelected && styles.typeChipTextSelected,
                          ]}
                        >
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.type ? (
                  <Text style={styles.inlineError}>{errors.type}</Text>
                ) : null}
              </View>

              {/* Field 4: Due Date */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Due Date *</Text>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={[
                    styles.dateTrigger,
                    errors.dueDate ? styles.inputErrorBorder : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Select due date"
                >
                  <View style={styles.dateTriggerLeft}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.dateTriggerText}>
                      {formatDisplayDate(dueDate)}
                    </Text>
                  </View>
                  <View style={styles.changeBadge}>
                    <Text style={styles.changeBadgeText}>Change</Text>
                  </View>
                </Pressable>
                {errors.dueDate ? (
                  <Text style={styles.inlineError}>{errors.dueDate}</Text>
                ) : null}

                {/* DateTimePicker Display */}
                {showDatePicker && Platform.OS === 'ios' && (
                  <View style={styles.iosPickerBox}>
                    <DateTimePicker
                      value={dueDate}
                      mode="date"
                      display="spinner"
                      minimumDate={todayMidnight}
                      onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                        if (selected) {
                          setDueDate(selected);
                          if (errors.dueDate) {
                            setErrors((prev) => ({ ...prev, dueDate: undefined }));
                          }
                        }
                      }}
                      textColor={colors.text}
                    />
                    <Pressable
                      style={styles.iosPickerDone}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={styles.iosPickerDoneText}>Done</Text>
                    </Pressable>
                  </View>
                )}

                {showDatePicker && Platform.OS !== 'ios' && (
                  <DateTimePicker
                    value={dueDate}
                    mode="date"
                    display="default"
                    minimumDate={todayMidnight}
                    onChange={onDateChange}
                  />
                )}
              </View>

              {/* Field 5: Priority (3 chips: low, medium, high) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Priority *</Text>
                <View style={styles.priorityRow}>
                  {TASK_PRIORITIES.map((p) => {
                    const isSelected = priority === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setPriority(p.id);
                          if (errors.priority) {
                            setErrors((prev) => ({ ...prev, priority: undefined }));
                          }
                        }}
                        style={[
                          styles.priorityChip,
                          isSelected && styles.priorityChipSelected,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${p.label} priority`}
                      >
                        <View
                          style={[
                            styles.priorityChipDot,
                            { backgroundColor: p.color },
                          ]}
                        />
                        <Text
                          style={[
                            styles.priorityChipText,
                            isSelected && styles.priorityChipTextSelected,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.priority ? (
                  <Text style={styles.inlineError}>{errors.priority}</Text>
                ) : null}
              </View>

              {/* Field 6: Notes (multiline, optional) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes (Optional)</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add details, chapters, or preparation notes..."
                  placeholderTextColor={colors.mutedText}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  accessibilityLabel="Notes"
                  style={styles.notesInput}
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View
              style={[
                styles.modalFooter,
                { paddingBottom: Math.max(insets.bottom + 12, 16) },
              ]}
            >
              <AppButton
                title={editingTaskId ? 'Save Changes' : 'Create Task'}
                onPress={handleSave}
                loading={saving}
                disabled={saving}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.lightGreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  headerRightPlaceholder: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.mutedText,
  },
  errorIconContainer: {
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButtonWrapper: {
    width: 160,
  },
  // Summary Strip
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  summaryCountOverdue: {
    color: colors.error,
  },
  summaryCountDone: {
    color: colors.primary,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedText,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  // Filter Chips
  filterRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 32,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  // Task List & Cards
  taskList: {
    gap: 12,
  },
  taskCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  taskCardDone: {
    backgroundColor: colors.taskDoneBg,
    borderColor: colors.taskDoneBorder,
    opacity: 0.75,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardActionButton: {
    padding: 4,
    minWidth: 28,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  moduleChip: {
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  moduleChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  // Round Checkbox
  roundCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  roundCheckboxDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
    marginBottom: 6,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.mutedText,
  },
  taskNotes: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
    marginBottom: 6,
  },
  taskNotesDone: {
    textDecorationLine: 'line-through',
    color: colors.taskDoneNotes,
  },
  // Find a tutor outline button
  findTutorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
    marginTop: 8,
    marginBottom: 4,
  },
  findTutorButtonPressed: {
    backgroundColor: colors.lightGreen,
    opacity: 0.85,
  },
  findTutorButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedText,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.lightGreen,
    gap: 5,
  },
  countdownBadgeOverdue: {
    backgroundColor: colors.badgeOverdueBg,
  },
  countdownBadgeUrgent: {
    backgroundColor: colors.badgeUrgentBg,
  },
  countdownBadgeDone: {
    backgroundColor: colors.badgeDoneBg,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  countdownTextOverdue: {
    color: colors.error,
  },
  countdownTextUrgent: {
    color: colors.badgeUrgentText,
  },
  countdownTextDone: {
    color: colors.mutedText,
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  // Modal & Bottom Sheet
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHandleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: colors.background,
  },
  modalFormContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: colors.text,
  },
  inputErrorBorder: {
    borderColor: colors.error,
  },
  inlineError: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    fontWeight: '500',
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  typeChipTextSelected: {
    color: colors.white,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 48,
  },
  dateTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateTriggerText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  changeBadge: {
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  iosPickerBox: {
    marginTop: 10,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  iosPickerDone: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  iosPickerDoneText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.lightGreen,
  },
  priorityChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  priorityChipTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    minHeight: 76,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
});
