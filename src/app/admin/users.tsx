import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AppButton } from '../../components/ui/AppButton';

export default function AdminUsersPlaceholder() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="people" size={32} color={colors.primary} />
        </View>
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>
          This section will be implemented in the subsequent phase.
        </Text>
        <View style={styles.buttonWrapper}>
          <AppButton
            title="Back to Dashboard"
            onPress={() => router.replace('/admin' as any)}
            variant="outline"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  buttonWrapper: {
    width: '100%',
  },
});
