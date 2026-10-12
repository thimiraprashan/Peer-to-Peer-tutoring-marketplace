/**
 * chat/[conversationId].tsx
 * Chat Detail Screen — shows message history and provides the message input
 * always fixed at the bottom of the screen (UI04 requirement).
 *
 * Features:
 * - Real-time message subscription via Firestore
 * - Send text messages
 * - Attach files (expo-document-picker) or images (expo-image-picker)
 * - Long-press own messages to delete (with confirmation)
 * - Input + attachment button always visible at bottom, even with keyboard open
 */
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { AppButton } from '../../components/ui/AppButton';
import { Avatar } from '../../components/ui/Avatar';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  ChatMessage,
  Conversation,
  deleteOwnMessage,
  getConversation,
  sendAttachmentMessage,
  sendTextMessage,
  subscribeToMessages,
} from '../../services/chatService';
import { createReport, ReportSeverity, ReportType } from '../../services/reportsService';
import { colors } from '../../theme/colors';

export default function ChatDetailScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useCurrentUser();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(true);

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Report modal state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('misconduct');
  const [reportSeverity, setReportSeverity] = useState<ReportSeverity>('medium');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // ─── Load conversation metadata ───────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    setLoadingConv(true);
    getConversation(conversationId)
      .then((conv: Conversation | null) => setConversation(conv))
      .catch(console.error)
      .finally(() => setLoadingConv(false));
  }, [conversationId]);

  // ─── Subscribe to messages ────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;

    unsubRef.current?.();
    setLoadingMsgs(true);

    unsubRef.current = subscribeToMessages(
      conversationId,
      (msgs: ChatMessage[]) => {
        setMessages(msgs);
        setLoadingMsgs(false);
        // Auto-scroll to bottom on new message
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      (err: Error) => {
        console.error('Messages subscription error:', err);
        setLoadingMsgs(false);
      }
    );

    return () => unsubRef.current?.();
  }, [conversationId]);

  // ─── Derived: other participant name ─────────────────────────────────────
  const otherParticipantName = React.useMemo(() => {
    if (!conversation || !user?.uid) return 'Chat';
    const participantList = conversation.participantIds || conversation.participants || [];
    const otherId = participantList.find((p: string) => p !== user.uid);
    return otherId
      ? conversation.participantNames?.[otherId] || 'Unknown User'
      : 'Chat';
  }, [conversation, user?.uid]);

  // ─── Send text ────────────────────────────────────────────────────────────
  const handleSendText = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !conversationId || !user?.uid || sending) return;

    setSending(true);
    setInputText('');
    try {
      await sendTextMessage(
        conversationId,
        user.uid,
        profile?.name || 'You',
        text
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not send message.');
      setInputText(text); // restore text on failure
    } finally {
      setSending(false);
    }
  }, [inputText, conversationId, user?.uid, profile?.name, sending]);

  // ─── Pick & send image ────────────────────────────────────────────────────
  const handlePickImage = async () => {
    setAttachmentMenuVisible(false);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to attach images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const fileName = asset.fileName || `image_${Date.now()}.jpg`;
    const mimeType = asset.mimeType || 'image/jpeg';

    setUploading(true);
    try {
      await sendAttachmentMessage(
        conversationId!,
        user!.uid,
        profile?.name || 'You',
        uri,
        fileName,
        mimeType
      );
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  // ─── Pick & send file ─────────────────────────────────────────────────────
  const handlePickFile = async () => {
    setAttachmentMenuVisible(false);

    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const fileName = asset.name || `file_${Date.now()}`;
    const mimeType = asset.mimeType || 'application/octet-stream';

    setUploading(true);
    try {
      await sendAttachmentMessage(
        conversationId!,
        user!.uid,
        profile?.name || 'You',
        uri,
        fileName,
        mimeType
      );
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message || 'Could not upload file.');
    } finally {
      setUploading(false);
    }
  };

  // ─── Delete own message ───────────────────────────────────────────────────
  const handleDeleteMessage = (messageId: string) => {
    Alert.alert(
      'Delete Message',
      'This message will be permanently deleted. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOwnMessage(conversationId!, messageId);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete message.');
            }
          },
        },
      ]
    );
  };

  // ─── Report user ──────────────────────────────────────────────────────────
  const handleOpenReportModal = () => {
    setReportModalVisible(true);
    setReportType('misconduct');
    setReportSeverity('medium');
    setReportDescription('');
  };

  const handleSubmitReport = async () => {
    if (!reportDescription.trim()) {
      Alert.alert('Required', 'Please provide a description for the report.');
      return;
    }

    if (!conversation || !user?.uid) return;

    // Get the other participant's ID
    const participantList = conversation.participantIds || conversation.participants || [];
    const reportedUserId = participantList.find((p: string) => p !== user.uid);

    if (!reportedUserId) {
      Alert.alert('Error', 'Could not identify the user to report.');
      return;
    }

    setSubmittingReport(true);
    try {
      await createReport({
        reportedUserId,
        reporterId: user.uid,
        type: reportType,
        description: reportDescription.trim(),
        severity: reportSeverity,
      });

      Alert.alert('Success', 'Report submitted successfully. An admin will review it.');
      setReportModalVisible(false);
      setReportDescription('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const canSend = inputText.trim().length > 0 && !sending && !uploading;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 44) }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        <Avatar name={otherParticipantName} size={36} />

        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {loadingConv ? 'Loading...' : otherParticipantName}
          </Text>
          {!loadingConv && (
            <Text style={styles.headerStatus}>Active now</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {uploading && (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
          {!loadingConv && (
            <Pressable
              style={styles.reportButton}
              onPress={handleOpenReportModal}
              accessibilityRole="button"
              accessibilityLabel="Report user"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="flag-outline" size={20} color={colors.error} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Message list + Input wrapper (KeyboardAvoidingView) ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Message List */}
        {loadingMsgs ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>Send a message to start the conversation.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const isOwn = item.senderId === user?.uid;
              const prevMsg = messages[index - 1];
              const msgTimestamp = item.sentAt || item.createdAt;
              const prevMsgTimestamp = prevMsg?.sentAt || prevMsg?.createdAt;
              const showDateSeparator =
                index === 0 ||
                (prevMsgTimestamp &&
                  msgTimestamp &&
                  prevMsgTimestamp.toDate().toDateString() !==
                    msgTimestamp.toDate().toDateString());

              return (
                <>
                  {showDateSeparator && msgTimestamp && (
                    <View style={styles.dateSeparator}>
                      <Text style={styles.dateSeparatorText}>
                        {msgTimestamp.toDate().toLocaleDateString([], {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                  )}
                  <MessageBubble
                    senderId={item.senderId}
                    senderName={item.senderName || 'Unknown'}
                    text={item.text}
                    attachmentUrl={item.attachmentUrl}
                    attachmentName={item.attachmentName}
                    attachmentType={item.attachmentType || null}
                    createdAt={msgTimestamp}
                    deletedAt={item.deletedAt || null}
                    isOwn={isOwn}
                    onLongPress={
                      isOwn ? () => handleDeleteMessage(item.id) : undefined
                    }
                  />
                </>
              );
            }}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messageListContent}
          />
        )}

        {/* ── Message Input Bar — always at bottom (UI04) ── */}
        <View
          style={[
            styles.inputBar,
            { paddingBottom: Math.max(insets.bottom + 8, 16) },
          ]}
        >
          {/* Attachment Button */}
          <Pressable
            style={[styles.iconButton, uploading && styles.iconButtonDisabled]}
            onPress={() => setAttachmentMenuVisible(true)}
            disabled={uploading || sending}
            accessibilityRole="button"
            accessibilityLabel="Attach file or image"
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="attach" size={24} color={colors.primary} />
            )}
          </Pressable>

          {/* Text Input */}
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedText}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            returnKeyType="default"
            blurOnSubmit={false}
            editable={!sending && !uploading}
            accessibilityLabel="Message input field"
          />

          {/* Send Button */}
          <Pressable
            style={[
              styles.sendButton,
              canSend ? styles.sendButtonActive : styles.sendButtonInactive,
            ]}
            onPress={handleSendText}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={canSend ? '#FFF' : colors.mutedText}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── Attachment Picker Modal ── */}
      <Modal
        visible={attachmentMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachmentMenuVisible(false)}
      >
        <Pressable
          style={styles.attachOverlay}
          onPress={() => setAttachmentMenuVisible(false)}
        >
          <Pressable
            style={styles.attachSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.attachTitle}>Attach</Text>

            <Pressable
              style={({ pressed }) => [
                styles.attachOption,
                pressed && styles.attachOptionPressed,
              ]}
              onPress={handlePickImage}
              accessibilityRole="button"
              accessibilityLabel="Attach image from gallery"
            >
              <View style={[styles.attachIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="image-outline" size={22} color="#2E7D32" />
              </View>
              <View>
                <Text style={styles.attachOptionLabel}>Image</Text>
                <Text style={styles.attachOptionSub}>From your photo library</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.attachOption,
                pressed && styles.attachOptionPressed,
              ]}
              onPress={handlePickFile}
              accessibilityRole="button"
              accessibilityLabel="Attach file from storage"
            >
              <View style={[styles.attachIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="document-outline" size={22} color="#D97706" />
              </View>
              <View>
                <Text style={styles.attachOptionLabel}>File</Text>
                <Text style={styles.attachOptionSub}>
                  PDF, Word, ZIP and more
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.attachCancel}
              onPress={() => setAttachmentMenuVisible(false)}
            >
              <Text style={styles.attachCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Report User Modal ── */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.reportOverlay}>
          <Pressable
            style={styles.reportBackdrop}
            onPress={() => setReportModalVisible(false)}
          />
          <View style={styles.reportModal}>
            <ScrollView
              contentContainerStyle={styles.reportContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>Report User</Text>
                <Pressable
                  onPress={() => setReportModalVisible(false)}
                  style={styles.reportCloseButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              <Text style={styles.reportSubtitle}>
                Report {otherParticipantName} for inappropriate behavior
              </Text>

              {/* Report Type */}
              <View style={styles.reportSection}>
                <Text style={styles.reportLabel}>Report Type</Text>
                <View style={styles.optionGroup}>
                  {(['no-show', 'misconduct', 'other'] as ReportType[]).map((type) => (
                    <Pressable
                      key={type}
                      style={[
                        styles.optionButton,
                        reportType === type && styles.optionButtonSelected,
                      ]}
                      onPress={() => setReportType(type)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          reportType === type && styles.optionTextSelected,
                        ]}
                      >
                        {type === 'no-show' ? 'No-Show' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Severity */}
              <View style={styles.reportSection}>
                <Text style={styles.reportLabel}>Severity</Text>
                <View style={styles.optionGroup}>
                  {(['low', 'medium', 'high'] as ReportSeverity[]).map((severity) => (
                    <Pressable
                      key={severity}
                      style={[
                        styles.optionButton,
                        reportSeverity === severity && styles.optionButtonSelected,
                      ]}
                      onPress={() => setReportSeverity(severity)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          reportSeverity === severity && styles.optionTextSelected,
                        ]}
                      >
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View style={styles.reportSection}>
                <Text style={styles.reportLabel}>Description *</Text>
                <TextInput
                  style={styles.reportInput}
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  placeholder="Describe the issue in detail..."
                  placeholderTextColor={colors.mutedText}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  maxLength={500}
                />
                <Text style={styles.charCount}>
                  {reportDescription.length}/500
                </Text>
              </View>

              {/* Submit Button */}
              <View style={styles.reportActions}>
                <AppButton
                  title="Submit Report"
                  onPress={handleSubmitReport}
                  loading={submittingReport}
                  disabled={submittingReport || !reportDescription.trim()}
                />
              </View>
            </ScrollView>
          </View>
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
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
  },
  messageListContent: {
    paddingVertical: 12,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: colors.mutedText,
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontWeight: '500',
  },
  // ── Input Bar ────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  iconButtonDisabled: {
    opacity: 0.6,
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    lineHeight: 20,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
  sendButtonInactive: {
    backgroundColor: colors.lightGreen,
  },
  // ── Attachment Modal ──────────────────────────────────────────────────────
  attachOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  attachSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  attachTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  attachOptionPressed: {
    backgroundColor: colors.lightGreen,
    borderRadius: 10,
  },
  attachIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  attachOptionSub: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
  attachCancel: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.mutedText,
  },
  reportButton: {
    padding: 4,
  },
  reportOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  reportBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  reportModal: {
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
  reportContent: {
    padding: 24,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  reportCloseButton: {
    padding: 4,
  },
  reportSubtitle: {
    fontSize: 14,
    color: colors.mutedText,
    marginBottom: 24,
  },
  reportSection: {
    marginBottom: 20,
  },
  reportLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: colors.lightGreen,
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
  },
  optionTextSelected: {
    color: colors.primary,
  },
  reportInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: colors.mutedText,
    textAlign: 'right',
    marginTop: 4,
  },
  reportActions: {
    marginTop: 8,
  },
});