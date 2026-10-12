import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

// ============================================================
// HELPERS
// ============================================================

/**
 * Shared validation for rating and comment.
 * Throws an Error with a user-friendly message on failure.
 */
const validateReview = (rating, comment) => {
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    throw new Error("Please select a star rating between 1 and 5.");
  }
  const trimmed = (comment || "").trim();
  if (trimmed.length < 5) {
    throw new Error("Your review must be at least 5 characters long.");
  }
  if (trimmed.length > 300) {
    throw new Error("Your review must be 300 characters or fewer.");
  }
};

// ============================================================
// RATING RECOMPUTATION
// Called by other team members (e.g. after booking completion).
// ============================================================

/**
 * Recompute ratingAvg and ratingCount for a tutor from all reviews,
 * then write the result back to tutors/{tutorId}.
 */
export const recomputeRating = async (tutorId) => {
  if (!tutorId) return;
  const q = query(collection(db, "reviews"), where("tutorId", "==", tutorId));
  const snap = await getDocs(q);

  if (snap.empty) {
    await updateDoc(doc(db, "tutors", tutorId), {
      ratingAvg: 0,
      ratingCount: 0,
    });
    return;
  }

  let total = 0;
  snap.forEach((d) => {
    total += Number(d.data().rating) || 0;
  });
  const ratingCount = snap.size;
  const ratingAvg = Math.round((total / ratingCount) * 10) / 10;

  await updateDoc(doc(db, "tutors", tutorId), { ratingAvg, ratingCount });
};

// ============================================================
// READ
// ============================================================

/**
 * Fetch all reviews for a tutor, sorted newest first.
 * Returns an array of { id, tutorId, studentId, studentName, rating, comment, createdAt, updatedAt }.
 */
export const getReviewsForTutor = async (tutorId) => {
  if (!tutorId) return [];
  const q = query(collection(db, "reviews"), where("tutorId", "==", tutorId));
  const snap = await getDocs(q);
  const reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Sort newest first in JavaScript (avoids composite index requirement)
  reviews.sort((a, b) => {
    const tsA = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
    const tsB = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
    return tsB - tsA;
  });

  return reviews;
};

// ============================================================
// WRITE
// ============================================================

/**
 * Add a review. Uses deterministic ID {studentId}_{tutorId} so a student
 * can only have one review per tutor (subsequent calls overwrite).
 */
export const addReview = async (
  tutorId,
  studentId,
  studentName,
  rating,
  comment
) => {
  validateReview(rating, comment);

  const reviewId = `${studentId}_${tutorId}`;
  await setDoc(doc(db, "reviews", reviewId), {
    tutorId,
    studentId,
    studentName: studentName || "Student",
    rating: Number(rating),
    comment: comment.trim(),
    createdAt: serverTimestamp(),
  });

  await recomputeRating(tutorId);
};

/**
 * Edit an existing review. Reads the stored tutorId to recompute rating.
 */
export const updateReview = async (reviewId, rating, comment) => {
  validateReview(rating, comment);

  const reviewRef = doc(db, "reviews", reviewId);
  await updateDoc(reviewRef, {
    rating: Number(rating),
    comment: comment.trim(),
    updatedAt: serverTimestamp(),
  });

  // Re-read to get tutorId for recomputation
  const snap = await getDoc(reviewRef);
  if (snap.exists()) {
    await recomputeRating(snap.data().tutorId);
  }
};

/**
 * Delete a review and recompute the tutor rating.
 */
export const deleteReview = async (reviewId, tutorId) => {
  await deleteDoc(doc(db, "reviews", reviewId));
  await recomputeRating(tutorId);
};
