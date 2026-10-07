import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface VerificationDocument {
  id: string;
  name: string;
  type: 'id_card' | 'transcript' | 'certificate' | 'other';
  fileSize?: string;
  url?: string;
}

export interface VerificationRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  applicantRole: 'tutor' | 'student';
  faculty: string;
  subjects: string[];
  qualification: string;
  gpa: string;
  bio?: string;
  documents: VerificationDocument[];
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
  rejectionReason?: string;
}

// Initial realistic seed applications to populate Firestore if empty
const SEED_VERIFICATIONS: Omit<VerificationRequest, 'id'>[] = [
  {
    applicantId: 'Spms6Z95tpVsAq2K0wbnnOw34WC3',
    applicantName: 'David Chen',
    applicantEmail: 'david.chen@university.ac.uk',
    applicantRole: 'tutor',
    faculty: 'Computing & Information Systems',
    subjects: ['IT3020 Mobile Application Development', 'IT2010 Data Structures & Algorithms'],
    qualification: 'BSc (Hons) Computer Science - 3rd Year',
    gpa: '3.88 / 4.00 (First Class)',
    bio: 'Dean\'s list student with 2 years of peer tutoring experience. Passionate about React Native and algorithms.',
    documents: [
      {
        id: 'doc-1',
        name: 'University Student ID Card',
        type: 'id_card',
        fileSize: '1.2 MB',
      },
      {
        id: 'doc-2',
        name: 'Official Academic Transcript (Year 2)',
        type: 'transcript',
        fileSize: '3.4 MB',
      },
      {
        id: 'doc-3',
        name: 'Mobile App Project Distinction Certificate',
        type: 'certificate',
        fileSize: '840 KB',
      },
    ],
    status: 'pending',
    submittedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    applicantId: 'j2IUWxDOJ5MzVlzqMIzgTM6KsnA2',
    applicantName: 'Sarah Perera',
    applicantEmail: 'sarah.p@university.ac.uk',
    applicantRole: 'tutor',
    faculty: 'Business & Financial Management',
    subjects: ['BM2030 Financial Accounting', 'BM1010 Microeconomics'],
    qualification: 'BSc in Business Analytics - Final Year',
    gpa: '3.75 / 4.00',
    bio: 'Specialized in financial modeling and macroeconomics. Has helped 30+ students pass module exams.',
    documents: [
      {
        id: 'doc-4',
        name: 'Student Identification Card',
        type: 'id_card',
        fileSize: '950 KB',
      },
      {
        id: 'doc-5',
        name: 'Certified University Grade Sheet',
        type: 'transcript',
        fileSize: '2.1 MB',
      },
    ],
    status: 'pending',
    submittedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    applicantId: 'zXcRWhssiKdseOtd2vpH21e73N62',
    applicantName: 'Liam Fernando',
    applicantEmail: 'liam.fernando@university.ac.uk',
    applicantRole: 'tutor',
    faculty: 'Faculty of Engineering',
    subjects: ['EN1040 Calculus & Linear Algebra', 'EN2020 Physics for Engineers'],
    qualification: 'BEng (Hons) Mechanical Engineering - Year 3',
    gpa: '3.92 / 4.00',
    bio: 'Top percentile in engineering math. Enjoys breaking down complex differential equations into easy steps.',
    documents: [
      {
        id: 'doc-6',
        name: 'Faculty ID Card',
        type: 'id_card',
        fileSize: '1.1 MB',
      },
      {
        id: 'doc-7',
        name: 'Complete Semester Transcripts (Sem 1-4)',
        type: 'transcript',
        fileSize: '4.8 MB',
      },
      {
        id: 'doc-8',
        name: 'Mathematics Olympiad Recognition',
        type: 'certificate',
        fileSize: '1.5 MB',
      },
    ],
    status: 'pending',
    submittedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
  },
  {
    applicantId: 'app-seed-4',
    applicantName: 'Elena Rostova',
    applicantEmail: 'elena.r@university.ac.uk',
    applicantRole: 'tutor',
    faculty: 'Humanities & Modern Languages',
    subjects: ['LN1010 Academic English & Writing'],
    qualification: 'BA (Hons) English Literature - Graduate',
    gpa: '3.65 / 4.00',
    bio: 'Experienced in ESL writing, academic essay proofreading and IELTS preparation.',
    documents: [
      {
        id: 'doc-9',
        name: 'Student ID & Degree Certificate',
        type: 'certificate',
        fileSize: '2.9 MB',
      },
    ],
    status: 'approved',
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    reviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    reviewedBy: 'admin',
  },
];

/**
 * Seeds initial verification documents to Firestore if collection is empty
 */
async function ensureVerificationSeed(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'verifications'));
    if (snap.empty) {
      for (const item of SEED_VERIFICATIONS) {
        const newDocRef = doc(collection(db, 'verifications'));
        await setDoc(newDocRef, {
          ...item,
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    console.warn('Seed verification collection check failed:', error);
  }
}

/**
 * Fetches all verification requests from Firestore.
 */
export async function getVerificationRequests(
  filterStatus?: 'pending' | 'approved' | 'rejected' | 'all'
): Promise<VerificationRequest[]> {
  try {
    // 1. Ensure initial sample data exists in Firestore
    await ensureVerificationSeed();

    // 2. Fetch all verification records
    const snap = await getDocs(collection(db, 'verifications'));
    const list: VerificationRequest[] = [];

    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        applicantId: data.applicantId || d.id,
        applicantName: data.applicantName || 'Applicant',
        applicantEmail: data.applicantEmail || '',
        applicantRole: data.applicantRole || 'tutor',
        faculty: data.faculty || '',
        subjects: Array.isArray(data.subjects) ? data.subjects : [],
        qualification: data.qualification || '',
        gpa: data.gpa || '',
        bio: data.bio || '',
        documents: Array.isArray(data.documents) ? data.documents : [],
        status: data.status || 'pending',
        submittedAt: data.submittedAt || data.createdAt || new Date().toISOString(),
        reviewedAt: data.reviewedAt || null,
        reviewedBy: data.reviewedBy || null,
        rejectionReason: data.rejectionReason || null,
      });
    });

    // Sort newest first
    list.sort((a, b) => {
      const timeA = new Date(a.submittedAt?.toDate ? a.submittedAt.toDate() : a.submittedAt).getTime();
      const timeB = new Date(b.submittedAt?.toDate ? b.submittedAt.toDate() : b.submittedAt).getTime();
      return timeB - timeA;
    });

    // Filter by status if specified
    if (filterStatus && filterStatus !== 'all') {
      return list.filter((item) => item.status === filterStatus);
    }

    return list;
  } catch (error) {
    console.error('Error fetching verification requests from Firestore:', error);
    throw error;
  }
}

/**
 * Approves a verification request:
 * 1. Updates verifications/{id} status to 'approved'
 * 2. Updates tutors/{applicantId} verified to true
 */
export async function approveVerification(
  verificationId: string,
  applicantId: string,
  adminUid?: string
): Promise<void> {
  try {
    const verifRef = doc(db, 'verifications', verificationId);
    await updateDoc(verifRef, {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid || 'admin',
      rejectionReason: null,
    });

    // Also mark tutor as verified in tutors collection if tutor exists
    if (applicantId) {
      try {
        const tutorRef = doc(db, 'tutors', applicantId);
        const tutorSnap = await getDoc(tutorRef);
        if (tutorSnap.exists()) {
          await updateDoc(tutorRef, { verified: true });
        } else {
          // If tutor doc does not exist yet, create it with verified: true
          await setDoc(tutorRef, { verified: true }, { merge: true });
        }
      } catch (tutorErr) {
        console.warn('Could not update tutors collection directly:', tutorErr);
      }
    }
  } catch (error) {
    console.error(`Failed to approve verification ${verificationId}:`, error);
    throw error;
  }
}

/**
 * Rejects a verification request:
 * 1. Updates verifications/{id} status to 'rejected' with reason
 * 2. Updates tutors/{applicantId} verified to false
 */
export async function rejectVerification(
  verificationId: string,
  applicantId: string,
  reason: string,
  adminUid?: string
): Promise<void> {
  try {
    const verifRef = doc(db, 'verifications', verificationId);
    await updateDoc(verifRef, {
      status: 'rejected',
      rejectionReason: reason.trim(),
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid || 'admin',
    });

    // Also ensure tutor is not verified in tutors collection
    if (applicantId) {
      try {
        const tutorRef = doc(db, 'tutors', applicantId);
        const tutorSnap = await getDoc(tutorRef);
        if (tutorSnap.exists()) {
          await updateDoc(tutorRef, { verified: false });
        }
      } catch (tutorErr) {
        console.warn('Could not update tutors collection directly:', tutorErr);
      }
    }
  } catch (error) {
    console.error(`Failed to reject verification ${verificationId}:`, error);
    throw error;
  }
}
