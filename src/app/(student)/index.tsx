import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { AppButton } from '../../components/ui/AppButton';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { getFeaturedTutors } from '../../services/tutorService';

const FILTER_SUBJECTS = ['IT', 'Business', 'Engineering'];

export default function StudentHome() {
  const router = useRouter();
  const { profile } = useCurrentUser();

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Tutors list state
  const [tutors, setTutors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tutors from service
  const loadTutors = useCallback(async (subject: string | null) => {
    setError(null);
    try {
      const data = await getFeaturedTutors(subject);
      setTutors(data);
    } catch (err: any) {
      console.error('Error loading tutors:', err);
      setError('Unable to load tutors. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch when filter chip changes
  useEffect(() => {
    setLoading(true);
    loadTutors(selectedSubject);
  }, [selectedSubject, loadTutors]);

  // Pull to refresh handler
  const handleRefresh = () => {
    setRefreshing(true);
    loadTutors(selectedSubject);
  };

  // Toggle filter chip
  const handleChipPress = (subject: string) => {
    setSelectedSubject((prev) => (prev === subject ? null : subject));
  };

  // Handle Search input enter/submit
  const handleSearchSubmit = () => {
    const query = searchQuery.trim();
    if (query) {
      router.push({
        pathname: '/(student)/search',
        params: { q: query },
      } as any);
    } else {
      router.push('/(student)/search' as any);
    }
  };

  // Extract first name for greeting
  const firstName = profile?.name ? profile.name.trim().split(' ')[0] : 'Student';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* 1. Header greeting area */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingText}>Hi {firstName} 👋</Text>
          <Text style={styles.subGreetingText}>Ready to learn today?</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(student)/profile' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Avatar name={profile?.name || 'Student'} size={48} />
        </Pressable>
      </View>

      {/* 2 & 3. Hero Card with Search */}
      <View style={styles.heroCard}>
        <Text style={styles.heroHeading}>What do you need help with?</Text>

        {/* Search Bar */}
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
            placeholder="Type module name (e.g., IT3010)"
            placeholderTextColor={colors.mutedText}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
            accessibilityLabel="Search modules"
            style={styles.searchInput}
          />
        </View>

        {/* 4. Horizontal filter chips */}
        <View style={styles.chipsRow}>
          {FILTER_SUBJECTS.map((subject) => {
            const isSelected = selectedSubject === subject;
            return (
              <Pressable
                key={subject}
                onPress={() => handleChipPress(subject)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${subject}`}
                style={[
                  styles.chip,
                  isSelected ? styles.chipSelected : styles.chipOutline,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected ? styles.chipTextSelected : styles.chipTextOutline,
                  ]}
                >
                  {subject}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 5. Tutors Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tutors</Text>
        <Pressable
          onPress={() => router.push('/(student)/search' as any)}
          accessibilityRole="button"
          accessibilityLabel="See all tutors"
        >
          <Text style={styles.seeAllText}>See All →</Text>
        </Pressable>
      </View>

      {/* Tutors loading / error / empty / list */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.retryButtonWrapper}>
            <AppButton
              title="Try again"
              onPress={() => loadTutors(selectedSubject)}
              variant="outline"
            />
          </View>
        </View>
      ) : tutors.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons name="school-outline" size={40} color={colors.mutedText} />
          <Text style={styles.emptyText}>No tutors found for this subject</Text>
        </View>
      ) : (
        <View style={styles.tutorsList}>
          {tutors.map((tutor) => (
            <Pressable
              key={tutor.tutorId}
              onPress={() => {
                // TODO: Navigate to tutor profile screen once implemented
              }}
              style={({ pressed }) => [
                styles.tutorCard,
                pressed && styles.tutorCardPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Tutor ${tutor.name}`}
            >
              <Avatar name={tutor.name} size={46} />

              <View style={styles.tutorInfo}>
                <Text style={styles.tutorName}>{tutor.name}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color={colors.star} />
                  <Text style={styles.ratingText}>
                    {Number(tutor.ratingAvg || 5).toFixed(1)}{' '}
                    <Text style={styles.ratingCount}>
                      ({tutor.ratingCount || 0})
                    </Text>
                  </Text>
                </View>
                <Text style={styles.moduleText} numberOfLines={1}>
                  {tutor.moduleCode}
                  {tutor.moduleName ? ` - ${tutor.moduleName}` : ''}
                </Text>
              </View>

              {tutor.verified ? (
                <View style={styles.badgeWrapper}>
                  <VerifiedBadge />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      {/* 6. Upcoming Bookings Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
      </View>
      {/* TODO: Member 2's bookings collection will feed this later */}
      <View style={styles.bookingPlaceholderCard}>
        <Ionicons
          name="calendar-outline"
          size={32}
          color={colors.mutedText}
          style={styles.calendarIcon}
        />
        <Text style={styles.bookingPlaceholderText}>
          No upcoming bookings yet
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 90, // Prevents content from hiding behind the tab bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subGreetingText: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 24,
  },
  heroHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D0DDD0',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.card,
  },
  chipTextOutline: {
    color: colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  centerContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  stateCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButtonWrapper: {
    marginTop: 12,
    width: 140,
  },
  tutorsList: {
    gap: 10,
    marginBottom: 24,
  },
  tutorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tutorCardPressed: {
    opacity: 0.9,
  },
  tutorInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  ratingCount: {
    color: colors.mutedText,
    fontWeight: '400',
  },
  moduleText: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  badgeWrapper: {
    alignSelf: 'center',
  },
  bookingPlaceholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 24,
  },
  calendarIcon: {
    marginRight: 12,
  },
  bookingPlaceholderText: {
    fontSize: 14,
    color: colors.mutedText,
  },
});
