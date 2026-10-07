import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where
} from "firebase/firestore";
import { db } from "../firebase";

// ============================================================
// AVAILABILITY
// ============================================================

/**
 * Create a new availability slot in Firestore.
 * slotData = { tutorId, date, startTime, endTime, mode, isBooked: false }
 */
export const addAvailabilitySlot = async (slotData) => {
  await addDoc(collection(db, "availability"), slotData);
};

/**
 * Get all availability slots for a specific tutor.
 */
export const getMyAvailability = async (tutorId) => {
  const q = query(
    collection(db, "availability"),
    where("tutorId", "==", tutorId),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Delete a single availability slot.
 */
export const deleteAvailabilitySlot = async (slotId) => {
  await deleteDoc(doc(db, "availability", slotId));
};

// ============================================================
// TUTOR PROFILE
// ============================================================

/**
 * Fetch the tutor profile document from Firestore.
 * Returns null if the document does not exist yet.
 */
export const getTutorProfile = async (tutorId) => {
  const docRef = doc(db, "tutors", tutorId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};

/**
 * Update (or create) the tutor profile.
 * Uses setDoc with merge so the first save creates the document.
 */
export const updateTutorProfile = async (tutorId, profileData) => {
  await setDoc(doc(db, "tutors", tutorId), profileData, { merge: true });
};

// ============================================================
// TUTOR SUBJECTS
// ============================================================

/**
 * Add a new subject/module the tutor teaches.
 */
export const addTutorSubject = async (tutorId, subjectData) => {
  await addDoc(collection(db, "tutorSubjects"), {
    tutorId,
    ...subjectData,
  });
};

/**
 * Fetch all subjects for a tutor.
 */
export const getTutorSubjects = async (tutorId) => {
  const q = query(
    collection(db, "tutorSubjects"),
    where("tutorId", "==", tutorId),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ============================================================
// VERIFICATION REQUESTS
// ============================================================

/**
 * Submit a new verification request (reviewed later by Member 4 - Admin).
 */
export const submitVerificationRequest = async (
  tutorId,
  documentUrl,
  universityEmail,
) => {
  await addDoc(collection(db, "verificationRequests"), {
    tutorId,
    documentUrl,
    universityEmail,
    status: "submitted",
    adminNote: "",
    reviewedBy: null,
    submittedAt: new Date().toISOString(),
  });
};

/**
 * Get the latest verification request for a tutor.
 */
export const getVerificationStatus = async (tutorId) => {
  const q = query(
    collection(db, "verificationRequests"),
    where("tutorId", "==", tutorId),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return docs[docs.length - 1];
};

// ============================================================
// SEARCH / LIST (used by student side screens)
// ============================================================

/**
 * Fetch all tutors in the marketplace.
 * Used by the student search screen to display tutor cards.
 */
export const fetchTutors = async () => {
  try {
    const snapshot = await getDocs(collection(db, "tutors"));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error fetching tutors:", error);
    return [];
  }
};
