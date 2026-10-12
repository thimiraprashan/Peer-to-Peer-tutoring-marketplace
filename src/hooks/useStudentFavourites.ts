import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import {
  addFavourite,
  getFavouriteTutorIds,
  removeFavourite,
} from '../services/favouriteService';

const STORAGE_PREFIX = '@peer_tutor_favourites_';

export function useStudentFavourites(studentId: string | undefined) {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [loadingFavourites, setLoadingFavourites] = useState<boolean>(true);

  // Load from local storage first, then sync with Firestore
  const loadFavourites = useCallback(async () => {
    if (!studentId) {
      setFavouriteIds(new Set());
      setLoadingFavourites(false);
      return;
    }

    const storageKey = `${STORAGE_PREFIX}${studentId}`;

    // 1. Load instantly from local storage
    try {
      const cached = await AsyncStorage.getItem(storageKey);
      if (cached) {
        const parsed: string[] = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setFavouriteIds(new Set(parsed));
        }
      }
    } catch (e) {
      console.warn('Error reading favourites cache:', e);
    }

    // 2. Fetch latest from Firestore and merge
    try {
      const remoteIds = await getFavouriteTutorIds(studentId);
      if (Array.isArray(remoteIds)) {
        setFavouriteIds((prev) => {
          const merged = new Set([...Array.from(prev), ...remoteIds]);
          AsyncStorage.setItem(storageKey, JSON.stringify(Array.from(merged))).catch(
            () => {}
          );
          return merged;
        });
      }
    } catch (e) {
      console.warn('Error fetching remote favourites:', e);
    } finally {
      setLoadingFavourites(false);
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      loadFavourites();
    }, [loadFavourites])
  );

  const isFavourite = useCallback(
    (tutorId: string) => {
      if (!tutorId) return false;
      return favouriteIds.has(tutorId);
    },
    [favouriteIds]
  );

  const toggleFavourite = useCallback(
    async (tutorId: string): Promise<boolean> => {
      if (!studentId || !tutorId) {
        return false;
      }

      const currentlyFav = favouriteIds.has(tutorId);
      const nextFav = !currentlyFav;
      const storageKey = `${STORAGE_PREFIX}${studentId}`;

      // Optimistically update state
      setFavouriteIds((prev) => {
        const next = new Set(prev);
        if (currentlyFav) {
          next.delete(tutorId);
        } else {
          next.add(tutorId);
        }
        AsyncStorage.setItem(storageKey, JSON.stringify(Array.from(next))).catch(() => {});
        return next;
      });

      // Sync with Firestore in background
      try {
        if (currentlyFav) {
          await removeFavourite(studentId, tutorId);
        } else {
          await addFavourite(studentId, tutorId);
        }
      } catch (err) {
        console.warn('Firestore favourite sync warning:', err);
        // We do NOT revert local cache so user keeps their favourite offline/resiliently
      }

      return nextFav;
    },
    [studentId, favouriteIds]
  );

  return {
    favouriteIds,
    isFavourite,
    loadFavourites,
    toggleFavourite,
    loadingFavourites,
  };
}
