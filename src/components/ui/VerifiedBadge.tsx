import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export const VerifiedBadge: React.FC = () => {
  return (
    <View
      style={styles.badge}
      accessibilityRole="text"
      accessibilityLabel="Verified tutor"
    >
      <Ionicons
        name="checkmark-circle"
        size={14}
        color={colors.primary}
        style={styles.icon}
      />
      <Text style={styles.text}>Verified</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default VerifiedBadge;
