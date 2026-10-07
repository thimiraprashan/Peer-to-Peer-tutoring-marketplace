import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBgColor?: string;
  iconColor?: string;
  badgeText?: string;
  badgeVariant?: 'default' | 'warning' | 'error' | 'success';
  onPress?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  iconBgColor = colors.lightGreen,
  iconColor = colors.primary,
  badgeText,
  badgeVariant = 'default',
  onPress,
}) => {
  const getBadgeStyle = () => {
    switch (badgeVariant) {
      case 'warning':
        return { bg: '#FEF3C7', text: '#B45309' };
      case 'error':
        return { bg: '#FEE2E2', text: '#B91C1C' };
      case 'success':
        return { bg: '#DCFCE7', text: '#15803D' };
      default:
        return { bg: colors.lightGreen, text: colors.primary };
    }
  };

  const badgeStyle = getBadgeStyle();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrapper, { backgroundColor: iconBgColor }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        {badgeText ? (
          <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
            <Text style={[styles.badgeText, { color: badgeStyle.text }]}>
              {badgeText}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.valueText}>{value}</Text>
      <Text style={styles.labelText}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 124,
    justifyContent: 'space-between',
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  valueText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedText,
    marginTop: 2,
  },
});

export default StatCard;
