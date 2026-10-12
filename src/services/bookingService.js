import { db } from '../firebase';
import {
  collection, query, where, getDocs, doc, updateDoc, addDoc,
} from 'firebase/firestore';

/**
 * Fetch all bookings that belong to a specific tutor.
 * @param {string} tutorId - The tutor's Firestore UID.
 * @returns {Promise<Array>} List of booking objects.
 */
export const getTutorBookings = async (tutorId) => {
  try {
    const q = query(
      collection(db, 'bookings'),
      where('tutorId', '==', tutorId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching tutor bookings:', error);
    return [];
  }
};

/**
 * Fetch all bookings that belong to a specific student.
 * @param {string} studentId - The student's Firestore UID.
 * @returns {Promise<Array>} List of booking objects sorted by date desc.
 */
export const getStudentBookings = async (studentId) => {
  try {
    const q = query(
      collection(db, 'bookings'),
      where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    const bookings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Sort newest first
    return bookings.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error fetching student bookings:', error);
    return [];
  }
};

/**
 * Cancel a booking and notify the tutor.
 */
export const cancelBooking = async (bookingId, tutorId, studentName) => {
  try {
    await updateDoc(doc(db, 'bookings', bookingId), { status: 'cancelled' });
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: tutorId,
        type: 'booking_cancelled',
        message: `${studentName || 'A student'} cancelled their booking.`,
        bookingId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not create cancellation notification:', e);
    }
    return true;
  } catch (error) {
    console.error('Error cancelling booking:', error);
    throw error;
  }
};

/**
 * Update a booking's status (approve / reject / reschedule) and
 * also create a notification for the student.
 * Required by cross-member agreement: whoever changes status must notify the other party.
 */
export const updateBookingStatus = async (
  bookingId,
  newStatus,
  studentId,
  tutorName,
  rescheduleData = null
) => {
  try {
    const updateData = { status: newStatus };

    // If tutor is proposing a new time, store the rescheduleProposal object
    if (rescheduleData) {
      updateData.rescheduleProposal = rescheduleData;
    }

    // 1. Update the booking document
    await updateDoc(doc(db, 'bookings', bookingId), updateData);

    // 2. Create a notification for the student
    let message = `Your booking has been ${newStatus} by ${tutorName}.`;
    if (newStatus === 'rescheduled' && rescheduleData) {
      message = `${tutorName} proposed a new time: ${rescheduleData.date} at ${rescheduleData.startTime}.`;
    }

    await addDoc(collection(db, 'notifications'), {
      userId: studentId,
      type: 'booking_status',
      message,
      bookingId,
      read: false,
      createdAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
};

/**
 * Mark a session as completed and free up its availability slot.
 */
export const markSessionCompleted = async (bookingId, slotId) => {
  try {
    // 1. Update booking status to 'completed'
    await updateDoc(doc(db, 'bookings', bookingId), { status: 'completed' });

    // 2. Free the availability slot so others can book it again
    if (slotId) {
      await updateDoc(doc(db, 'availability', slotId), { isBooked: false });
    }
  } catch (error) {
    console.error('Error completing session:', error);
    throw error;
  }
};

/**
 * Create a new booking request from a student to a tutor.
 */
export const createBooking = async ({
  tutorId,
  tutorName,
  studentId,
  studentName,
  subjectCode,
  slotId,
  date,
  startTime,
  endTime,
  mode,
  note,
  price,
}) => {
  try {
    const bookingRef = await addDoc(collection(db, 'bookings'), {
      tutorId,
      tutorName: tutorName || 'Tutor',
      studentId,
      studentName: studentName || 'Student',
      subjectCode: subjectCode || '',
      slotId: slotId || null,
      date: date || '',
      startTime: startTime || '',
      endTime: endTime || '',
      mode: mode || 'online',
      note: note || '',
      price: Number(price) || 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    if (slotId) {
      try {
        await updateDoc(doc(db, 'availability', slotId), { isBooked: true });
      } catch (e) {
        console.warn('Could not mark slot booked:', e);
      }
    }

    try {
      await addDoc(collection(db, 'notifications'), {
        userId: tutorId,
        type: 'new_booking',
        message: `${studentName || 'A student'} requested a session for ${subjectCode || 'tutoring'}.`,
        bookingId: bookingRef.id,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not create notification:', e);
    }

    return bookingRef.id;
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
};