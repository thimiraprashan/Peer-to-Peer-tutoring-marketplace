import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export type ReportType = 'no-show' | 'misconduct' | 'other';
export type ReportSeverity = 'low' | 'medium' | 'high';
export type ReportStatus = 'open' | 'reviewing' | 'resolved';

export interface Report {
  id: string;
  reportedUserId: string;
  reporterId: string;
  type: ReportType;
  description: string;
  severity: ReportSeverity;
  status: ReportStatus;
  actionTaken: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReportInput {
  reportedUserId: string;
  reporterId: string;
  type: ReportType;
  description: string;
  severity: ReportSeverity;
}

const REPORTS_COLLECTION = 'reports';

/**
 * Create a new report
 */
export async function createReport(input: ReportInput): Promise<string> {
  try {
    const reportData = {
      reportedUserId: input.reportedUserId,
      reporterId: input.reporterId,
      type: input.type,
      description: input.description,
      severity: input.severity,
      status: 'open' as ReportStatus,
      actionTaken: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, REPORTS_COLLECTION), reportData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating report:', error);
    throw new Error('Failed to create report');
  }
}

/**
 * Get all reports
 */
export async function getAllReports(): Promise<Report[]> {
  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const reports: Report[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      reports.push({
        id: docSnap.id,
        reportedUserId: data.reportedUserId || '',
        reporterId: data.reporterId || '',
        type: data.type || 'other',
        description: data.description || '',
        severity: data.severity || 'low',
        status: data.status || 'open',
        actionTaken: data.actionTaken || '',
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      });
    });

    return reports;
  } catch (error) {
    console.error('Error fetching reports:', error);
    throw new Error('Failed to fetch reports');
  }
}

/**
 * Get a single report by ID
 */
export async function getReportById(reportId: string): Promise<Report | null> {
  try {
    const docRef = doc(db, REPORTS_COLLECTION, reportId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      reportedUserId: data.reportedUserId || '',
      reporterId: data.reporterId || '',
      type: data.type || 'other',
      description: data.description || '',
      severity: data.severity || 'low',
      status: data.status || 'open',
      actionTaken: data.actionTaken || '',
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    };
  } catch (error) {
    console.error('Error fetching report:', error);
    throw new Error('Failed to fetch report');
  }
}

/**
 * Update report status and action taken
 */
export async function updateReport(
  reportId: string,
  updates: {
    status?: ReportStatus;
    actionTaken?: string;
  }
): Promise<void> {
  try {
    const docRef = doc(db, REPORTS_COLLECTION, reportId);
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (updates.actionTaken !== undefined) {
      updateData.actionTaken = updates.actionTaken;
    }

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating report:', error);
    throw new Error('Failed to update report');
  }
}

/**
 * Delete/archive a report (only if resolved)
 */
export async function deleteReport(reportId: string): Promise<void> {
  try {
    // First check if the report is resolved
    const report = await getReportById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    if (report.status !== 'resolved') {
      throw new Error('Only resolved reports can be archived');
    }

    const docRef = doc(db, REPORTS_COLLECTION, reportId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting report:', error);
    throw error;
  }
}
