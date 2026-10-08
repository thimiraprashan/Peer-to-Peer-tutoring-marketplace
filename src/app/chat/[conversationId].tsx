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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import { Avatar } from '../../components/ui/Avatar';
import { MessageBubble } from '../../components/chat/MessageBubble';
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
    const otherId = conversation.participants.find((p: string) => p !== user.uid);
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

        {uploading && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
        )}
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
              const showDateSeparator =
                index === 0 ||
                (prevMsg?.createdAt &&
                  item.createdAt &&
                  prevMsg.createdAt.toDate().toDateString() !==
                    item.createdAt.toDate().toDateString());

              return (
                <>
                  {showDateSeparator && item.createdAt && (
                    <View style={styles.dateSeparator}>
                      <Text style={styles.dateSeparatorText}>
                        {item.createdAt.toDate().toLocaleDateString([], {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                  )}
                  <MessageBubble
                    senderId={item.senderId}
                    senderName={item.senderName}
                    text={item.text}
                    attachmentUrl={item.attachmentUrl}
                    attachmentName={item.attachmentName}
                    attachmentType={item.attachmentType}
                    createdAt={item.createdAt}
                    deletedAt={item.deletedAt}
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
});
