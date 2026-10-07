import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

// ============================================================
// AVAILABILITY
// ============================================================

/**
 * Create a new availability slot.
 * slotData = { tutorId, date, startTime, endTime, mode, isBooked: false }
 */
export const addAvailabilitySlot = async (slotData) => {
  await addDoc(collection(db, "availability"), {
    isBooked: false,
    ...slotData,
  });
};

/**
 * Get all availability slots for a specific tutor.
 */
export const getMyAvailability = async (tutorId) => {
  if (!tutorId) return [];
  const q = query(
    collection(db, "availability"),
    where("tutorId", "==", tutorId),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Update an existing availability slot (edit date/time/mode).
 */
export const updateAvailabilitySlot = async (slotId, data) => {
  if (!slotId) throw new Error("slotId is required");
  await updateDoc(doc(db, "availability", slotId), data);
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

export const getTutorProfile = async (tutorId) => {
  if (!tutorId) return null;
  const docRef = doc(db, "tutors", tutorId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};

export const updateTutorProfile = async (tutorId, profileData) => {
  await setDoc(doc(db, "tutors", tutorId), profileData, { merge: true });
};

// ============================================================
// TUTOR SUBJECTS
// ============================================================

export const addTutorSubject = async (tutorId, subjectData) => {
  await addDoc(collection(db, "tutorSubjects"), {
    tutorId,
    ...subjectData,
  });
};

export const getTutorSubjects = async (tutorId) => {
  if (!tutorId) return [];
  const q = query(
    collection(db, "tutorSubjects"),
    where("tutorId", "==", tutorId),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateTutorSubject = async (subjectId, data) => {
  if (!subjectId) throw new Error("subjectId is required");
  await updateDoc(doc(db, "tutorSubjects", subjectId), data);
};

export const deleteTutorSubject = async (subjectId) => {
  await deleteDoc(doc(db, "tutorSubjects", subjectId));
};

// ============================================================
// BOOKINGS (Tutor reads + updates status)
// ============================================================

/**
 * Get all bookings for a tutor (pending, approved, completed, cancelled).
 */
export const getTutorBookings = async (tutorId) => {
  if (!tutorId) return [];
  const q = query(collection(db, "bookings"), where("tutorId", "==", tutorId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Update a booking status.
 * status: "pending" | "approved" | "completed" | "cancelled"
 */
export const updateBookingStatus = async (bookingId, status) => {
  if (!bookingId) throw new Error("bookingId is required");
  await updateDoc(doc(db, "bookings", bookingId), { status });
};

/**
 * Propose a new time for a booking (reschedule).
 * proposal = { date, startTime, endTime }
 */
export const proposeReschedule = async (bookingId, proposal) => {
  if (!bookingId) throw new Error("bookingId is required");
  await updateDoc(doc(db, "bookings", bookingId), {
    rescheduleProposal: proposal,
  });
};

// ============================================================
// NOTIFICATIONS (cross-member agreement: M2 + M3)
// ============================================================

/**
 * Create a notification for the other party when booking status changes.
 * type: "booking_status" | "reschedule" | ...
 */
export const createNotification = async (userId, type, message, bookingId) => {
  if (!userId) return;
  await addDoc(collection(db, "notifications"), {
    userId,
    type,
    message,
    bookingId,
    read: false,
    createdAt: new Date().toISOString(),
  });
};

// ============================================================
// VERIFICATION REQUESTS
// ============================================================

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

export const getVerificationStatus = async (tutorId) => {
  if (!tutorId) return null;
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

export const fetchTutors = async () => {
  try {
    const snapshot = await getDocs(collection(db, "tutors"));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error fetching tutors:", error);
    return [];
  }
};
