import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  approveTutorVerification,
  getAllVerificationRequests,
  rejectTutorVerification,
  VerificationRequestItem,
} from '../../services/adminVerificationService';
import { colors } from '../../theme/colors';

type FilterTab = 'all' | 'pending' | 'verified' | 'rejected';

export default function AdminVerificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useCurrentUser();

  const [requests, setRequests] = useState<VerificationRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequestItem | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [adminNote, setAdminNote] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Load verification requests
  const loadRequests = useCallback(async () => {
    try {
      const data = await getAllVerificationRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load verification requests:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Tab filter
      if (activeTab === 'pending' && req.status !== 'submitted' && req.status !== 'pending') {
        return false;
      }
      if (activeTab === 'verified' && req.status !== 'verified') {
        return false;
      }
      if (activeTab === 'rejected' && req.status !== 'rejected') {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = req.tutorName?.toLowerCase().includes(query);
        const matchesEmail = req.email?.toLowerCase().includes(query);
        const matchesUni = req.university?.toLowerCase().includes(query);
        const matchesFaculty = req.faculty?.toLowerCase().includes(query);
        const matchesId = req.studentId?.toLowerCase().includes(query);
        const matchesSubject = req.subjects?.some((s) => s.toLowerCase().includes(query));
        return matchesName || matchesEmail || matchesUni || matchesFaculty || matchesId || matchesSubject;
      }

      return true;
    });
  }, [requests, activeTab, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'submitted' || r.status === 'pending').length;
    const verified = requests.filter((r) => r.status === 'verified').length;
    const rejected = requests.filter((r) => r.status === 'rejected').length;
    return { all: requests.length, pending, verified, rejected };
  }, [requests]);

  // Open review modal
  const openReviewModal = (req: VerificationRequestItem) => {
    setSelectedRequest(req);
    setAdminNote(req.adminNote || '');
    setModalVisible(true);
  };

  // Approve Tutor Action
  const handleApprove = async (item: VerificationRequestItem) => {
    Alert.alert(
      'Approve Tutor Verification',
      `Are you sure you want to verify ${item.tutorName}? Their profile will receive the verified badge immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Verify',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await approveTutorVerification(
                item.id,
                item.tutorId,
                user?.uid || 'admin',
                adminNote || 'Approved by administrator'
              );
              Alert.alert('Tutor Verified', `${item.tutorName} has been successfully verified!`);
              // Update local state
              setRequests((prev) =>
                prev.map((r) =>
                  r.id === item.id
                    ? { ...r, status: 'verified', adminNote: adminNote || 'Approved by administrator' }
                    : r
                )
              );
              setModalVisible(false);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not approve tutor verification.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Reject Tutor Action
  const handleReject = async (item: VerificationRequestItem) => {
    Alert.prompt
      ? Alert.prompt(
          'Reject Verification',
          `Enter rejection reason for ${item.tutorName}:`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Reject',
              style: 'destructive',
              onPress: async (reason?: string) => {
                await executeReject(item, reason || adminNote || 'Documents did not meet verification criteria.');
              },
            },
          ],
          'plain-text',
          adminNote || 'Uploaded credentials could not be validated.'
        )
      : Alert.alert(
          'Reject Verification',
          `Are you sure you want to reject the verification request for ${item.tutorName}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm Reject',
              style: 'destructive',
              onPress: async () => {
                await executeReject(item, adminNote || 'Documents did not meet verification criteria.');
              },
            },
          ]
        );
  };

  const executeReject = async (item: VerificationRequestItem, reason: string) => {
    setActionLoading(true);
    try {
      await rejectTutorVerification(item.id, item.tutorId, reason, user?.uid || 'admin');
      Alert.alert('Verification Rejected', `The request for ${item.tutorName} was marked as rejected.`);
      setRequests((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, status: 'rejected', adminNote: reason } : r))
      );
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not reject verification.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'Recent';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Recent';
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 8, 44),
          },
        ]}
      >
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Back to Dashboard"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.platformBadge}>
            <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
            <Text style={styles.platformBadgeText}>Admin Console</Text>
          </View>

          <Pressable
            onPress={handleRefresh}
            style={styles.refreshBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            <Ionicons name="reload" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <Text style={styles.screenTitle}>Verification Queue</Text>
        <Text style={styles.screenSubtitle}>
          Review submitted tutor credentials, transcripts & student IDs
        </Text>

        {/* Filter Tabs */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
              Pending Review ({counts.pending})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              All ({counts.all})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === 'verified' && styles.tabActive]}
            onPress={() => setActiveTab('verified')}
          >
            <Text style={[styles.tabText, activeTab === 'verified' && styles.tabTextActive]}>
              Verified ({counts.verified})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === 'rejected' && styles.tabActive]}
            onPress={() => setActiveTab('rejected')}
          >
            <Text style={[styles.tabText, activeTab === 'rejected' && styles.tabTextActive]}>
              Rejected ({counts.rejected})
            </Text>
          </Pressable>
        </View>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.mutedText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by tutor, email, student ID, module..."
            placeholderTextColor={colors.mutedText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.mutedText} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Main Content */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading verification requests...</Text>
        </View>
      ) : filteredRequests.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.emptyIconCircle}>
            <Ionicons name="shield-checkmark-outline" size={44} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Verification Requests</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'No tutors match your search query.'
              : activeTab === 'pending'
              ? 'All caught up! There are currently no pending tutor verification requests.'
              : 'No verification records found in this category.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 32, 40) },
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
          <Text style={styles.resultsCount}>
            Showing {filteredRequests.length} candidate{filteredRequests.length === 1 ? '' : 's'}
          </Text>

          {filteredRequests.map((item) => {
            const isVerified = item.status === 'verified';
            const isRejected = item.status === 'rejected';
            const isPending = !isVerified && !isRejected;

            return (
              <View key={item.id} style={styles.card}>
                {/* Card Top Row */}
                <View style={styles.cardHeader}>
                  <Avatar name={item.tutorName} size={46} />
                  <View style={styles.cardHeaderInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.tutorName}>{item.tutorName}</Text>
                      {isVerified && <VerifiedBadge />}
                    </View>
                    <Text style={styles.tutorEmail}>{item.email || 'No email provided'}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      isVerified
                        ? styles.statusPillVerified
                        : isRejected
                        ? styles.statusPillRejected
                        : styles.statusPillPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isVerified
                          ? styles.statusTextVerified
                          : isRejected
                          ? styles.statusTextRejected
                          : styles.statusTextPending,
                      ]}
                    >
                      {isVerified ? 'Verified' : isRejected ? 'Rejected' : 'Pending Review'}
                    </Text>
                  </View>
                </View>

                {/* University & Credentials Info */}
                <View style={styles.detailsBox}>
                  <View style={styles.detailRow}>
                    <Ionicons name="school-outline" size={15} color={colors.primary} />
                    <Text style={styles.detailText} numberOfLines={1}>
                      {item.university}
                    </Text>
                  </View>

                  {item.faculty ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="business-outline" size={15} color={colors.mutedText} />
                      <Text style={styles.detailText} numberOfLines={1}>
                        {item.faculty}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.metadataRow}>
                    {item.studentId ? (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipLabel}>ID: </Text>
                        <Text style={styles.metaChipValue}>{item.studentId}</Text>
                      </View>
                    ) : null}

                    {item.yearOfStudy ? (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipLabel}>Year: </Text>
                        <Text style={styles.metaChipValue}>{item.yearOfStudy}</Text>
                      </View>
                    ) : null}

                    {item.gpa ? (
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipLabel}>GPA: </Text>
                        <Text style={styles.metaChipValue}>{Number(item.gpa).toFixed(2)}</Text>
                      </View>
                    ) : null}

                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipLabel}>Submitted: </Text>
                      <Text style={styles.metaChipValue}>{formatDate(item.submittedAt)}</Text>
                    </View>
                  </View>
                </View>

                {/* Subjects tags */}
                {item.subjects && item.subjects.length > 0 ? (
                  <View style={styles.subjectsRow}>
                    {item.subjects.slice(0, 3).map((sub, i) => (
                      <View key={i} style={styles.subjectChip}>
                        <Text style={styles.subjectChipText} numberOfLines={1}>
                          {sub}
                        </Text>
                      </View>
                    ))}
                    {item.subjects.length > 3 && (
                      <View style={styles.moreSubjectsChip}>
                        <Text style={styles.moreSubjectsText}>+{item.subjects.length - 3}</Text>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* Uploaded Documents Indicator */}
                <View style={styles.documentsRow}>
                  <View style={styles.documentItem}>
                    <Ionicons
                      name={item.studentIdUrl ? 'card-outline' : 'alert-circle-outline'}
                      size={15}
                      color={item.studentIdUrl ? colors.primary : colors.mutedText}
                    />
                    <Text style={styles.documentText}>
                      Student ID: {item.studentIdUrl ? 'Attached ✓' : 'Not attached'}
                    </Text>
                  </View>

                  <View style={styles.documentItem}>
                    <Ionicons
                      name={item.cvUrl ? 'document-text-outline' : 'alert-circle-outline'}
                      size={15}
                      color={item.cvUrl ? colors.primary : colors.mutedText}
                    />
                    <Text style={styles.documentText}>
                      CV/Transcript: {item.cvUrl ? 'Attached ✓' : 'Not attached'}
                    </Text>
                  </View>
                </View>

                {/* Admin Note if already handled */}
                {item.adminNote ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteLabel}>Admin Note:</Text>
                    <Text style={styles.noteText}>{item.adminNote}</Text>
                  </View>
                ) : null}

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.reviewBtn}
                    onPress={() => openReviewModal(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Review credentials for ${item.tutorName}`}
                  >
                    <Ionicons name="eye-outline" size={16} color={colors.primary} />
                    <Text style={styles.reviewBtnText}>Review Credentials</Text>
                  </TouchableOpacity>

                  {isPending && (
                    <View style={styles.quickActionGroup}>
                      <TouchableOpacity
                        style={styles.quickApproveBtn}
                        onPress={() => handleApprove(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Approve ${item.tutorName}`}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.quickApproveText}>Verify</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.quickRejectBtn}
                        onPress={() => handleReject(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Reject ${item.tutorName}`}
                      >
                        <Ionicons name="close" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Review Details Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>Tutor Credentials Review</Text>
                <Text style={styles.modalSubtitle}>
                  Verification assessment for {selectedRequest?.tutorName}
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {selectedRequest && (
                <>
                  {/* Candidate Overview Card */}
                  <View style={styles.modalSectionCard}>
                    <View style={styles.modalProfileRow}>
                      <Avatar name={selectedRequest.tutorName} size={54} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.modalName}>{selectedRequest.tutorName}</Text>
                        <Text style={styles.modalEmail}>{selectedRequest.email}</Text>
                        <Text style={styles.modalStatusText}>
                          Current Status:{' '}
                          <Text
                            style={{
                              fontWeight: '700',
                              color:
                                selectedRequest.status === 'verified'
                                  ? colors.primary
                                  : selectedRequest.status === 'rejected'
                                  ? colors.error
                                  : '#D97706',
                            }}
                          >
                            {selectedRequest.status.toUpperCase()}
                          </Text>
                        </Text>
                      </View>
                    </View>

                    <View style={styles.gridInfo}>
                      <View style={styles.gridCell}>
                        <Text style={styles.gridLabel}>University</Text>
                        <Text style={styles.gridValue}>{selectedRequest.university}</Text>
                      </View>
                      <View style={styles.gridCell}>
                        <Text style={styles.gridLabel}>Faculty</Text>
                        <Text style={styles.gridValue}>{selectedRequest.faculty || 'N/A'}</Text>
                      </View>
                      <View style={styles.gridCell}>
                        <Text style={styles.gridLabel}>Student ID</Text>
                        <Text style={styles.gridValue}>{selectedRequest.studentId || 'N/A'}</Text>
                      </View>
                      <View style={styles.gridCell}>
                        <Text style={styles.gridLabel}>Year of Study</Text>
                        <Text style={styles.gridValue}>Year {selectedRequest.yearOfStudy || 1}</Text>
                      </View>
                      {selectedRequest.gpa ? (
                        <View style={styles.gridCell}>
                          <Text style={styles.gridLabel}>Cumulative GPA</Text>
                          <Text style={styles.gridValue}>
                            {Number(selectedRequest.gpa).toFixed(2)}
                          </Text>
                        </View>
                      ) : null}
                      {selectedRequest.degree ? (
                        <View style={styles.gridCell}>
                          <Text style={styles.gridLabel}>Degree Program</Text>
                          <Text style={styles.gridValue}>{selectedRequest.degree}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Subjects / Teaching Modules */}
                  {selectedRequest.subjects && selectedRequest.subjects.length > 0 && (
                    <View style={styles.modalSectionCard}>
                      <Text style={styles.sectionHeading}>Teaching Modules / Subjects</Text>
                      <View style={styles.subjectsRow}>
                        {selectedRequest.subjects.map((sub, i) => (
                          <View key={i} style={styles.subjectChip}>
                            <Text style={styles.subjectChipText}>{sub}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Uploaded Documents Showcase */}
                  <View style={styles.modalSectionCard}>
                    <Text style={styles.sectionHeading}>Verification Documents</Text>

                    {/* Student ID Card */}
                    <View style={styles.docCard}>
                      <View style={styles.docHeader}>
                        <Ionicons name="card" size={18} color={colors.primary} />
                        <Text style={styles.docTitle}>Student Identity Card</Text>
                      </View>

                      {selectedRequest.studentIdUrl ? (
                        <View style={styles.docImageContainer}>
                          <Image
                            source={{ uri: selectedRequest.studentIdUrl }}
                            style={styles.docImage}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={styles.viewFullBtn}
                            onPress={() => setPreviewImage(selectedRequest.studentIdUrl!)}
                          >
                            <Ionicons name="expand" size={14} color="#FFF" />
                            <Text style={styles.viewFullText}>Preview Full Image</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.docEmpty}>
                          <Ionicons name="alert-circle-outline" size={24} color={colors.mutedText} />
                          <Text style={styles.docEmptyText}>No student ID image attached</Text>
                        </View>
                      )}
                    </View>

                    {/* CV / Academic Transcript */}
                    <View style={[styles.docCard, { marginTop: 12 }]}>
                      <View style={styles.docHeader}>
                        <Ionicons name="document-text" size={18} color={colors.primary} />
                        <Text style={styles.docTitle}>CV / Academic Transcript</Text>
                      </View>

                      {selectedRequest.cvUrl ? (
                        <View style={styles.docImageContainer}>
                          <Image
                            source={{ uri: selectedRequest.cvUrl }}
                            style={styles.docImage}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={styles.viewFullBtn}
                            onPress={() => setPreviewImage(selectedRequest.cvUrl!)}
                          >
                            <Ionicons name="expand" size={14} color="#FFF" />
                            <Text style={styles.viewFullText}>Preview Full Document</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.docEmpty}>
                          <Ionicons name="alert-circle-outline" size={24} color={colors.mutedText} />
                          <Text style={styles.docEmptyText}>No CV / transcript attached</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Administrator Assessment Note */}
                  <View style={styles.modalSectionCard}>
                    <Text style={styles.sectionHeading}>Administrator Decision Notes</Text>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Add verification notes or feedback for this tutor..."
                      placeholderTextColor={colors.mutedText}
                      value={adminNote}
                      onChangeText={setAdminNote}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Decision Actions */}
                  <View style={styles.modalDecisionRow}>
                    <TouchableOpacity
                      style={[styles.modalApproveBtn, actionLoading && { opacity: 0.7 }]}
                      onPress={() => handleApprove(selectedRequest)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <>
                          <Ionicons name="shield-checkmark" size={18} color="#FFF" />
                          <Text style={styles.modalApproveText}>Approve & Verify Tutor</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalRejectBtn, actionLoading && { opacity: 0.7 }]}
                      onPress={() => handleReject(selectedRequest)}
                      disabled={actionLoading}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                      <Text style={styles.modalRejectText}>Reject Verification</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Document Full Preview Modal ── */}
      <Modal
        visible={previewImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewCloseBtn} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  platformBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
    marginBottom: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.mutedText,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.mutedText,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 19,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedText,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  tutorEmail: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillVerified: {
    backgroundColor: '#D1FAE5',
  },
  statusPillRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextPending: {
    color: '#B45309',
  },
  statusTextVerified: {
    color: '#047857',
  },
  statusTextRejected: {
    color: '#B91C1C',
  },
  detailsBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaChipLabel: {
    fontSize: 11,
    color: colors.mutedText,
    fontWeight: '500',
  },
  metaChipValue: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '700',
  },
  subjectsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  subjectChip: {
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.primary,
  },
  moreSubjectsChip: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    justifyContent: 'center',
  },
  moreSubjectsText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedText,
  },
  documentsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  documentText: {
    fontSize: 12,
    color: colors.mutedText,
    fontWeight: '500',
  },
  noteBox: {
    marginTop: 10,
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedText,
    marginBottom: 2,
  },
  noteText: {
    fontSize: 12,
    color: colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  reviewBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primary,
  },
  quickActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  quickApproveText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickRejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitleGroup: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    paddingVertical: 14,
    gap: 14,
  },
  modalSectionCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  modalEmail: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
  modalStatusText: {
    fontSize: 11.5,
    color: colors.mutedText,
    marginTop: 3,
  },
  gridInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gridCell: {
    width: '47%',
  },
  gridLabel: {
    fontSize: 11,
    color: colors.mutedText,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  gridValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  docCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  docTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  docImageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  docImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  viewFullBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewFullText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  docEmpty: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  docEmptyText: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
  },
  noteInput: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalDecisionRow: {
    gap: 10,
    marginTop: 6,
  },
  modalApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalApproveText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalRejectText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  // Full Image Preview Modal
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '94%',
    height: '80%',
  },
});
