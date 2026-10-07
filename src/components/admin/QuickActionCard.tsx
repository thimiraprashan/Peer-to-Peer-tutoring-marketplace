import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface QuickActionCardProps {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBgColor?: string;
  iconColor?: string;
  badgeText?: string;
  badgeColor?: string;
  onPress: () => void;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  subtitle,
  icon,
  iconBgColor = colors.lightGreen,
  iconColor = colors.primary,
  badgeText,
  badgeColor = colors.primary,
  onPress,
}) => {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>

      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.titleText}>{title}</Text>
          {badgeText ? (
            <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
              <Text style={[styles.badgeText, { color: badgeColor }]}>
                {badgeText}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.subtitleText}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    minHeight: 68,
  },
  containerPressed: {
    opacity: 0.9,
    backgroundColor: '#F9FCF8',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  subtitleText: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default QuickActionCard;
