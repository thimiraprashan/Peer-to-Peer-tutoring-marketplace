import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AppButton } from '../ui/AppButton';

interface VerificationRejectModalProps {
  visible: boolean;
  applicantName: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const PRESET_REASONS = [
  'Incomplete or illegible document attached',
  'Academic transcript cannot be verified with institution',
  'Does not meet minimum module grade / GPA threshold',
  'Student ID validity has expired',
  'Subject area expertise not substantiated by coursework',
];

export const VerificationRejectModal: React.FC<VerificationRejectModalProps> = ({
  visible,
  applicantName,
  loading = false,
  onCancel,
  onConfirm,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');

  const handleConfirm = () => {
    const finalReason = customNotes.trim()
      ? `${selectedReason}: ${customNotes.trim()}`
      : selectedReason;

    if (!finalReason) {
      setErrorText('Please provide or select a rejection reason.');
      return;
    }

    setErrorText('');
    onConfirm(finalReason);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconCircle}>
            <Ionicons name="close-circle" size={36} color={colors.error} />
          </View>

          <Text style={styles.title}>Reject Verification</Text>
          <Text style={styles.subtitle}>
            State reason for rejecting {applicantName}'s application
          </Text>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>Select Reason:</Text>
            <View style={styles.presetList}>
              {PRESET_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <Pressable
                    key={reason}
                    onPress={() => setSelectedReason(reason)}
                    style={[
                      styles.presetChip,
                      isSelected && styles.presetChipSelected,
                    ]}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={isSelected ? colors.error : colors.mutedText}
                      style={{ marginRight: 8, marginTop: 1 }}
                    />
                    <Text
                      style={[
                        styles.presetText,
                        isSelected && styles.presetTextSelected,
                      ]}
                    >
                      {reason}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Additional Feedback (Optional):</Text>
            <TextInput
              value={customNotes}
              onChangeText={setCustomNotes}
              placeholder="Provide specific notes for the applicant..."
              placeholderTextColor={colors.mutedText}
              multiline
              numberOfLines={3}
              style={styles.notesInput}
              textAlignVertical="top"
            />

            {errorText ? (
              <Text style={styles.errorText}>{errorText}</Text>
            ) : null}
          </ScrollView>

          <View style={styles.actionRow}>
            <View style={styles.buttonFlex}>
              <AppButton
                title="Cancel"
                onPress={onCancel}
                variant="outline"
                disabled={loading}
              />
            </View>
            <View style={styles.buttonFlex}>
              <Pressable
                onPress={handleConfirm}
                disabled={loading}
                style={({ pressed }) => [
                  styles.rejectConfirmBtn,
                  pressed && styles.rejectConfirmBtnPressed,
                  loading && styles.rejectConfirmBtnDisabled,
                ]}
              >
                <Text style={styles.rejectConfirmText}>
                  {loading ? 'Rejecting...' : 'Reject'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  scrollArea: {
    maxHeight: 320,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 6,
  },
  presetList: {
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAF5F5',
    borderWidth: 1,
    borderColor: '#F0D5D5',
    borderRadius: 10,
    padding: 10,
  },
  presetChipSelected: {
    backgroundColor: '#FEE2E2',
    borderColor: colors.error,
  },
  presetText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  presetTextSelected: {
    fontWeight: '600',
    color: '#991B1B',
  },
  notesInput: {
    backgroundColor: '#FAF5F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: colors.text,
    minHeight: 70,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 6,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonFlex: {
    flex: 1,
  },
  rejectConfirmBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectConfirmBtnPressed: {
    opacity: 0.85,
  },
  rejectConfirmBtnDisabled: {
    opacity: 0.6,
  },
  rejectConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VerificationRejectModal;
