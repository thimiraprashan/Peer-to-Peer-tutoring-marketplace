import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Loads featured tutors from tutorSubjects and joins with tutors and users collections.
 * Removes duplicate tutors and performs client-side filtering to avoid Firestore composite index requirements.
 */
export const getFeaturedTutors = async (subjectArea = null) => {
  // 1. Fetch tutorSubjects collection
  const tutorSubjectsSnap = await getDocs(collection(db, 'tutorSubjects'));
  let subjects = [];
  tutorSubjectsSnap.forEach((d) => {
    subjects.push({ id: d.id, ...d.data() });
  });

  // 2. Filter by subjectArea in JS if provided
  if (subjectArea) {
    subjects = subjects.filter(
      (s) =>
        s.subjectArea &&
        s.subjectArea.toLowerCase() === subjectArea.toLowerCase()
    );
  }

  // 3. Remove duplicate tutors by tutorId (keep first subject entry)
  const uniqueByTutor = new Map();
  for (const s of subjects) {
    if (s.tutorId && !uniqueByTutor.has(s.tutorId)) {
      uniqueByTutor.set(s.tutorId, s);
    }
  }

  // 4. Fetch details from tutors/{tutorId} and users/{tutorId} for each unique tutor
  const tutorsList = [];
  for (const [tutorId, subject] of uniqueByTutor.entries()) {
    try {
      const [tutorDocSnap, userDocSnap] = await Promise.all([
        getDoc(doc(db, 'tutors', tutorId)),
        getDoc(doc(db, 'users', tutorId)),
      ]);

      const tutorData = tutorDocSnap.exists() ? tutorDocSnap.data() : {};
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};

      tutorsList.push({
        tutorId,
        name: userData.name || 'Tutor',
        moduleCode: subject.moduleCode || '',
        moduleName: subject.moduleName || '',
        ratingAvg: tutorData.ratingAvg ?? 5.0,
        ratingCount: tutorData.ratingCount ?? 0,
        verified: !!tutorData.verified,
        hourlyRate: tutorData.hourlyRate ?? 0,
      });
    } catch (err) {
      console.error(`Failed to load details for tutor ${tutorId}:`, err);
    }
  }

  return tutorsList;
};
