import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { getUserProfile } from '../services/authService';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  faculty?: string;
  university?: string;
  [key: string]: any;
}

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userProfile = await getUserProfile(firebaseUser.uid);
          setProfile(userProfile as UserProfile | null);
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (auth.currentUser) {
      try {
        const userProfile = await getUserProfile(auth.currentUser.uid);
        setProfile(userProfile as UserProfile | null);
        return userProfile;
      } catch (error) {
        console.error('Error refreshing profile:', error);
      }
    }
  };

  return { user, profile, setProfile, loading, refreshProfile };
}
