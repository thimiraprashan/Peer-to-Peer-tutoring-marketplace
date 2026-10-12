import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert } from 'react-native';
import {
  addFavourite,
  getFavouriteTutorIds,
  removeFavourite,
} from '../services/favouriteService';

export function useStudentFavourites(studentId: string | undefined) {
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());

  const loadFavourites = useCallback(async () => {
    if (!studentId) {
      setFavouriteIds(new Set());
      return;
    }
    try {
      const ids = await getFavouriteTutorIds(studentId);
      setFavouriteIds(new Set(ids));
    } catch {
      // Keep existing UI state if load fails (e.g. rules not deployed yet)
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      loadFavourites();
    }, [loadFavourites])
  );

  const toggleFavourite = useCallback(
    async (tutorId: string) => {
      if (!studentId) {
        Alert.alert('Sign in required', 'Please log in to save favourite tutors.');
        return;
      }

      const isFav = favouriteIds.has(tutorId);

      setFavouriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) {
          next.delete(tutorId);
        } else {
          next.add(tutorId);
        }
        return next;
      });

      try {
        if (isFav) {
          await removeFavourite(studentId, tutorId);
        } else {
          await addFavourite(studentId, tutorId);
        }
      } catch {
        setFavouriteIds((prev) => {
          const next = new Set(prev);
          if (isFav) {
            next.add(tutorId);
          } else {
            next.delete(tutorId);
          }
          return next;
        });
        Alert.alert('Error', 'Could not update favourites. Please try again.');
      }
    },
    [studentId, favouriteIds]
  );

  return { favouriteIds, loadFavourites, toggleFavourite };
}
