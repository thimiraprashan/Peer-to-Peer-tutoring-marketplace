import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Adds a new saved module document to the savedModules collection.
 * Rejects duplicates for the same studentId and moduleCode.
 */
export const addSavedModule = async (studentId, moduleCode, moduleName) => {
  const normalizedCode = moduleCode.trim().toUpperCase();
  const trimmedName = moduleName.trim();

  // Check for existing duplicate module for this student
  const q = query(
    collection(db, 'savedModules'),
    where('studentId', '==', studentId),
    where('moduleCode', '==', normalizedCode)
  );

  const existingDocs = await getDocs(q);
  if (!existingDocs.empty) {
    throw new Error('This module is already in your saved list.');
  }

  // Create document in savedModules collection
  const docRef = await addDoc(collection(db, 'savedModules'), {
    studentId,
    moduleCode: normalizedCode,
    moduleName: trimmedName,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    studentId,
    moduleCode: normalizedCode,
    moduleName: trimmedName,
  };
};

/**
 * Reads all saved modules for a student and sorts newest first in JavaScript.
 */
export const getSavedModules = async (studentId) => {
  if (!studentId) return [];

  const q = query(
    collection(db, 'savedModules'),
    where('studentId', '==', studentId)
  );

  const snap = await getDocs(q);
  const modules = [];
  snap.forEach((d) => {
    modules.push({ id: d.id, ...d.data() });
  });

  // Sort newest first in JavaScript using createdAt timestamp or fallback
  modules.sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
    return timeB - timeA;
  });

  return modules;
};

/**
 * Deletes a saved module by its document ID.
 */
export const removeSavedModule = async (docId) => {
  await deleteDoc(doc(db, 'savedModules', docId));
};
