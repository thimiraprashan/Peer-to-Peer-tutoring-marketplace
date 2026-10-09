import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [searchQuery, setSearchQuery] = useState(q || '');

  useEffect(() => {
    if (q) {
      setSearchQuery(q);
    }
  }, [q]);

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 16, 44) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>Find peer tutors for your modules</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.mutedText}
          style={styles.searchIcon}
        />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by module code (e.g., IT3010)"
          placeholderTextColor={colors.mutedText}
          style={styles.searchInput}
          autoCapitalize="characters"
          accessibilityLabel="Search modules"
        />
        {searchQuery ? (
          <Ionicons
            name="close-circle"
            size={18}
            color={colors.mutedText}
            onPress={() => setSearchQuery('')}
          />
        ) : null}
      </View>

      {searchQuery ? (
        <View style={styles.activeQueryBadge}>
          <Text style={styles.activeQueryText}>
            Filter applied:{' '}
            <Text style={styles.highlightText}>{searchQuery}</Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  activeQueryBadge: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.lightGreen,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  activeQueryText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  highlightText: {
    fontWeight: '700',
  },
});
