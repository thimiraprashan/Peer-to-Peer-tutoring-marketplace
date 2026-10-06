import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

interface AvatarProps {
  name: string;
  size?: number;
}

// Helper to extract up to two initials from a name
const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({ name, size = 48 }) => {
  const initials = getInitials(name);
  const fontSize = Math.round(size * 0.4);

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Avatar for ${name}`}
    >
      <Text style={[styles.initialsText, { fontSize }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: colors.primary,
    fontWeight: '700',
  },
});

export default Avatar;
