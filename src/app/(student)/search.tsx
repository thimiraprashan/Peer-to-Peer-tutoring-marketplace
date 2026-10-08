import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Avatar } from '../../components/ui/Avatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { AppButton } from '../../components/ui/AppButton';
import { formatNextSlot, searchTutors } from '../../services/tutorService';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();

  // Search input state
  const [searchText, setSearchText] = useState(params.q || '');
  const [debouncedQuery, setDebouncedQuery] = useState(params.q || '');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Raw tutors loaded from service
  const [rawTutors, setRawTutors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sort state: 'top_rated' | 'lowest_price'
  const [sortBy, setSortBy] = useState<'top_rated' | 'lowest_price'>('top_rated');

  // Filter state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null); // null (Any), 4, 4.5
  const [maxPrice, setMaxPrice] = useState<number | null>(null); // null (Any), 1000, 1500, 2000
  const [sessionMode, setSessionMode] = useState<string>('Any'); // 'Any' | 'online' | 'face'
  const [onlyAvailableSlots, setOnlyAvailableSlots] = useState<boolean>(false);

  // Staged filter state (in modal before Apply)
  const [tempMinRating, setTempMinRating] = useState<number | null>(null);
  const [tempMaxPrice, setTempMaxPrice] = useState<number | null>(null);
  const [tempSessionMode, setTempSessionMode] = useState<string>('Any');
  const [tempOnlyAvailable, setTempOnlyAvailable] = useState<boolean>(false);

  // Active filters count badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (minRating !== null) count++;
    if (maxPrice !== null) count++;
    if (sessionMode !== 'Any') count++;
    if (onlyAvailableSlots) count++;
    return count;
  }, [minRating, maxPrice, sessionMode, onlyAvailableSlots]);

  // Fetch tutors from service
  const loadSearchResults = useCallback(async (query: string) => {
    setError(null);
    try {
      const data = await searchTutors(query);
      setRawTutors(data);
    } catch {
      setError('Unable to load tutors. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Sync param changes (e.g. navigation with new q param)
  useEffect(() => {
    if (typeof params.q === 'string' && params.q !== searchText) {
      setSearchText(params.q);
      setDebouncedQuery(params.q);
    }
  }, [params.q]);

  // Handle typing with 400ms debounce
  const handleTextChange = (text: string) => {
    setSearchText(text);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(text);
    }, 400);
  };

  // Immediate search on keyboard Search key
  const handleSearchSubmit = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setDebouncedQuery(searchText);
  };

  // Clear text
  const handleClearText = () => {
    setSearchText('');
    setDebouncedQuery('');
  };

  // Fetch when debouncedQuery changes
  useEffect(() => {
    setLoading(true);
    loadSearchResults(debouncedQuery);
  }, [debouncedQuery, loadSearchResults]);

  // Pull to refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadSearchResults(debouncedQuery);
  };

  // Open filter modal and stage current values
  const handleOpenFilterModal = () => {
    setTempMinRating(minRating);
    setTempMaxPrice(maxPrice);
    setTempSessionMode(sessionMode);
    setTempOnlyAvailable(onlyAvailableSlots);
    setFilterModalVisible(true);
  };

  // Apply filters from modal
  const handleApplyFilters = () => {
    setMinRating(tempMinRating);
    setMaxPrice(tempMaxPrice);
    setSessionMode(tempSessionMode);
    setOnlyAvailableSlots(tempOnlyAvailable);
    setFilterModalVisible(false);
  };

  // Reset filters
  const handleResetFilters = () => {
    setTempMinRating(null);
    setTempMaxPrice(null);
    setTempSessionMode('Any');
    setTempOnlyAvailable(false);
    setMinRating(null);
    setMaxPrice(null);
    setSessionMode('Any');
    setOnlyAvailableSlots(false);
    setFilterModalVisible(false);
  };

  // Filter & Sort in JavaScript
  const filteredAndSortedTutors = useMemo(() => {
    let result = [...rawTutors];

    // Filter by min rating
    if (minRating !== null) {
      result = result.filter((t) => (t.ratingAvg || 0) >= minRating);
    }

    // Filter by max price
    if (maxPrice !== null) {
      result = result.filter((t) => (t.hourlyRate || 0) <= maxPrice);
    }

    // Filter by session mode
    if (sessionMode !== 'Any') {
      result = result.filter((t) => {
        const mode = (t.sessionMode || '').toLowerCase();
        return mode === sessionMode.toLowerCase() || mode === 'both';
      });
    }

    // Filter by available slots
    if (onlyAvailableSlots) {
      result = result.filter((t) => t.nextSlot !== null);
    }

    // Sort
    if (sortBy === 'top_rated') {
      result.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
    } else if (sortBy === 'lowest_price') {
      result.sort((a, b) => (a.hourlyRate || 0) - (b.hourlyRate || 0));
    }

    return result;
  }, [rawTutors, minRating, maxPrice, sessionMode, onlyAvailableSlots, sortBy]);

  // Back navigation
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(student)' as any);
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <StatusBar style="dark" />

      {/* 1. Mint Header */}
      <View
        style={[
          styles.headerBar,
          { paddingTop: Math.max(insets.top + 8, 40) },
        ]}
      >
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Search Results</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 84, 96) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* 2. Search Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.mutedText}
              style={styles.searchIcon}
            />
            <TextInput
              value={searchText}
              onChangeText={handleTextChange}
              placeholder="Search module code or name..."
              placeholderTextColor={colors.mutedText}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
              accessibilityLabel="Search input"
              style={styles.searchInput}
            />
            {searchText.length > 0 ? (
              <Pressable
                onPress={handleClearText}
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
                style={styles.clearButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={colors.mutedText} />
              </Pressable>
            ) : null}
          </View>

          {/* Filter Button */}
          <Pressable
            onPress={handleOpenFilterModal}
            accessibilityRole="button"
            accessibilityLabel="Filter tutors"
            style={styles.filterButton}
          >
            <Ionicons name="options-outline" size={20} color={colors.primary} />
            <Text style={styles.filterButtonText}>Filter</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* 6. Sort Chips */}
        <View style={styles.sortChipsRow}>
          <Pressable
            onPress={() => setSortBy('top_rated')}
            accessibilityRole="button"
            accessibilityLabel="Sort by top rated"
            style={[
              styles.sortChip,
              sortBy === 'top_rated' ? styles.sortChipActive : styles.sortChipInactive,
            ]}
          >
            <Text
              style={[
                styles.sortChipText,
                sortBy === 'top_rated'
                  ? styles.sortChipTextActive
                  : styles.sortChipTextInactive,
              ]}
            >
              Top rated
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSortBy('lowest_price')}
            accessibilityRole="button"
            accessibilityLabel="Sort by lowest price"
            style={[
              styles.sortChip,
              sortBy === 'lowest_price'
                ? styles.sortChipActive
                : styles.sortChipInactive,
            ]}
          >
            <Text
              style={[
                styles.sortChipText,
                sortBy === 'lowest_price'
                  ? styles.sortChipTextActive
                  : styles.sortChipTextInactive,
              ]}
            >
              Lowest price
            </Text>
          </Pressable>
        </View>

        {/* 3. Result Count Line */}
        {!loading && !error ? (
          <Text style={styles.resultCountText}>
            {filteredAndSortedTutors.length === 1
              ? '1 tutor found'
              : `${filteredAndSortedTutors.length} tutors found`}
          </Text>
        ) : null}

        {/* 4. Tutor Cards / Loading / Error / Empty States */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={38} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <View style={styles.retryButtonWrapper}>
              <AppButton
                title="Try again"
                onPress={() => loadSearchResults(debouncedQuery)}
                variant="outline"
              />
            </View>
          </View>
        ) : filteredAndSortedTutors.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="search-outline" size={44} color={colors.mutedText} />
            <Text style={styles.emptyText}>
              No tutors found. Try another module code or clear the filters.
            </Text>
            {activeFilterCount > 0 ? (
              <View style={styles.clearFiltersBtnWrapper}>
                <AppButton
                  title="Clear filters"
                  onPress={handleResetFilters}
                  variant="outline"
                />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.tutorCardsList}>
            {filteredAndSortedTutors.map((tutor) => (
              <Pressable
                key={tutor.tutorId}
                onPress={() => {
                  // TODO: Navigate to tutor profile screen once implemented
                }}
                accessibilityRole="button"
                accessibilityLabel={`Tutor ${tutor.name}`}
                style={({ pressed }) => [
                  styles.tutorCard,
                  pressed && styles.tutorCardPressed,
                ]}
              >
                {/* Top Row: Avatar, Name, Rating, Heart placeholder & Verified */}
                <View style={styles.cardTopRow}>
                  <Avatar name={tutor.name} size={48} />
                  <View style={styles.tutorNameContainer}>
                    <Text style={styles.tutorNameText}>{tutor.name}</Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={14} color={colors.star} />
                      <Text style={styles.ratingText}>
                        {Number(tutor.ratingAvg || 5).toFixed(1)}{' '}
                        <Text style={styles.ratingCount}>
                          ({tutor.ratingCount || 0})
                        </Text>
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardTopRight}>
                    {/* TODO: Heart favorite button will go here */}
                    {tutor.verified ? <VerifiedBadge /> : null}
                  </View>
                </View>

                {/* Middle Module Row */}
                <Text style={styles.moduleNameText} numberOfLines={1}>
                  {tutor.moduleCode}
                  {tutor.moduleName ? ` - ${tutor.moduleName}` : ''}
                </Text>

                {/* Thin Divider */}
                <View style={styles.divider} />

                {/* Bottom Row: Price & Next Slot */}
                <View style={styles.cardBottomRow}>
                  <Text style={styles.priceText}>
                    Rs. {Number(tutor.hourlyRate || 0).toLocaleString()} / hour
                  </Text>
                  <Text
                    style={[
                      styles.nextSlotText,
                      !tutor.nextSlot && styles.nextSlotEmpty,
                    ]}
                  >
                    Next: {formatNextSlot(tutor.nextSlot)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 5. Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Tutors</Text>
              <Pressable
                onPress={() => setFilterModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* Filter 1: Minimum Rating */}
            <Text style={styles.filterGroupLabel}>Minimum Rating</Text>
            <View style={styles.modalChipsRow}>
              {[
                { label: 'Any', value: null },
                { label: '4+', value: 4 },
                { label: '4.5+', value: 4.5 },
              ].map((item) => {
                const isSelected = tempMinRating === item.value;
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => setTempMinRating(item.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Minimum rating ${item.label}`}
                    style={[
                      styles.modalChip,
                      isSelected ? styles.modalChipSelected : styles.modalChipUnselected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        isSelected
                          ? styles.modalChipTextSelected
                          : styles.modalChipTextUnselected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Filter 2: Maximum Price Per Hour */}
            <Text style={styles.filterGroupLabel}>Maximum Price per Hour</Text>
            <View style={styles.modalChipsRow}>
              {[
                { label: 'Any', value: null },
                { label: 'Rs. 1000', value: 1000 },
                { label: 'Rs. 1500', value: 1500 },
                { label: 'Rs. 2000', value: 2000 },
              ].map((item) => {
                const isSelected = tempMaxPrice === item.value;
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => setTempMaxPrice(item.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Maximum price ${item.label}`}
                    style={[
                      styles.modalChip,
                      isSelected ? styles.modalChipSelected : styles.modalChipUnselected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        isSelected
                          ? styles.modalChipTextSelected
                          : styles.modalChipTextUnselected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Filter 3: Session Mode */}
            <Text style={styles.filterGroupLabel}>Session Mode</Text>
            <View style={styles.modalChipsRow}>
              {[
                { label: 'Any', value: 'Any' },
                { label: 'Online', value: 'online' },
                { label: 'In-person', value: 'face' },
              ].map((item) => {
                const isSelected = tempSessionMode === item.value;
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => setTempSessionMode(item.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Session mode ${item.label}`}
                    style={[
                      styles.modalChip,
                      isSelected ? styles.modalChipSelected : styles.modalChipUnselected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        isSelected
                          ? styles.modalChipTextSelected
                          : styles.modalChipTextUnselected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Filter 4: Available Slots Switch */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Only tutors with available slots</Text>
              <Switch
                value={tempOnlyAvailable}
                onValueChange={setTempOnlyAvailable}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            {/* Filter Modal Action Buttons */}
            <View style={styles.modalActionButtons}>
              <View style={styles.actionBtnFlex}>
                <AppButton title="Reset" onPress={handleResetFilters} variant="outline" />
              </View>
              <View style={styles.actionBtnFlex}>
                <AppButton title="Apply" onPress={handleApplyFilters} variant="primary" />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerRightSpacer: {
    width: 48,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 50,
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
    fontSize: 14,
    color: colors.text,
  },
  clearButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 14,
    minWidth: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    position: 'relative',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: colors.card,
    fontSize: 11,
    fontWeight: '700',
  },
  sortChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sortChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortChipActive: {
    backgroundColor: colors.primary,
  },
  sortChipInactive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: colors.card,
  },
  sortChipTextInactive: {
    color: colors.text,
  },
  resultCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
    marginBottom: 12,
  },
  centerContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  stateCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  clearFiltersBtnWrapper: {
    marginTop: 16,
    width: 150,
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
  tutorCardsList: {
    gap: 12,
  },
  tutorCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
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
    opacity: 0.9,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tutorNameContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  tutorNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
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
  cardTopRight: {
    alignItems: 'flex-end',
  },
  moduleNameText: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  nextSlotText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  nextSlotEmpty: {
    color: colors.mutedText,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  filterGroupLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  modalChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalChipSelected: {
    backgroundColor: colors.primary,
  },
  modalChipUnselected: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalChipTextSelected: {
    color: colors.card,
  },
  modalChipTextUnselected: {
    color: colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 18,
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  actionBtnFlex: {
    flex: 1,
  },
});
