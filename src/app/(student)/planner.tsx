import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { AppButton } from '../../components/ui/AppButton';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  daysUntil,
  deleteStudyTask,
  formatCountdown,
  getStudyTasks,
  setTaskStatus,
} from '../../services/studyTaskService';

type FilterType = 'all' | 'upcoming' | 'done';

interface StudyTask {
  id: string;
  studentId: string;
  title: string;
  moduleCode: string;
  type: 'assignment' | 'exam' | 'quiz' | 'project';
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  status: 'todo' | 'done';
  createdAt?: any;
  updatedAt?: any;
}

export default function StudyPlannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useCurrentUser();

  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Load study tasks from Firestore
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

  // Status toggle handler
  const handleToggleStatus = async (task: StudyTask) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      // Optimistic state update
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
      );
      await setTaskStatus(task.id, nextStatus);
    } catch {
      Alert.alert('Error', 'Failed to update task status. Please try again.');
      loadTasks();
    }
  };

  // Delete task handler
  const handleDeleteTask = (task: StudyTask) => {
    Alert.alert(
      'Delete Task',
      `Are you sure you want to delete "${task.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setTasks((prev) => prev.filter((t) => t.id !== task.id));
              await deleteStudyTask(task.id);
            } catch {
              Alert.alert('Error', 'Failed to delete task. Please try again.');
              loadTasks();
            }
          },
        },
      ]
    );
  };

  // Floating button action
  const handleOpenAddForm = () => {
    // TODO: Open add task form (Task B)
    Alert.alert(
      'Add Deadline',
      'The deadline creation form will open here in Task B.'
    );
  };

  // Summary counts
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

  // Date formatting helper
  const formatDueDate = (dateStr: string) => {
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
  const getTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
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
  const getPriorityColor = (priority: string) => {
    switch (priority) {
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
          {/* 2. Summary Strip (3 counts) */}
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
                    {/* Top Row: Priority Dot, Module Code Chip, Type Icon & Badge, Checkbox */}
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

                      {/* Right Header: Toggle Done Button & Delete */}
                      <View style={styles.cardHeaderRight}>
                        <Pressable
                          onPress={() => handleToggleStatus(task)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Mark as ${isDone ? 'todo' : 'done'}`}
                          style={[
                            styles.checkbox,
                            isDone && styles.checkboxDone,
                          ]}
                        >
                          {isDone ? (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          ) : null}
                        </Pressable>

                        <Pressable
                          onPress={() => handleDeleteTask(task)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Delete task"
                          style={styles.deleteButton}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={colors.mutedText}
                          />
                        </Pressable>
                      </View>
                    </View>

                    {/* Task Title */}
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

                    {/* Footer Row: Formatted Due Date + Countdown */}
                    <View style={styles.cardFooter}>
                      <View style={styles.dateRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={15}
                          color={colors.mutedText}
                        />
                        <Text style={styles.dateText}>
                          {formatDueDate(task.dueDate)}
                        </Text>
                      </View>

                      {/* Countdown badge: Red when overdue, amber within 3 days */}
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
        onPress={handleOpenAddForm}
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
    shadowColor: '#000',
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
    color: '#FFFFFF',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  taskCardDone: {
    backgroundColor: '#FAFDF9',
    borderColor: '#E5EDE5',
    opacity: 0.85,
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  checkboxDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  deleteButton: {
    padding: 4,
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
    marginBottom: 10,
  },
  taskNotesDone: {
    textDecorationLine: 'line-through',
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
    backgroundColor: '#FEE2E2',
  },
  countdownBadgeUrgent: {
    backgroundColor: '#FEF3C7',
  },
  countdownBadgeDone: {
    backgroundColor: '#F3F4F6',
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
    color: '#B45309',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
});
