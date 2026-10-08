/**
 * MessageBubble.tsx
 * Renders a single chat message bubble.
 * Supports text, image attachments, file attachments, and deleted message state.
 * Long-press on own messages triggers delete action.
 */
import React from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { colors } from '../../theme/colors';

interface MessageBubbleProps {
  senderId: string;
  senderName: string;
  text: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: 'image' | 'file' | null;
  createdAt: Timestamp | null;
  deletedAt: Timestamp | null;
  isOwn: boolean;
  onLongPress?: () => void;
}

function formatMsgTime(ts: Timestamp | null): string {
  if (!ts) return '';
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  senderName,
  text,
  attachmentUrl,
  attachmentName,
  attachmentType,
  createdAt,
  deletedAt,
  isOwn,
  onLongPress,
}) => {
  const isDeleted = !!deletedAt;

  return (
    <View style={[styles.row, isOwn ? styles.rowRight : styles.rowLeft]}>
      {/* Sender name (only for received messages) */}
      {!isOwn && (
        <Text style={styles.senderName}>{senderName}</Text>
      )}

      <Pressable
        onLongPress={isOwn && !isDeleted ? onLongPress : undefined}
        delayLongPress={400}
        style={({ pressed }) => [
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          pressed && isOwn && !isDeleted && styles.bubblePressed,
        ]}
        accessibilityRole="text"
        accessibilityLabel={isDeleted ? 'Message deleted' : text || 'Attachment'}
      >
        {isDeleted ? (
          <View style={styles.deletedRow}>
            <Ionicons
              name="ban-outline"
              size={13}
              color={isOwn ? 'rgba(255,255,255,0.6)' : colors.mutedText}
            />
            <Text style={[styles.deletedText, isOwn && styles.deletedTextOwn]}>
              Message deleted
            </Text>
          </View>
        ) : (
          <>
            {/* Image attachment */}
            {attachmentType === 'image' && attachmentUrl ? (
              <Pressable onPress={() => Linking.openURL(attachmentUrl)}>
                <Image
                  source={{ uri: attachmentUrl }}
                  style={styles.attachmentImage}
                  resizeMode="cover"
                />
              </Pressable>
            ) : null}

            {/* File attachment */}
            {attachmentType === 'file' && attachmentUrl ? (
              <Pressable
                style={styles.fileRow}
                onPress={() => Linking.openURL(attachmentUrl)}
              >
                <View style={[styles.fileIcon, isOwn && styles.fileIconOwn]}>
                  <Ionicons
                    name="document-outline"
                    size={18}
                    color={isOwn ? colors.primary : colors.card}
                  />
                </View>
                <Text
                  style={[styles.fileName, isOwn && styles.fileNameOwn]}
                  numberOfLines={1}
                >
                  {attachmentName || 'Attachment'}
                </Text>
                <Ionicons
                  name="download-outline"
                  size={16}
                  color={isOwn ? 'rgba(255,255,255,0.8)' : colors.primary}
                />
              </Pressable>
            ) : null}

            {/* Text content */}
            {!!text && (
              <Text style={[styles.text, isOwn && styles.textOwn]}>{text}</Text>
            )}
          </>
        )}

        {/* Timestamp */}
        <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
          {formatMsgTime(createdAt)}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 16,
    marginBottom: 4,
    maxWidth: '78%',
  },
  rowLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  rowRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedText,
    marginBottom: 3,
    marginLeft: 12,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubblePressed: {
    opacity: 0.75,
  },
  deletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deletedText: {
    fontSize: 13,
    color: colors.mutedText,
    fontStyle: 'italic',
  },
  deletedTextOwn: {
    color: 'rgba(255,255,255,0.6)',
  },
  text: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  textOwn: {
    color: '#FFFFFF',
  },
  time: {
    fontSize: 10,
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  timeOwn: {
    color: 'rgba(255,255,255,0.65)',
  },
  timeOther: {
    color: colors.mutedText,
  },
  attachmentImage: {
    width: 200,
    height: 140,
    borderRadius: 10,
    marginBottom: 4,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    maxWidth: 220,
  },
  fileIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIconOwn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  fileNameOwn: {
    color: '#FFFFFF',
  },
});
