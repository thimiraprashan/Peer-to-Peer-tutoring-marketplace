import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Avatar } from '../ui/Avatar';
import { AppButton } from '../ui/AppButton';
import { VerificationRequest } from '../../services/verificationService';

interface VerificationDetailModalProps {
  visible: boolean;
  request: VerificationRequest | null;
  approving?: boolean;
  onClose: () => void;
  onApprove: () => void;
  onOpenReject: () => void;
}

export const VerificationDetailModal: React.FC<VerificationDetailModalProps> = ({
  request,
  visible,
  approving = false,
  onClose,
  onApprove,
  onOpenReject,
}) => {
  if (!request) return null;

  const isPending = request.status === 'pending';
  const isApproved = request.status === 'approved';
  const isRejected = request.status === 'rejected';

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'id_card':
        return 'card-outline' as keyof typeof Ionicons.glyphMap;
      case 'transcript':
        return 'document-text-outline' as keyof typeof Ionicons.glyphMap;
      case 'certificate':
        return 'ribbon-outline' as keyof typeof Ionicons.glyphMap;
      default:
        return 'document-outline' as keyof typeof Ionicons.glyphMap;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>Verification Review</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close detail view"
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Status Banner */}
            {isPending && (
              <View style={[styles.statusBanner, styles.bannerPending]}>
                <Ionicons name="time" size={18} color="#B45309" />
                <View style={styles.bannerTextContainer}>
                  <Text style={[styles.bannerTitle, { color: '#B45309' }]}>
                    Pending Admin Decision
                  </Text>
                  <Text style={[styles.bannerSub, { color: '#92400E' }]}>
                    Review credentials below and approve or reject this applicant.
                  </Text>
                </View>
              </View>
            )}

            {isApproved && (
              <View style={[styles.statusBanner, styles.bannerApproved]}>
                <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                <View style={styles.bannerTextContainer}>
                  <Text style={[styles.bannerTitle, { color: '#15803D' }]}>
                    Application Approved
                  </Text>
                  <Text style={[styles.bannerSub, { color: '#166534' }]}>
                    Tutor has been verified and granted tutoring marketplace privileges.
                  </Text>
                </View>
              </View>
            )}

            {isRejected && (
              <View style={[styles.statusBanner, styles.bannerRejected]}>
                <Ionicons name="close-circle" size={18} color="#B91C1C" />
                <View style={styles.bannerTextContainer}>
                  <Text style={[styles.bannerTitle, { color: '#B91C1C' }]}>
                    Application Rejected
                  </Text>
                  <Text style={[styles.bannerSub, { color: '#991B1B' }]}>
                    Reason: {request.rejectionReason || 'Requirements not fulfilled.'}
                  </Text>
                </View>
              </View>
            )}

            {/* Applicant Profile Card */}
            <View style={styles.profileCard}>
              <Avatar name={request.applicantName} size={56} />
              <View style={styles.profileMeta}>
                <View style={styles.applicantNameRow}>
                  <Text style={styles.applicantName}>{request.applicantName}</Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>
                      {request.applicantRole.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.applicantEmail}>{request.applicantEmail}</Text>
                <Text style={styles.applicantFaculty}>{request.faculty}</Text>
              </View>
            </View>

            {/* Academic Credentials */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Academic Qualification</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Program:</Text>
                  <Text style={styles.infoValue}>{request.qualification}</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>GPA / Grade:</Text>
                  <Text style={[styles.infoValue, { fontWeight: '700', color: colors.primary }]}>
                    {request.gpa}
                  </Text>
                </View>
              </View>
            </View>

            {/* Teaching Modules / Subjects */}
            {request.subjects && request.subjects.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>Subjects Applied to Teach</Text>
                <View style={styles.subjectsContainer}>
                  {request.subjects.map((subj, idx) => (
                    <View key={idx} style={styles.subjectChip}>
                      <Ionicons name="book" size={13} color={colors.primary} />
                      <Text style={styles.subjectChipText}>{subj}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Bio / Motivation */}
            {request.bio ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>Statement of Purpose & Bio</Text>
                <View style={styles.statementCard}>
                  <Text style={styles.statementText}>{request.bio}</Text>
                </View>
              </View>
            ) : null}

            {/* Submitted Documents */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>
                Verification Documents ({request.documents?.length || 0})
              </Text>
              <View style={styles.documentsList}>
                {request.documents?.map((doc) => (
                  <View key={doc.id} style={styles.docItem}>
                    <View style={styles.docIconBox}>
                      <Ionicons
                        name={getDocIcon(doc.type)}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={styles.docName} numberOfLines={1}>
                        {doc.name}
                      </Text>
                      <Text style={styles.docMeta}>
                        {doc.fileSize || 'PDF Document'} • Verified Upload
                      </Text>
                    </View>
                    <View style={styles.docVerifiedPill}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                      <Text style={styles.docVerifiedText}>Attached</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerActions}>
            {isPending ? (
              <View style={styles.actionsRow}>
                <View style={styles.actionBtnFlex}>
                  <AppButton
                    title="Reject"
                    onPress={onOpenReject}
                    variant="outline"
                    disabled={approving}
                  />
                </View>
                <View style={styles.actionBtnFlex}>
                  <AppButton
                    title="Approve"
                    onPress={onApprove}
                    loading={approving}
                    disabled={approving}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.actionsRow}>
                <View style={styles.actionBtnFlex}>
                  <AppButton
                    title="Close Review"
                    onPress={onClose}
                    variant="outline"
                  />
                </View>
                {isRejected ? (
                  <View style={styles.actionBtnFlex}>
                    <AppButton
                      title="Re-evaluate & Approve"
                      onPress={onApprove}
                      loading={approving}
                      disabled={approving}
                    />
                  </View>
                ) : (
                  <View style={styles.actionBtnFlex}>
                    <AppButton
                      title="Revoke Verification"
                      onPress={onOpenReject}
                      variant="outline"
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F6F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  bannerPending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bannerApproved: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  bannerRejected: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAF8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  profileMeta: {
    flex: 1,
    marginLeft: 14,
  },
  applicantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  applicantName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 6,
  },
  roleBadge: {
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  applicantEmail: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: 2,
  },
  applicantFaculty: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: colors.mutedText,
  },
  infoValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F0F4F0',
    marginVertical: 8,
  },
  subjectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  statementCard: {
    backgroundColor: '#F8FAF8',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statementText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  documentsList: {
    gap: 8,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  docIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  docMeta: {
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
  docVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  docVerifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  footerActions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtnFlex: {
    flex: 1,
  },
});

export default VerificationDetailModal;
