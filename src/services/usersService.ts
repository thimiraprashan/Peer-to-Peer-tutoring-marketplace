import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: string;
  faculty?: string;
  university?: string;
  status: 'active' | 'suspended';
  createdAt?: Date;
}

const USERS_COLLECTION = 'users';

/**
 * Get all users from Firestore
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const users: User[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        uid: docSnap.id,
        name: data.name || 'Unknown User',
        email: data.email || '',
        role: data.role || 'student',
        faculty: data.faculty || '',
        university: data.university || '',
        status: data.status || 'active',
        createdAt: data.createdAt?.toDate(),
      });
    });

    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new Error('Failed to fetch users');
  }
}

/**
 * Get a single user by ID
 */
export async function getUserById(uid: string): Promise<User | null> {
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      uid: docSnap.id,
      name: data.name || 'Unknown User',
      email: data.email || '',
      role: data.role || 'student',
      faculty: data.faculty || '',
      university: data.university || '',
      status: data.status || 'active',
      createdAt: data.createdAt?.toDate(),
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    throw new Error('Failed to fetch user');
  }
}

/**
 * Update user status (suspend or reactivate)
 */
export async function updateUserStatus(
  uid: string,
  status: 'active' | 'suspended'
): Promise<void> {
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    throw new Error('Failed to update user status');
  }
}

/**
 * Delete a user from Firestore
 */
export async function deleteUser(uid: string): Promise<void> {
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new Error('Failed to delete user');
  }
}
