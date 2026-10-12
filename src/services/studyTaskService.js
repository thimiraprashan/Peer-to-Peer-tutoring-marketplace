import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

const VALID_TYPES = ['assignment', 'exam', 'quiz', 'project'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns whole days between today and dueDate (negative if past).
 * Both dates are evaluated at local midnight.
 * @param {string} dueDate - Format YYYY-MM-DD
 * @returns {number}
 */
export const daysUntil = (dueDate) => {
  if (!dueDate || typeof dueDate !== 'string') return 0;
  const parts = dueDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  const [year, month, day] = parts;
  const targetDate = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Formats countdown string based on days remaining.
 * @param {number} days
 * @returns {string} "Due today", "Tomorrow", "X days left", "X days overdue"
 */
export const formatCountdown = (days) => {
  const numDays = typeof days === 'number' ? days : parseInt(days, 10);
  if (isNaN(numDays)) return '';
  if (numDays === 0) return 'Due today';
  if (numDays === 1) return 'Tomorrow';
  if (numDays > 1) return `${numDays} days left`;
  if (numDays === -1) return '1 day overdue';
  return `${Math.abs(numDays)} days overdue`;
};

/**
 * Helper to validate task fields.
 * @param {object} fields
 * @param {boolean} isPartial - If true, only validate defined fields
 */
const validateTaskFields = (fields, isPartial = false) => {
  // Title validation
  if (!isPartial || fields.title !== undefined) {
    if (
      !fields.title ||
      typeof fields.title !== 'string' ||
      fields.title.trim().length < 3 ||
      fields.title.trim().length > 80
    ) {
      throw new Error('Title must be between 3 and 80 characters.');
    }
  }

  // Module code validation
  if (!isPartial || fields.moduleCode !== undefined) {
    if (
      !fields.moduleCode ||
      typeof fields.moduleCode !== 'string' ||
      fields.moduleCode.trim().length < 5 ||
      fields.moduleCode.trim().length > 8
    ) {
      throw new Error('Module code must be between 5 and 8 characters.');
    }
  }

  // Type validation
  if (!isPartial || fields.type !== undefined) {
    if (!fields.type || !VALID_TYPES.includes(fields.type)) {
      throw new Error(
        `Type must be one of: ${VALID_TYPES.join(', ')}.`
      );
    }
  }

  // Due date validation (matches YYYY-MM-DD and is today or later)
  if (!isPartial || fields.dueDate !== undefined) {
    if (
      !fields.dueDate ||
      typeof fields.dueDate !== 'string' ||
      !DATE_REGEX.test(fields.dueDate)
    ) {
      throw new Error('Due date must be in YYYY-MM-DD format.');
    }

    const [year, month, day] = fields.dueDate.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      throw new Error('Due date must be a valid calendar date.');
    }

    if (daysUntil(fields.dueDate) < 0) {
      throw new Error('Due date must be today or later.');
    }
  }

  // Priority validation
  if (!isPartial || fields.priority !== undefined) {
    if (!fields.priority || !VALID_PRIORITIES.includes(fields.priority)) {
      throw new Error(
        `Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`
      );
    }
  }
};

/**
 * Adds a new study task for a student.
 * @param {string} studentId
 * @param {object} taskData - { title, moduleCode, type, dueDate, priority, notes }
 */
export const addStudyTask = async (
  studentId,
  { title, moduleCode, type, dueDate, priority, notes }
) => {
  if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
    throw new Error('Student ID is required.');
  }

  validateTaskFields({ title, moduleCode, type, dueDate, priority });

  const normalizedModuleCode = moduleCode.trim().toUpperCase();
  const trimmedTitle = title.trim();
  const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';

  const docRef = await addDoc(collection(db, 'studyTasks'), {
    studentId,
    title: trimmedTitle,
    moduleCode: normalizedModuleCode,
    type,
    dueDate,
    priority,
    notes: trimmedNotes,
    status: 'todo',
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    studentId,
    title: trimmedTitle,
    moduleCode: normalizedModuleCode,
    type,
    dueDate,
    priority,
    notes: trimmedNotes,
    status: 'todo',
  };
};

/**
 * Retrieves all study tasks for a student, sorted by dueDate ascending in JavaScript.
 * @param {string} studentId
 * @returns {Promise<Array>}
 */
export const getStudyTasks = async (studentId) => {
  if (!studentId) return [];

  const q = query(
    collection(db, 'studyTasks'),
    where('studentId', '==', studentId)
  );

  const snapshot = await getDocs(q);
  const tasks = [];
  snapshot.forEach((docSnap) => {
    tasks.push({
      id: docSnap.id,
      ...docSnap.data(),
    });
  });

  // Sort ascending by dueDate in JavaScript (no Firestore index)
  tasks.sort((a, b) => {
    const dateA = a.dueDate || '';
    const dateB = b.dueDate || '';
    return dateA.localeCompare(dateB);
  });

  return tasks;
};

/**
 * Updates an existing study task with the provided fields.
 * @param {string} taskId
 * @param {object} fields
 */
export const updateStudyTask = async (taskId, fields) => {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Task ID is required.');
  }
  if (!fields || typeof fields !== 'object') {
    throw new Error('Update fields must be an object.');
  }

  validateTaskFields(fields, true);

  const updateData = {};
  if (fields.title !== undefined) updateData.title = fields.title.trim();
  if (fields.moduleCode !== undefined) {
    updateData.moduleCode = fields.moduleCode.trim().toUpperCase();
  }
  if (fields.type !== undefined) updateData.type = fields.type;
  if (fields.dueDate !== undefined) updateData.dueDate = fields.dueDate;
  if (fields.priority !== undefined) updateData.priority = fields.priority;
  if (fields.status !== undefined) {
    if (fields.status !== 'todo' && fields.status !== 'done') {
      throw new Error('Status must be either "todo" or "done".');
    }
    updateData.status = fields.status;
  }
  if (fields.notes !== undefined) {
    updateData.notes = typeof fields.notes === 'string' ? fields.notes.trim() : '';
  }

  updateData.updatedAt = serverTimestamp();

  await updateDoc(doc(db, 'studyTasks', taskId), updateData);
};

/**
 * Sets task status to 'todo' or 'done'.
 * @param {string} taskId
 * @param {'todo' | 'done'} status
 */
export const setTaskStatus = async (taskId, status) => {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Task ID is required.');
  }
  if (status !== 'todo' && status !== 'done') {
    throw new Error('Status must be either "todo" or "done".');
  }

  await updateDoc(doc(db, 'studyTasks', taskId), {
    status,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Deletes a study task by its document ID.
 * @param {string} taskId
 */
export const deleteStudyTask = async (taskId) => {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Task ID is required.');
  }

  await deleteDoc(doc(db, 'studyTasks', taskId));
};
