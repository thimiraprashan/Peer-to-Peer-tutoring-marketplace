import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Adds a tutor to a student's favourites using composite document ID {studentId}_{tutorId} to avoid duplicates.
 */
export const addFavourite = async (studentId, tutorId) => {
  if (!studentId || !tutorId) throw new Error('studentId and tutorId are required');
  const docId = `${studentId}_${tutorId}`;
  await setDoc(doc(db, 'favourites', docId), {
    studentId,
    tutorId,
    createdAt: serverTimestamp(),
  });
};

/**
 * Removes a tutor from a student's favourites.
 */
export const removeFavourite = async (studentId, tutorId) => {
  if (!studentId || !tutorId) throw new Error('studentId and tutorId are required');
  const docId = `${studentId}_${tutorId}`;
  await deleteDoc(doc(db, 'favourites', docId));
};

/**
 * Retrieves all favourite tutor IDs for a given student.
 */
export const getFavouriteTutorIds = async (studentId) => {
  if (!studentId) return [];
  const q = query(
    collection(db, 'favourites'),
    where('studentId', '==', studentId)
  );
  const snap = await getDocs(q);
  const tutorIds = [];
  snap.forEach((d) => {
    const data = d.data();
    if (data.tutorId) {
      tutorIds.push(data.tutorId);
    }
  });
  return tutorIds;
};
