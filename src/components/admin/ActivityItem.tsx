import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AdminActivityItem } from '../../services/adminService';

interface ActivityItemProps {
  item: AdminActivityItem;
  onPress: () => void;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({ item, onPress }) => {
  const getIconConfig = () => {
    switch (item.type) {
      case 'verification':
        return {
          icon: 'shield-outline' as keyof typeof Ionicons.glyphMap,
          color: '#D97706',
          bg: '#FEF3C7',
        };
      case 'report':
        return {
          icon: 'alert-circle-outline' as keyof typeof Ionicons.glyphMap,
          color: '#DC2626',
          bg: '#FEE2E2',
        };
      case 'user':
        return {
          icon: 'person-add-outline' as keyof typeof Ionicons.glyphMap,
          color: colors.primary,
          bg: colors.lightGreen,
        };
      default:
        return {
          icon: 'notifications-outline' as keyof typeof Ionicons.glyphMap,
          color: colors.primary,
          bg: colors.lightGreen,
        };
    }
  };

  const getTagStyle = () => {
    switch (item.tagType) {
      case 'warning':
        return { bg: '#FEF3C7', text: '#B45309' };
      case 'error':
        return { bg: '#FEE2E2', text: '#B91C1C' };
      case 'success':
        return { bg: '#DCFCE7', text: '#15803D' };
      case 'info':
        return { bg: '#E0F2FE', text: '#0369A1' };
      default:
        return { bg: '#F3F4F6', text: '#4B5563' };
    }
  };

  const iconConfig = getIconConfig();
  const tagStyle = getTagStyle();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.description}, ${item.timestamp}`}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconConfig.bg }]}>
        <Ionicons name={iconConfig.icon} size={20} color={iconConfig.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.titleText} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.timeText}>{item.timestamp}</Text>
        </View>

        <Text style={styles.descriptionText} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.bottomRow}>
          <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg }]}>
            <Text style={[styles.tagText, { color: tagStyle.text }]}>
              {item.tag}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  containerPressed: {
    opacity: 0.9,
    backgroundColor: '#F9FCF8',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: colors.mutedText,
  },
  descriptionText: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default ActivityItem;
