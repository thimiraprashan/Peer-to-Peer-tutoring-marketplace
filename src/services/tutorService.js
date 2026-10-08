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

/**
 * Searches tutors by moduleCode or moduleName (case-insensitive substring).
 * Groups by tutorId, loads tutor & user details, and finds the earliest future availability slot.
 * All filtering and sorting is done in JavaScript without Firestore composite indexes.
 */
export const searchTutors = async (queryText = "") => {
  const trimmedQuery = (queryText || "").trim().toLowerCase();

  // 1. Read all tutorSubjects
  const subjectsSnap = await getDocs(collection(db, "tutorSubjects"));
  const matchedSubjects = [];
  subjectsSnap.forEach((d) => {
    const data = d.data();
    const code = (data.moduleCode || "").toLowerCase();
    const name = (data.moduleName || "").toLowerCase();
    if (!trimmedQuery || code.includes(trimmedQuery) || name.includes(trimmedQuery)) {
      matchedSubjects.push({ id: d.id, ...data });
    }
  });

  // 2. Group by tutorId (keep first matching module for each tutor)
  const tutorMap = new Map();
  for (const s of matchedSubjects) {
    if (s.tutorId && !tutorMap.has(s.tutorId)) {
      tutorMap.set(s.tutorId, s);
    }
  }

  const now = new Date();
  const results = [];

  // 3. For each tutor, load profile, user info, and earliest future slot
  for (const [tutorId, subject] of tutorMap.entries()) {
    try {
      const [tutorSnap, userSnap, availSnap] = await Promise.all([
        getDoc(doc(db, "tutors", tutorId)),
        getDoc(doc(db, "users", tutorId)),
        getDocs(query(collection(db, "availability"), where("tutorId", "==", tutorId))),
      ]);

      const tutorData = tutorSnap.exists() ? tutorSnap.data() : {};
      const userData = userSnap.exists() ? userSnap.data() : {};

      // Calculate next future unbooked slot
      const futureSlots = [];
      availSnap.forEach((slotDoc) => {
        const slot = slotDoc.data();
        if (slot.isBooked === false && slot.date && slot.startTime) {
          // Parse slot date and startTime (e.g. "2026-10-09" and "15:00")
          const [year, month, day] = slot.date.split("-").map(Number);
          const [hours, minutes] = slot.startTime.split(":").map(Number);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hours) && !isNaN(minutes)) {
            const slotDate = new Date(year, month - 1, day, hours, minutes);
            if (slotDate > now) {
              futureSlots.push(slotDate);
            }
          }
        }
      });

      futureSlots.sort((a, b) => a.getTime() - b.getTime());
      const nextSlot = futureSlots.length > 0 ? futureSlots[0] : null;

      results.push({
        tutorId,
        name: userData.name || "Tutor",
        moduleCode: subject.moduleCode || "",
        moduleName: subject.moduleName || "",
        ratingAvg: typeof tutorData.ratingAvg === "number" ? tutorData.ratingAvg : 5.0,
        ratingCount: tutorData.ratingCount || 0,
        verified: !!tutorData.verified,
        hourlyRate: tutorData.hourlyRate || 0,
        sessionMode: tutorData.sessionMode || "online",
        nextSlot,
      });
    } catch (err) {
      // Continue loading remaining tutors if one fails
    }
  }

  return results;
};

/**
 * Formats a slot Date object into user-friendly text like:
 * "Today 3 PM", "Tomorrow 3 PM", or "Fri 10 AM". Returns "No slots yet" when null.
 */
export const formatNextSlot = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "No slots yet";
  }

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  // Format time (e.g. "3 PM", "3:30 PM")
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour is 12
  const minuteStr = minutes > 0 ? `:${minutes < 10 ? "0" + minutes : minutes}` : "";
  const timeStr = `${hours}${minuteStr} ${ampm}`;

  if (isToday) {
    return `Today ${timeStr}`;
  }
  if (isTomorrow) {
    return `Tomorrow ${timeStr}`;
  }

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = days[date.getDay()];
  return `${dayName} ${timeStr}`;
};
