/**
 * ConversationItem.tsx
 * A single row in the conversation list.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { colors } from '../../theme/colors';
import { Avatar } from '../ui/Avatar';

interface ConversationItemProps {
  otherName: string;
  lastMessage: string;
  lastMessageTime: Timestamp | null;
  unreadCount: number;
  onPress: () => void;
}

function formatTime(ts: Timestamp | null): string {
  if (!ts) return '';
  const date = ts.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  otherName,
  lastMessage,
  lastMessageTime,
  unreadCount,
  onPress,
}) => {
  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${otherName}`}
    >
      <View style={styles.avatarWrapper}>
        <Avatar name={otherName} size={50} />
        {hasUnread && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.nameBold]} numberOfLines={1}>
            {otherName}
          </Text>
          <Text style={[styles.time, hasUnread && styles.timeUnread]}>
            {formatTime(lastMessageTime)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text
            style={[styles.preview, hasUnread && styles.previewBold]}
            numberOfLines={1}
          >
            {lastMessage || 'No messages yet'}
          </Text>
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.mutedText}
        style={styles.chevron}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.lightGreen,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  nameBold: {
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: colors.mutedText,
  },
  timeUnread: {
    color: colors.primary,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preview: {
    fontSize: 13,
    color: colors.mutedText,
    flex: 1,
    marginRight: 8,
  },
  previewBold: {
    color: colors.text,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: 6,
  },
});
