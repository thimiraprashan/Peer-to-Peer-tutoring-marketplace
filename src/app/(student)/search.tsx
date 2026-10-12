import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/ui/AppButton';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useStudentFavourites } from '../../hooks/useStudentFavourites';
import { fetchTutors } from '../../services/tutorService';
import { colors } from '../../theme/colors';

const SUBJECT_CATEGORIES = ['IT', 'Business', 'Engineering'];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { user } = useCurrentUser();
  const { favouriteIds, toggleFavourite } = useStudentFavourites(user?.uid);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState(q || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [onlyFavourites, setOnlyFavourites] = useState(false);

  // Data fetching state
  const [tutors, setTutors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync param if changed
  useEffect(() => {
    if (q !== undefined) {
      setSearchQuery(q);
    }
  }, [q]);

  // Load tutors
  const loadTutors = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchTutors();
      setTutors(data);
    } catch {
      setError('Unable to load tutors. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTutors();
  }, [loadTutors]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTutors();
  };

  // Filtered tutors computation
  const filteredTutors = useMemo(() => {
    let list = tutors;

    // 1. Favourites filter
    if (onlyFavourites) {
      list = list.filter((tutor) => {
        const id = tutor.tutorId || tutor.id;
        return id && favouriteIds.has(id);
      });
    }

    // 2. Category filter
    // - IT -> module code starts with "IT"
    // - Business -> module code starts with "BM"
    // - Engineering -> module code starts with "EE"
    if (selectedCategory) {
      let requiredPrefix = '';
      if (selectedCategory === 'IT') {
        requiredPrefix = 'IT';
      } else if (selectedCategory === 'Business') {
        requiredPrefix = 'BM';
      } else if (selectedCategory === 'Engineering') {
        requiredPrefix = 'EE';
      }

      if (requiredPrefix) {
        list = list.filter((tutor) => {
          const codes: string[] = [];
          if (tutor.moduleCode && typeof tutor.moduleCode === 'string') {
            codes.push(tutor.moduleCode.trim().toUpperCase());
          }
          if (Array.isArray(tutor.subjects)) {
            for (const s of tutor.subjects) {
              if (typeof s === 'string') {
                codes.push(s.trim().toUpperCase());
              } else if (s?.moduleCode && typeof s.moduleCode === 'string') {
                codes.push(s.moduleCode.trim().toUpperCase());
              } else if (s?.code && typeof s.code === 'string') {
                codes.push(s.code.trim().toUpperCase());
              }
            }
          }
          return codes.some((code) => code.startsWith(requiredPrefix));
        });
      }
    }

    // 3. Search query filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((tutor) => {
        const name = (tutor.name || '').toLowerCase();
        const moduleCode = (tutor.moduleCode || '').toLowerCase();
        const moduleName = (tutor.moduleName || '').toLowerCase();
        const faculty = (tutor.faculty || '').toLowerCase();
        const degree = (tutor.degree || '').toLowerCase();

        return (
          name.includes(query) ||
          moduleCode.includes(query) ||
          moduleName.includes(query) ||
          faculty.includes(query) ||
          degree.includes(query)
        );
      });
    }

    return list;
  }, [tutors, searchQuery, selectedCategory, onlyFavourites, favouriteIds]);

  const favouritesCount = useMemo(() => {
    return tutors.filter((t) => {
      const id = t.tutorId || t.id;
      return id && favouriteIds.has(id);
    }).length;
  }, [tutors, favouriteIds]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setOnlyFavourites(false);
  };

  const renderTutorCard = ({ item }: { item: any }) => {
    const id = item.tutorId || item.id;
    const isFav = id ? favouriteIds.has(id) : false;

    return (
      <Pressable
        key={id}
        onPress={() => {
          if (id) {
            router.push({
              pathname: '/(student)/tutor-profile',
              params: { tutorId: id },
            } as any);
          }
        }}
        style={({ pressed }) => [
          styles.tutorCard,
          pressed && styles.tutorCardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Tutor ${item.name}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatarRow}>
            <Avatar name={item.name || 'Tutor'} size={50} />
            <View style={styles.tutorMeta}>
              <View style={styles.nameRow}>
                <Text style={styles.tutorName} numberOfLines={1}>
                  {item.name || 'Tutor'}
                </Text>
                {item.verified ? <VerifiedBadge /> : null}
              </View>

              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={colors.star} />
                <Text style={styles.ratingText}>
                  {Number(item.ratingAvg || 5.0).toFixed(1)}{' '}
                  <Text style={styles.ratingCount}>
                    ({item.ratingCount || 0})
                  </Text>
                </Text>
                {item.faculty ? (
                  <>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.facultyText} numberOfLines={1}>
                      {item.faculty}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>

          {/* Favourite Heart Button */}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              if (id) toggleFavourite(id);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              isFav ? 'Remove from favourites' : 'Add to favourites'
            }
            style={[
              styles.favButton,
              isFav && styles.favButtonActive,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={20}
              color={isFav ? '#E53935' : colors.mutedText}
            />
          </TouchableOpacity>
        </View>

        {/* Module Badge & Subject details */}
        {item.moduleCode ? (
          <View style={styles.moduleBadgeRow}>
            <View style={styles.moduleCodeBadge}>
              <Text style={styles.moduleCodeText}>{item.moduleCode}</Text>
            </View>
            <Text style={styles.moduleNameText} numberOfLines={1}>
              {item.moduleName || 'Peer Tutor Module'}
            </Text>
          </View>
        ) : null}

        {/* Card Footer: Hourly Rate, Mode, & Action */}
        <View style={styles.cardFooter}>
          <View style={styles.rateCol}>
            <Text style={styles.rateLabel}>Hourly Rate</Text>
            <Text style={styles.rateValue}>
              LKR {Number(item.hourlyRate || 1500).toLocaleString()}/hr
            </Text>
          </View>

          <View style={styles.modeBadge}>
            <Ionicons
              name={item.sessionMode === 'in-person' ? 'people-outline' : 'videocam-outline'}
              size={13}
              color={colors.primary}
            />
            <Text style={styles.modeText}>
              {item.sessionMode === 'in-person' ? 'In-Person' : 'Online'}
            </Text>
          </View>

          <View style={styles.viewProfileBtn}>
            <Text style={styles.viewProfileText}>View Profile →</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedCategory !== null || onlyFavourites;

  return (
    <View
      style={[
        styles.screenWrapper,
        { paddingTop: Math.max(insets.top + 12, 40) },
      ]}
    >
      <StatusBar style="dark" />

      {/* Screen Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Search Tutors</Text>
        <Text style={styles.screenSubtitle}>
          Find peer tutors for your university modules
        </Text>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.mutedText}
          style={styles.searchIcon}
        />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by module code, subject or tutor..."
          placeholderTextColor={colors.mutedText}
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search tutors input"
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={18} color={colors.mutedText} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.filterSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}
          data={[
            { id: 'all', label: 'All', type: 'all' },
            {
              id: 'fav',
              label: `❤️ Favourites${favouritesCount > 0 ? ` (${favouritesCount})` : ''}`,
              type: 'fav',
            },
            ...SUBJECT_CATEGORIES.map((cat) => ({
              id: cat,
              label: cat,
              type: 'category',
            })),
          ]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            let isSelected = false;
            if (item.type === 'all') {
              isSelected = !onlyFavourites && selectedCategory === null;
            } else if (item.type === 'fav') {
              isSelected = onlyFavourites;
            } else {
              isSelected = selectedCategory === item.id;
            }

            return (
              <TouchableOpacity
                onPress={() => {
                  if (item.type === 'all') {
                    setOnlyFavourites(false);
                    setSelectedCategory(null);
                  } else if (item.type === 'fav') {
                    setOnlyFavourites((prev) => !prev);
                  } else {
                    setSelectedCategory((prev) =>
                      prev === item.id ? null : item.id
                    );
                  }
                }}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                  item.type === 'fav' && isSelected && styles.filterChipFavSelected,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Result Status Bar */}
      <View style={styles.resultsMetaBar}>
        <Text style={styles.resultsCountText}>
          {loading
            ? 'Searching tutors...'
            : `${filteredTutors.length} ${filteredTutors.length === 1 ? 'tutor' : 'tutors'} found`}
        </Text>

        {hasActiveFilters ? (
          <TouchableOpacity
            onPress={handleClearFilters}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.clearFiltersLink}>Clear filters</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tutors Results List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingMessage}>Loading tutors...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={colors.error}
          />
          <Text style={styles.errorTitle}>{error}</Text>
          <View style={styles.retryBtnWrapper}>
            <AppButton title="Try Again" onPress={loadTutors} variant="outline" />
          </View>
        </View>
      ) : filteredTutors.length === 0 ? (
        <View style={styles.stateContainer}>
          {onlyFavourites ? (
            <>
              <Ionicons name="heart-dislike-outline" size={48} color={colors.mutedText} />
              <Text style={styles.emptyTitle}>No favourite tutors yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the heart icon on any tutor card to save your favourites for quick access.
              </Text>
              <View style={styles.emptyActionWrapper}>
                <AppButton
                  title="Show All Tutors"
                  onPress={() => setOnlyFavourites(false)}
                  variant="primary"
                />
              </View>
            </>
          ) : (
            <>
              <Ionicons name="search-outline" size={48} color={colors.mutedText} />
              <Text style={styles.emptyTitle}>No matching tutors found</Text>
              <Text style={styles.emptySubtitle}>
                Try searching for a different module code, subject name, or clear your filters.
              </Text>
              {hasActiveFilters ? (
                <View style={styles.emptyActionWrapper}>
                  <AppButton
                    title="Reset Search"
                    onPress={handleClearFilters}
                    variant="outline"
                  />
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredTutors}
          keyExtractor={(item) => item.tutorId || item.id}
          renderItem={renderTutorCard}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: Math.max(insets.bottom + 80, 100) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
  },
  screenSubtitle: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  clearBtn: {
    padding: 4,
  },
  filterSection: {
    marginTop: 12,
  },
  chipsScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipFavSelected: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  filterChipTextSelected: {
    color: colors.card,
  },
  resultsMetaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
  },
  resultsCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
  },
  clearFiltersLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 12,
  },
  tutorCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  tutorCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  tutorMeta: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 4,
  },
  ratingCount: {
    color: colors.mutedText,
    fontWeight: '400',
  },
  metaDot: {
    marginHorizontal: 6,
    color: colors.mutedText,
    fontSize: 12,
  },
  facultyText: {
    fontSize: 12,
    color: colors.mutedText,
    flexShrink: 1,
  },
  favButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  favButtonActive: {
    backgroundColor: '#FEE2E2',
  },
  moduleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  moduleCodeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moduleCodeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  moduleNameText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F5EE',
  },
  rateCol: {
    justifyContent: 'center',
  },
  rateLabel: {
    fontSize: 10,
    color: colors.mutedText,
    textTransform: 'uppercase',
  },
  rateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  viewProfileBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewProfileText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingMessage: {
    marginTop: 10,
    fontSize: 14,
    color: colors.mutedText,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  errorTitle: {
    fontSize: 15,
    color: colors.error,
    textAlign: 'center',
    marginTop: 12,
  },
  retryBtnWrapper: {
    marginTop: 16,
    width: 140,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  emptyActionWrapper: {
    marginTop: 18,
    width: 180,
  },
});
