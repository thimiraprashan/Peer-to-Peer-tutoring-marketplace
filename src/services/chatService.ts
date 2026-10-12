/**
 * chatService.ts
 * Firestore + Firebase Storage operations for the Chat / Messaging module.
 *
 * Required Firestore schema:
 *   conversations/{conversationId}
 *     - participantIds: string[]        (array of user UIDs)
 *     - lastMessage: string
 *     - lastMessageAt: Timestamp
 *
 *   conversations/{conversationId}/messages/{messageId}
 *     - senderId: string
 *     - text: string
 *     - attachmentUrl: string | null
 *     - attachmentName: string | null
 *     - sentAt: Timestamp
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { db, storage } from '../firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  // Legacy fields for backward compatibility (not stored in new conversations)
  participants?: string[];
  participantNames?: Record<string, string>;
  lastMessageTime?: Timestamp | null;
  lastSenderId?: string;
  unreadCount?: Record<string, number>;
  createdAt?: Timestamp | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  sentAt: Timestamp | null;
  // Legacy fields for backward compatibility
  senderName?: string;
  attachmentType?: 'image' | 'file' | null;
  createdAt?: Timestamp | null;
  deletedAt?: Timestamp | null;
}

// ─── Conversation helpers ─────────────────────────────────────────────────────

/**
 * Subscribe to all conversations the current user participates in.
 * Returns an unsubscribe function.
 */
export function subscribeToConversations(
  userId: string,
  onUpdate: (convs: Conversation[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'conversations'),
    where('participantIds', 'array-contains', userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const convs: Conversation[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Conversation, 'id'>),
      }));
      // Sort client-side by lastMessageAt descending
      convs.sort((a, b) => {
        const timeA =
          a.lastMessageAt?.toMillis?.() ??
          a.lastMessageTime?.toMillis?.() ??
          0;
        const timeB =
          b.lastMessageAt?.toMillis?.() ??
          b.lastMessageTime?.toMillis?.() ??
          0;
        return timeB - timeA;
      });
      onUpdate(convs);
    },
    (err) => {
      console.error('subscribeToConversations error:', err);
      onError?.(err as Error);
    }
  );
}

/**
 * Find an existing 1-to-1 conversation between two users,
 * or create one if it does not yet exist.
 */
export async function getOrCreateConversation(
  currentUserId: string,
  currentUserName: string,
  otherUserId: string,
  otherUserName: string
): Promise<string> {
  // Check for existing conversation with both participants
  const q = query(
    collection(db, 'conversations'),
    where('participantIds', 'array-contains', currentUserId)
  );
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const data = d.data() as Omit<Conversation, 'id'>;
    if (
      data.participantIds &&
      data.participantIds.length === 2 &&
      data.participantIds.includes(otherUserId)
    ) {
      // If participantNames is missing or incomplete, patch it
      if (
        !data.participantNames ||
        !data.participantNames[currentUserId] ||
        !data.participantNames[otherUserId]
      ) {
        updateDoc(doc(db, 'conversations', d.id), {
          participantNames: {
            ...(data.participantNames || {}),
            [currentUserId]: currentUserName || 'User',
            [otherUserId]: otherUserName || 'User',
          },
        }).catch(() => {});
      }
      return d.id;
    }
  }

  // Create new conversation with required schema and participantNames
  const convRef = doc(collection(db, 'conversations'));
  await setDoc(convRef, {
    participantIds: [currentUserId, otherUserId],
    participantNames: {
      [currentUserId]: currentUserName || 'User',
      [otherUserId]: otherUserName || 'User',
    },
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
  });

  return convRef.id;
}

/**
 * Fetch a single conversation document by ID.
 */
export async function getConversation(
  conversationId: string
): Promise<Conversation | null> {
  const snap = await getDoc(doc(db, 'conversations', conversationId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Conversation, 'id'>) };
}

// ─── Message helpers ──────────────────────────────────────────────────────────

/**
 * Subscribe to messages in a conversation (real-time).
 */
export function subscribeToMessages(
  conversationId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('sentAt', 'asc'),
    limit(200)
  );

  return onSnapshot(
    q,
    (snap) => {
      const messages: ChatMessage[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChatMessage, 'id'>),
      }));
      onUpdate(messages);
    },
    (err) => {
      console.error('subscribeToMessages error:', err);
      onError?.(err as Error);
    }
  );
}

/**
 * Send a text message (no attachment).
 */
export async function sendTextMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const msgRef = collection(db, 'conversations', conversationId, 'messages');
  await addDoc(msgRef, {
    senderId,
    text: trimmed,
    attachmentUrl: null,
    attachmentName: null,
    sentAt: serverTimestamp(),
  });

  // Update conversation metadata
  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: trimmed,
    lastMessageAt: serverTimestamp(),
  });
}

/**
 * Upload a file attachment to Firebase Storage and send it as a message.
 * @param uri      Local URI of the file (from expo-document-picker / expo-image-picker)
 * @param fileName Original file name
 * @param mimeType MIME type of the file
 */
export async function sendAttachmentMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  uri: string,
  fileName: string,
  mimeType: string,
  captionText: string = ''
): Promise<void> {
  // Convert local URI to blob
  const response = await fetch(uri);
  const blob = await response.blob();

  const storagePath = `chat_attachments/${conversationId}/${Date.now()}_${fileName}`;
  const storageRef = ref(storage, storagePath);

  // Upload
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob, { contentType: mimeType });
    task.on('state_changed', null, reject, () => resolve());
  });

  const downloadUrl = await getDownloadURL(storageRef);

  const msgRef = collection(db, 'conversations', conversationId, 'messages');
  await addDoc(msgRef, {
    senderId,
    text: captionText.trim(),
    attachmentUrl: downloadUrl,
    attachmentName: fileName,
    sentAt: serverTimestamp(),
  });

  const preview = captionText.trim() || `📎 ${fileName}`;
  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: preview,
    lastMessageAt: serverTimestamp(),
  });
}

/**
 * Soft-delete a message by setting deletedAt timestamp.
 * Only the sender should be allowed to call this.
 */
export async function deleteOwnMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  const msgRef = doc(
    db,
    'conversations',
    conversationId,
    'messages',
    messageId
  );
  await updateDoc(msgRef, {
    text: '',
    attachmentUrl: null,
    attachmentName: null,
  });
}

/**
 * Fetch all users from the `users` collection to populate the "New Conversation" selector.
 * Returns users excluding the current logged-in user.
 */
export async function fetchAllUsers(
  currentUserId: string
): Promise<Array<{ uid: string; name: string; email: string; role: string }>> {
  const snap = await getDocs(collection(db, 'users'));

  const users: Array<{
    uid: string;
    name: string;
    email: string;
    role: string;
  }> = [];

  snap.forEach((docSnap) => {
    const data = docSnap.data();

    // Only exclude the current user by UID
    if (docSnap.id !== currentUserId) {
      const user = {
        uid: docSnap.id,
        name: data.name || data.displayName || 'Unknown User',
        email: data.email || '',
        role: data.role || 'student',
      };
      users.push(user);
    }
  });

  return users;
}