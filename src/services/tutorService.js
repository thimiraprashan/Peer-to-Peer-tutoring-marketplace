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
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data(), tutorId: d.data().tutorId || d.id }));
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

  // 1. Load tutor document by ID
  const tutorRef = doc(db, "tutors", tutorId);
  let tutorSnap = await getDoc(tutorRef);
  let tutorData = tutorSnap.exists() ? tutorSnap.data() : null;
  let resolvedTutorId = tutorId;

  // 2. If not found by doc ID, search by tutorId field
  if (!tutorData) {
    try {
      const q = query(collection(db, "tutors"), where("tutorId", "==", tutorId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        tutorData = snap.docs[0].data();
        resolvedTutorId = tutorData.tutorId || snap.docs[0].id;
      }
    } catch (e) {
      console.warn("Error querying tutors collection by field:", e);
    }
  }

  // 3. Load user document for personal details
  let userData = {};
  try {
    const userSnap = await getDoc(doc(db, "users", resolvedTutorId));
    if (userSnap.exists()) {
      userData = userSnap.data();
    } else if (resolvedTutorId !== tutorId) {
      const altUserSnap = await getDoc(doc(db, "users", tutorId));
      if (altUserSnap.exists()) userData = altUserSnap.data();
    }
  } catch (e) {
    console.warn("Error fetching user document:", e);
  }

  // If neither tutor doc nor user doc exists, return null
  if (!tutorData && Object.keys(userData).length === 0) return null;

  // 4. Load subjects from tutorSubjects collection
  let subjects = [];
  try {
    const subjectsSnap = await getDocs(
      query(collection(db, "tutorSubjects"), where("tutorId", "==", resolvedTutorId))
    );
    subjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (subjects.length === 0 && resolvedTutorId !== tutorId) {
      const altSnap = await getDocs(
        query(collection(db, "tutorSubjects"), where("tutorId", "==", tutorId))
      );
      subjects = altSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch (e) {
    console.warn("Error fetching tutorSubjects:", e);
  }

  // Format subjects list
  let finalSubjects = [];
  if (subjects.length > 0) {
    finalSubjects = subjects.map((s) => ({
      id: s.id,
      moduleCode: s.moduleCode || s.code || "SUBJ",
      moduleName: s.moduleName || s.name || s.moduleCode || "Subject",
      subjectArea: s.subjectArea || s.faculty || "",
    }));
  } else if (Array.isArray(tutorData?.subjects) && tutorData.subjects.length > 0) {
    finalSubjects = tutorData.subjects.map((s, idx) =>
      typeof s === "string"
        ? { id: "subj-" + idx, moduleCode: s, moduleName: s, subjectArea: "" }
        : {
            id: s.id || "subj-" + idx,
            moduleCode: s.moduleCode || s.code || "SUBJ",
            moduleName: s.moduleName || s.name || s.moduleCode || "Subject",
            subjectArea: s.subjectArea || "",
          }
    );
  }

  return {
    id: resolvedTutorId,
    tutorId: resolvedTutorId,
    ...(tutorData || {}),
    name: userData.name || tutorData?.name || "Tutor",
    email: userData.email || tutorData?.email || "",
    avatar: userData.avatar || userData.photoURL || tutorData?.avatar || null,
    university: tutorData?.university || userData?.university || "SLIIT",
    faculty: tutorData?.faculty || userData?.faculty || "Faculty of Computing",
    bio: tutorData?.bio || userData?.bio || "",
    degree: tutorData?.degree || "BSc (Hons) in Information Technology",
    yearOfStudy: tutorData?.yearOfStudy || userData?.yearOfStudy || 3,
    studentId: tutorData?.studentId || userData?.studentId || "",
    gpa: typeof tutorData?.gpa === "number" ? tutorData.gpa : 3.8,
    completedModules:
      typeof tutorData?.completedModules === "number"
        ? tutorData.completedModules
        : finalSubjects.length > 0
          ? finalSubjects.length * 2 + 6
          : 12,
    hourlyRate: typeof tutorData?.hourlyRate === "number" ? tutorData.hourlyRate : 1500,
    sessionMode: tutorData?.sessionMode || "online",
    verified: tutorData?.verified !== undefined ? !!tutorData.verified : true,
    ratingAvg:
      typeof tutorData?.ratingAvg === "number"
        ? tutorData.ratingAvg
        : 5.0,
    ratingCount:
      typeof tutorData?.ratingCount === "number"
        ? tutorData.ratingCount
        : 0,
    totalSessions:
      typeof tutorData?.totalSessions === "number"
        ? tutorData.totalSessions
        : 26,
    languages: Array.isArray(tutorData?.languages)
      ? tutorData.languages
      : ["English", "Sinhala"],
    experience: tutorData?.experience || "2+ years tutoring experience",
    responseTime: tutorData?.responseTime || "Within 1 hour",
    subjects: finalSubjects,
  };
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
    const byTutorId = new Map();
    for (const d of snapshot.docs) {
      const data = d.data();
      const tutorId = data.tutorId || d.id;
      if (byTutorId.has(tutorId)) continue;
      byTutorId.set(tutorId, {
        ...data,
        id: d.id,
        tutorId,
      });
    }
    const results = [];
    for (const tutor of byTutorId.values()) {
      const tutorId = tutor.tutorId;
      try {
        const [userSnap, subjectsSnap] = await Promise.all([
          getDoc(doc(db, "users", tutorId)),
          getDocs(
            query(collection(db, "tutorSubjects"), where("tutorId", "==", tutorId)),
          ),
        ]);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const firstSubject = subjectsSnap.docs[0]?.data() || {};

        results.push({
          ...tutor,
          name: userData.name || tutor.name || "Tutor",
          moduleCode: firstSubject.moduleCode || tutor.moduleCode || "",
          moduleName: firstSubject.moduleName || tutor.moduleName || "",
        });
      } catch {
        results.push({
          ...tutor,
          name: tutor.name || "Tutor",
        });
      }
    }
    return results;
  } catch (error) {
    console.error("Error fetching tutors:", error);
    return [];
  }
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

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
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

// ============================================================
// UPCOMING SLOTS (for tutor profile)
// ============================================================

/**
 * Get the next upcoming available slots for a tutor.
 * Returns an array (max 5) of slot objects sorted chronologically.
 */
export const getUpcomingSlots = async (tutorId, limit = 5) => {
  if (!tutorId) return [];
  const now = new Date();
  const q = query(
    collection(db, "availability"),
    where("tutorId", "==", tutorId),
    where("isBooked", "==", false)
  );
  const snap = await getDocs(q);
  const futureSlots = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (data.date && data.startTime) {
      const [year, month, day] = data.date.split("-").map(Number);
      const [hour, minute] = data.startTime.split(":").map(Number);
      const slotDate = new Date(year, month - 1, day, hour, minute);
      if (slotDate > now) {
        futureSlots.push({ id: doc.id, ...data, slotDate });
      }
    }
  });
  futureSlots.sort((a, b) => a.slotDate - b.slotDate);
  return futureSlots.slice(0, limit).map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    mode: s.mode,
    slotDate: s.slotDate,
  }));
};
