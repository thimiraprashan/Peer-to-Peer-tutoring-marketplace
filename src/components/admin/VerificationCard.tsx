import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Avatar } from '../ui/Avatar';
import { VerificationRequest } from '../../services/verificationService';

interface VerificationCardProps {
  request: VerificationRequest;
  onPress: () => void;
}

export const VerificationCard: React.FC<VerificationCardProps> = ({
  request,
  onPress,
}) => {
  const getStatusBadge = () => {
    switch (request.status) {
      case 'approved':
        return {
          bg: '#DCFCE7',
          text: '#15803D',
          icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
          label: 'Approved',
        };
      case 'rejected':
        return {
          bg: '#FEE2E2',
          text: '#B91C1C',
          icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
          label: 'Rejected',
        };
      default:
        return {
          bg: '#FEF3C7',
          text: '#B45309',
          icon: 'time' as keyof typeof Ionicons.glyphMap,
          label: 'Pending',
        };
    }
  };

  const statusBadge = getStatusBadge();

  // Helper to format date
  const formatTime = (timeValue: any) => {
    if (!timeValue) return '';
    try {
      const date = new Date(timeValue?.toDate ? timeValue.toDate() : timeValue);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 60) return `${diffMins <= 1 ? 'Just now' : `${diffMins}m ago`}`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Verification for ${request.applicantName}, status ${request.status}`}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <Avatar name={request.applicantName} size={44} />

        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.applicantName} numberOfLines={1}>
              {request.applicantName}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
              <Ionicons
                name={statusBadge.icon}
                size={12}
                color={statusBadge.text}
                style={styles.statusIcon}
              />
              <Text style={[styles.statusText, { color: statusBadge.text }]}>
                {statusBadge.label}
              </Text>
            </View>
          </View>

          <View style={styles.subRow}>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>
                {request.applicantRole.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.facultyText} numberOfLines={1}>
              {request.faculty}
            </Text>
          </View>
        </View>
      </View>

      {/* Qualification & Subjects summary */}
      <View style={styles.bodySection}>
        <View style={styles.infoRow}>
          <Ionicons name="school-outline" size={14} color={colors.mutedText} />
          <Text style={styles.qualificationText} numberOfLines={1}>
            {request.qualification}
          </Text>
        </View>

        {request.subjects && request.subjects.length > 0 ? (
          <View style={styles.subjectsRow}>
            <Ionicons name="book-outline" size={14} color={colors.mutedText} />
            <Text style={styles.subjectsText} numberOfLines={1}>
              {request.subjects[0]}
              {request.subjects.length > 1
                ? ` +${request.subjects.length - 1} more`
                : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Footer: documents attached and submission date */}
      <View style={styles.cardFooter}>
        <View style={styles.docCountBadge}>
          <Ionicons name="document-text-outline" size={13} color={colors.primary} />
          <Text style={styles.docCountText}>
            {request.documents ? request.documents.length : 0} Docs Attached
          </Text>
        </View>

        <View style={styles.footerRight}>
          <Text style={styles.timeText}>{formatTime(request.submittedAt)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedText} />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.9,
    backgroundColor: '#FAFCFA',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  applicantName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rolePill: {
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  facultyText: {
    fontSize: 12,
    color: colors.mutedText,
    flex: 1,
  },
  bodySection: {
    backgroundColor: '#F7FAF7',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualificationText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  subjectsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectsText: {
    fontSize: 12,
    color: colors.mutedText,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F4F0',
    paddingTop: 10,
  },
  docCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lightGreen + '60',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  docCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: colors.mutedText,
  },
});

export default VerificationCard;
