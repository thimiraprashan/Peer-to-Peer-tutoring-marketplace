import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/ui/AppButton';
import {
    deleteReport,
    getAllReports,
    Report,
    ReportStatus,
    updateReport,
} from '../../services/reportsService';
import { colors } from '../../theme/colors';

export default function AdminReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected report for detail modal
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [actionTakenInput, setActionTakenInput] = useState<string>('');

  // Load reports
  const loadReports = useCallback(async () => {
    try {
      setError(null);
      const fetchedReports = await getAllReports();
      setReports(fetchedReports);
    } catch (err: any) {
      console.error('Failed to load reports:', err);
      setError(err?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReports();
  };

  const openReportDetail = (report: Report) => {
    setSelectedReport(report);
    setActionTakenInput(report.actionTaken || '');
    setDetailModalVisible(true);
  };

  const closeReportDetail = () => {
    setDetailModalVisible(false);
    setSelectedReport(null);
    setActionTakenInput('');
  };

  const handleUpdateStatus = async (newStatus: ReportStatus) => {
    if (!selectedReport) return;

    setUpdating(true);
    try {
      await updateReport(selectedReport.id, { status: newStatus });
      Alert.alert('Success', `Report status updated to "${newStatus}"`);
      
      // Update local state
      setReports((prev) =>
        prev.map((r) =>
          r.id === selectedReport.id ? { ...r, status: newStatus } : r
        )
      );
      setSelectedReport({ ...selectedReport, status: newStatus });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateActionTaken = async () => {
    if (!selectedReport) return;

    setUpdating(true);
    try {
      await updateReport(selectedReport.id, {
        actionTaken: actionTakenInput.trim(),
      });
      Alert.alert('Success', 'Action taken has been updated');

      // Update local state
      setReports((prev) =>
        prev.map((r) =>
          r.id === selectedReport.id
            ? { ...r, actionTaken: actionTakenInput.trim() }
            : r
        )
      );
      setSelectedReport({
        ...selectedReport,
        actionTaken: actionTakenInput.trim(),
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update action taken');
    } finally {
      setUpdating(false);
    }
  };

  const handleArchiveReport = async () => {
    if (!selectedReport) return;

    if (selectedReport.status !== 'resolved') {
      Alert.alert(
        'Cannot Archive',
        'Only resolved reports can be archived. Please mark this report as resolved first.'
      );
      return;
    }

    Alert.alert(
      'Archive Report',
      'Are you sure you want to archive this report? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              await deleteReport(selectedReport.id);
              Alert.alert('Success', 'Report has been archived');

              // Remove from local state
              setReports((prev) => prev.filter((r) => r.id !== selectedReport.id));
              closeReportDetail();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to archive report');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'no-show':
        return 'No-Show';
      case 'misconduct':
        return 'Misconduct';
      case 'other':
        return 'Other';
      default:
        return type;
    }
  };

  const getTypeIcon = (type: string): any => {
    switch (type) {
      case 'no-show':
        return 'time-outline';
      case 'misconduct':
        return 'warning-outline';
      case 'other':
        return 'help-circle-outline';
      default:
        return 'flag-outline';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return { bg: '#FEE2E2', text: '#DC2626' };
      case 'medium':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'low':
        return { bg: '#DBEAFE', text: '#2563EB' };
      default:
        return { bg: colors.lightGreen, text: colors.primary };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return { bg: '#FEE2E2', text: '#DC2626' };
      case 'reviewing':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'resolved':
        return { bg: '#D1FAE5', text: '#059669' };
      default:
        return { bg: colors.lightGreen, text: colors.primary };
    }
  };

  const renderReportCard = (report: Report) => {
    const severityColors = getSeverityColor(report.severity);
    const statusColors = getStatusColor(report.status);

    return (
      <Pressable
        key={report.id}
        style={styles.reportCard}
        onPress={() => openReportDetail(report)}
        accessibilityRole="button"
        accessibilityLabel={`View ${report.type} report`}
      >
        <View style={styles.reportHeader}>
          <View style={styles.reportTypeRow}>
            <View style={[styles.typeIcon, { backgroundColor: severityColors.bg }]}>
              <Ionicons
                name={getTypeIcon(report.type)}
                size={18}
                color={severityColors.text}
              />
            </View>
            <Text style={styles.reportType}>{getTypeLabel(report.type)}</Text>
          </View>

          <View style={styles.reportBadges}>
            <View
              style={[
                styles.badge,
                { backgroundColor: severityColors.bg },
              ]}
            >
              <Text style={[styles.badgeText, { color: severityColors.text }]}>
                {report.severity.toUpperCase()}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: statusColors.bg },
              ]}
            >
              <Text style={[styles.badgeText, { color: statusColors.text }]}>
                {report.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.reportDescription} numberOfLines={2}>
          {report.description}
        </Text>

        <View style={styles.reportFooter}>
          <View style={styles.reportMeta}>
            <Ionicons name="person-outline" size={14} color={colors.mutedText} />
            <Text style={styles.reportMetaText}>
              Reported: {report.reportedUserId.substring(0, 8)}...
            </Text>
          </View>
          {report.createdAt && (
            <Text style={styles.reportTime}>
              {new Date(report.createdAt).toLocaleDateString()}
            </Text>
          )}
        </View>

        {report.actionTaken && (
          <View style={styles.actionTakenPreview}>
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text style={styles.actionTakenText} numberOfLines={1}>
              {report.actionTaken}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.screenWrapper}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 12, 44),
            paddingBottom: Math.max(insets.bottom + 24, 40),
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>Reports</Text>
              <Text style={styles.subtitle}>
                {reports.length} {reports.length === 1 ? 'report' : 'reports'} total
              </Text>
            </View>
          </View>
        </View>

        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading reports...</Text>
          </View>
        )}

        {/* Error State */}
        {!loading && error && (
          <View style={styles.centerContainer}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle" size={48} color={colors.error} />
            </View>
            <Text style={styles.errorTitle}>Failed to Load Reports</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <AppButton
              title="Try Again"
              onPress={loadReports}
              variant="outline"
            />
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && reports.length === 0 && (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="flag-outline" size={48} color={colors.mutedText} />
            </View>
            <Text style={styles.emptyTitle}>No Reports Yet</Text>
            <Text style={styles.emptyMessage}>
              All reports will appear here when users submit them
            </Text>
          </View>
        )}

        {/* Reports List */}
        {!loading && !error && reports.length > 0 && (
          <View style={styles.reportsList}>
            {reports.map((report) => renderReportCard(report))}
          </View>
        )}
      </ScrollView>

      {/* Report Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeReportDetail}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={closeReportDetail}
          />
          <View style={styles.modalContainer}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedReport && (
                <>
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Report Details</Text>
                    <Pressable
                      onPress={closeReportDetail}
                      style={styles.modalCloseButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={24} color={colors.text} />
                    </Pressable>
                  </View>

                  {/* Report Info */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <View style={styles.detailRow}>
                      <Ionicons
                        name={getTypeIcon(selectedReport.type)}
                        size={20}
                        color={colors.text}
                      />
                      <Text style={styles.detailValue}>
                        {getTypeLabel(selectedReport.type)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Severity</Text>
                    <View
                      style={[
                        styles.badge,
                        styles.badgeLarge,
                        {
                          backgroundColor: getSeverityColor(selectedReport.severity).bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          {
                            color: getSeverityColor(selectedReport.severity).text,
                          },
                        ]}
                      >
                        {selectedReport.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={styles.statusButtons}>
                      {(['open', 'reviewing', 'resolved'] as ReportStatus[]).map(
                        (status) => {
                          const isActive = selectedReport.status === status;
                          const statusColors = getStatusColor(status);
                          return (
                            <Pressable
                              key={status}
                              style={[
                                styles.statusButton,
                                isActive && {
                                  backgroundColor: statusColors.bg,
                                  borderColor: statusColors.text,
                                },
                              ]}
                              onPress={() => handleUpdateStatus(status)}
                              disabled={updating || isActive}
                            >
                              <Text
                                style={[
                                  styles.statusButtonText,
                                  isActive && { color: statusColors.text },
                                ]}
                              >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </Text>
                            </Pressable>
                          );
                        }
                      )}
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailDescription}>
                      {selectedReport.description}
                    </Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Reported User ID</Text>
                    <Text style={styles.detailValue}>
                      {selectedReport.reportedUserId}
                    </Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Reporter ID</Text>
                    <Text style={styles.detailValue}>
                      {selectedReport.reporterId}
                    </Text>
                  </View>

                  {selectedReport.createdAt && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Reported On</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedReport.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  )}

                  {/* Action Taken Section */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Action Taken</Text>
                    <TextInput
                      style={styles.actionInput}
                      value={actionTakenInput}
                      onChangeText={setActionTakenInput}
                      placeholder="Describe action taken (optional)"
                      placeholderTextColor={colors.mutedText}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      editable={!updating}
                    />
                    <AppButton
                      title="Update Action Taken"
                      onPress={handleUpdateActionTaken}
                      loading={updating}
                      disabled={
                        updating ||
                        actionTakenInput.trim() === selectedReport.actionTaken
                      }
                    />
                  </View>

                  {/* Archive Button */}
                  <View style={styles.detailSection}>
                    <AppButton
                      title="Archive Report"
                      onPress={handleArchiveReport}
                      variant="outline"
                      disabled={updating || selectedReport.status !== 'resolved'}
                    />
                    {selectedReport.status !== 'resolved' && (
                      <Text style={styles.archiveHint}>
                        Reports must be resolved before archiving
                      </Text>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
  centerContainer: {
    paddingVertical: 64,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 12,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
  },
  reportsList: {
    gap: 12,
  },
  reportCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportType: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  reportBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeLarge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reportDescription: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportMetaText: {
    fontSize: 12,
    color: colors.mutedText,
  },
  reportTime: {
    fontSize: 12,
    color: colors.mutedText,
  },
  actionTakenPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionTakenText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  detailDescription: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
  },
  actionInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 80,
    marginBottom: 12,
  },
  archiveHint: {
    fontSize: 12,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
