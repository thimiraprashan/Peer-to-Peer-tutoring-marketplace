import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// CREATE: register a new user and save the profile
export const registerUser = async (name, email, password, role) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
        name,
        email,
        role,
        status: 'active',
        createdAt: serverTimestamp(),
    });
    return { uid: cred.user.uid, name, email, role };
};

// READ: get the profile (role) of a user
export const getUserProfile = async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
};

// LOGIN: sign in, then load the profile
export const loginUser = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return getUserProfile(cred.user.uid);
};

export const logoutUser = () => signOut(auth);