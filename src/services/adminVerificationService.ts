import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface VerificationRequestItem {
  id: string; // doc id in verificationRequests
  tutorId: string;
  tutorName: string;
  email: string;
  university: string;
  faculty: string;
  degree?: string;
  studentId?: string;
  yearOfStudy?: number;
  gpa?: number;
  hourlyRate?: number;
  subjects?: string[];
  documentUrl?: string;
  studentIdUrl?: string;
  cvUrl?: string;
  status: 'submitted' | 'pending' | 'verified' | 'rejected';
  submittedAt?: string;
  adminNote?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  avatar?: string | null;
}

// Fallback sample data in case Firestore collection is empty
const DEFAULT_VERIFICATION_REQUESTS: VerificationRequestItem[] = [
  {
    id: 'req-sample-1',
    tutorId: 'tutor-sample-1',
    tutorName: 'David Chen',
    email: 'david.chen@university.ac.uk',
    university: 'SLIIT Computing Faculty',
    faculty: 'Computer Science & Software Eng.',
    degree: 'BSc (Hons) Computer Science',
    studentId: 'IT21894022',
    yearOfStudy: 3,
    gpa: 3.85,
    hourlyRate: 1500,
    subjects: ['IT3020 - Advanced Web Development', 'IT2040 - Algorithms & Data Structures'],
    status: 'submitted',
    submittedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    studentIdUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
    cvUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80',
    adminNote: '',
  },
  {
    id: 'req-sample-2',
    tutorId: 'tutor-sample-2',
    tutorName: 'Sarah Perera',
    email: 'sarah.perera@university.ac.uk',
    university: 'Faculty of Business',
    faculty: 'Information Systems Management',
    degree: 'BSc Business Analytics',
    studentId: 'BM19042211',
    yearOfStudy: 4,
    gpa: 3.92,
    hourlyRate: 1800,
    subjects: ['BM2010 - Accounting for Managers', 'BM3050 - Business Analytics'],
    status: 'submitted',
    submittedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    studentIdUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
    cvUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80',
    adminNote: '',
  },
  {
    id: 'req-sample-3',
    tutorId: 'tutor-sample-3',
    tutorName: 'Marcus Vane',
    email: 'marcus.vane@university.ac.uk',
    university: 'Faculty of Engineering',
    faculty: 'Electrical & Electronic Engineering',
    degree: 'BSc Engineering (Hons)',
    studentId: 'EE20938411',
    yearOfStudy: 2,
    gpa: 3.65,
    hourlyRate: 1400,
    subjects: ['EE1020 - Circuit Analysis', 'EE2010 - Digital Logic Design'],
    status: 'submitted',
    submittedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    studentIdUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
    cvUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80',
    adminNote: '',
  },
];

/**
 * Fetch all tutor verification requests from Firestore.
 * Enriches request records with tutor profile and user account details.
 */
export async function getAllVerificationRequests(): Promise<VerificationRequestItem[]> {
  try {
    const list: VerificationRequestItem[] = [];
    const processedTutorIds = new Set<string>();

    // 1. Fetch from verificationRequests collection
    try {
      const q = query(collection(db, 'verificationRequests'), orderBy('submittedAt', 'desc'));
      const snap = await getDocs(q);

      for (const d of snap.docs) {
        const data = d.data();
        const tutorId = data.tutorId;
        if (!tutorId) continue;
        processedTutorIds.add(tutorId);

        let studentIdUrl: string | undefined = undefined;
        let cvUrl: string | undefined = undefined;

        if (data.documentUrl) {
          try {
            const parsed = JSON.parse(data.documentUrl);
            studentIdUrl = parsed.studentIdUrl || parsed.studentIdImage;
            cvUrl = parsed.cvUrl || parsed.cvImage;
          } catch {
            // Raw string URL
            studentIdUrl = data.documentUrl;
          }
        }

        // Fetch tutor doc
        let tutorDocData: any = {};
        try {
          const tutorSnap = await getDoc(doc(db, 'tutors', tutorId));
          if (tutorSnap.exists()) tutorDocData = tutorSnap.data();
        } catch {
          // ignore
        }

        // Fetch user doc
        let userDocData: any = {};
        try {
          const userSnap = await getDoc(doc(db, 'users', tutorId));
          if (userSnap.exists()) userDocData = userSnap.data();
        } catch {
          // ignore
        }

        // Fetch subjects
        let subjectsList: string[] = [];
        try {
          const subSnap = await getDocs(
            query(collection(db, 'tutorSubjects'), where('tutorId', '==', tutorId))
          );
          subjectsList = subSnap.docs.map((s) => {
            const sData = s.data();
            return sData.moduleCode
              ? `${sData.moduleCode}${sData.moduleName ? ` - ${sData.moduleName}` : ''}`
              : sData.moduleName || 'Subject';
          });
        } catch {
          // ignore
        }

        const rawStatus = (data.status || 'submitted').toLowerCase();
        let status: 'submitted' | 'pending' | 'verified' | 'rejected' = 'submitted';
        if (rawStatus === 'verified' || rawStatus === 'approved') status = 'verified';
        else if (rawStatus === 'rejected') status = 'rejected';
        else if (rawStatus === 'pending') status = 'pending';
        else status = 'submitted';

        list.push({
          id: d.id,
          tutorId,
          tutorName: userDocData.name || tutorDocData.name || data.tutorName || 'Tutor',
          email: userDocData.email || data.universityEmail || tutorDocData.email || '',
          university: tutorDocData.university || data.university || 'University',
          faculty: tutorDocData.faculty || data.faculty || 'Faculty of Computing',
          degree: tutorDocData.degree || data.degree,
          studentId: tutorDocData.studentId || data.studentId,
          yearOfStudy: tutorDocData.yearOfStudy || data.yearOfStudy || 1,
          gpa: tutorDocData.gpa || data.gpa,
          hourlyRate: tutorDocData.hourlyRate,
          subjects: subjectsList.length > 0 ? subjectsList : tutorDocData.subjects || [],
          documentUrl: data.documentUrl,
          studentIdUrl: studentIdUrl || data.studentIdUrl,
          cvUrl: cvUrl || data.cvUrl,
          status,
          submittedAt: data.submittedAt || new Date().toISOString(),
          adminNote: data.adminNote || '',
          reviewedBy: data.reviewedBy || null,
          reviewedAt: data.reviewedAt || null,
          avatar: userDocData.avatar || tutorDocData.avatar || null,
        });
      }
    } catch (e) {
      console.warn('Could not query verificationRequests with orderBy:', e);
      // Fallback query without orderBy
      try {
        const snap = await getDocs(collection(db, 'verificationRequests'));
        for (const d of snap.docs) {
          const data = d.data();
          const tutorId = data.tutorId;
          if (!tutorId || processedTutorIds.has(tutorId)) continue;
          processedTutorIds.add(tutorId);

          let studentIdUrl: string | undefined = undefined;
          let cvUrl: string | undefined = undefined;
          if (data.documentUrl) {
            try {
              const parsed = JSON.parse(data.documentUrl);
              studentIdUrl = parsed.studentIdUrl;
              cvUrl = parsed.cvUrl;
            } catch {
              studentIdUrl = data.documentUrl;
            }
          }

          list.push({
            id: d.id,
            tutorId,
            tutorName: data.tutorName || 'Tutor',
            email: data.universityEmail || '',
            university: data.university || 'University',
            faculty: data.faculty || '',
            studentId: data.studentId,
            status: data.status === 'verified' ? 'verified' : data.status === 'rejected' ? 'rejected' : 'submitted',
            submittedAt: data.submittedAt || new Date().toISOString(),
            studentIdUrl,
            cvUrl,
            adminNote: data.adminNote || '',
          });
        }
      } catch (err) {
        console.warn('Failed fallback verificationRequests:', err);
      }
    }

    // 2. Also check tutors collection for any unverified tutors that don't have a verificationRequest record
    try {
      const tutorsSnap = await getDocs(collection(db, 'tutors'));
      for (const td of tutorsSnap.docs) {
        const tData = td.data();
        const tId = tData.tutorId || td.id;
        if (processedTutorIds.has(tId)) continue;
        if (tData.verified === false || tData.verificationStatus === 'submitted') {
          processedTutorIds.add(tId);

          let userDocData: any = {};
          try {
            const userSnap = await getDoc(doc(db, 'users', tId));
            if (userSnap.exists()) userDocData = userSnap.data();
          } catch {
            // ignore
          }

          list.push({
            id: `tutor-doc-${td.id}`,
            tutorId: tId,
            tutorName: userDocData.name || tData.name || 'Tutor',
            email: userDocData.email || tData.email || '',
            university: tData.university || 'University',
            faculty: tData.faculty || '',
            studentId: tData.studentId,
            yearOfStudy: tData.yearOfStudy || 1,
            degree: tData.degree,
            gpa: tData.gpa,
            subjects: Array.isArray(tData.subjects) ? tData.subjects : [],
            status: 'submitted',
            submittedAt: tData.createdAt || new Date().toISOString(),
            adminNote: '',
          });
        }
      }
    } catch (e) {
      console.warn('Error reading unverified tutors:', e);
    }

    // If completely empty in Firestore, return default seed requests for demo
    if (list.length === 0) {
      return DEFAULT_VERIFICATION_REQUESTS;
    }

    return list;
  } catch (err) {
    console.error('getAllVerificationRequests failed:', err);
    return DEFAULT_VERIFICATION_REQUESTS;
  }
}

/**
 * Approve / Verify a tutor.
 * Updates verificationRequests, tutors, users collections and notifies the tutor.
 */
export async function approveTutorVerification(
  requestId: string,
  tutorId: string,
  adminUserId?: string,
  adminNote?: string
): Promise<void> {
  const note = adminNote?.trim() || 'Verified by Admin';
  const timestamp = new Date().toISOString();

  // 1. Update verificationRequests doc if it's a real Firestore doc
  if (requestId && !requestId.startsWith('tutor-doc-') && !requestId.startsWith('req-sample-')) {
    try {
      await updateDoc(doc(db, 'verificationRequests', requestId), {
        status: 'verified',
        adminNote: note,
        reviewedBy: adminUserId || 'admin',
        reviewedAt: timestamp,
      });
    } catch (e) {
      console.warn('Could not update verificationRequests doc:', e);
    }
  }

  // 2. Update tutors doc
  try {
    const tutorRef = doc(db, 'tutors', tutorId);
    await updateDoc(tutorRef, {
      verified: true,
      verificationStatus: 'verified',
      verifiedAt: timestamp,
    });
  } catch (e) {
    console.warn('Could not update tutors doc directly, trying query by tutorId:', e);
    try {
      const q = query(collection(db, 'tutors'), where('tutorId', '==', tutorId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(doc(db, 'tutors', d.id), {
          verified: true,
          verificationStatus: 'verified',
          verifiedAt: timestamp,
        });
      }
    } catch (err) {
      console.warn('Fallback update tutors failed:', err);
    }
  }

  // 3. Update users doc
  try {
    await updateDoc(doc(db, 'users', tutorId), {
      verified: true,
    });
  } catch (e) {
    console.warn('Could not update users doc verified flag:', e);
  }

  // 4. Create in-app notification for the tutor
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: tutorId,
      type: 'verification_status',
      title: 'Profile Verified! 🎉',
      message: 'Congratulations! Your tutor credentials have been verified by the administrator. Your verified badge is now active.',
      read: false,
      createdAt: timestamp,
    });
  } catch (e) {
    console.warn('Could not create tutor approval notification:', e);
  }
}

/**
 * Reject a tutor's verification request.
 * Sets verificationRequests status to 'rejected', sets rejection note,
 * ensures tutor.verified is false, and creates notification with the reason.
 */
export async function rejectTutorVerification(
  requestId: string,
  tutorId: string,
  rejectionReason: string,
  adminUserId?: string
): Promise<void> {
  const note = rejectionReason.trim() || 'Documents did not meet university verification criteria.';
  const timestamp = new Date().toISOString();

  // 1. Update verificationRequests doc
  if (requestId && !requestId.startsWith('tutor-doc-') && !requestId.startsWith('req-sample-')) {
    try {
      await updateDoc(doc(db, 'verificationRequests', requestId), {
        status: 'rejected',
        adminNote: note,
        reviewedBy: adminUserId || 'admin',
        reviewedAt: timestamp,
      });
    } catch (e) {
      console.warn('Could not update verificationRequests doc:', e);
    }
  }

  // 2. Update tutors doc
  try {
    const tutorRef = doc(db, 'tutors', tutorId);
    await updateDoc(tutorRef, {
      verified: false,
      verificationStatus: 'rejected',
    });
  } catch (e) {
    try {
      const q = query(collection(db, 'tutors'), where('tutorId', '==', tutorId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(doc(db, 'tutors', d.id), {
          verified: false,
          verificationStatus: 'rejected',
        });
      }
    } catch (err) {
      console.warn('Fallback update tutors failed:', err);
    }
  }

  // 3. Update users doc
  try {
    await updateDoc(doc(db, 'users', tutorId), {
      verified: false,
    });
  } catch (e) {
    console.warn('Could not update users doc:', e);
  }

  // 4. Create in-app notification for the tutor
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: tutorId,
      type: 'verification_status',
      title: 'Verification Request Update',
      message: `Your verification request was not approved: ${note}. Please update your documents and resubmit.`,
      read: false,
      createdAt: timestamp,
    });
  } catch (e) {
    console.warn('Could not create tutor rejection notification:', e);
  }
}
