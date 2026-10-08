/**
 * chatService.ts
 * Firestore + Firebase Storage operations for the Chat / Messaging module.
 *
 * Firestore schema:
 *   conversations/{conversationId}
 *     - participants: string[]          (array of user UIDs)
 *     - participantNames: {uid: name}   (map for display)
 *     - lastMessage: string
 *     - lastMessageTime: Timestamp
 *     - lastSenderId: string
 *     - unreadCount: {uid: number}      (per-user unread count)
 *     - createdAt: Timestamp
 *
 *   conversations/{conversationId}/messages/{messageId}
 *     - senderId: string
 *     - senderName: string
 *     - text: string
 *     - attachmentUrl: string | null
 *     - attachmentName: string | null
 *     - attachmentType: string | null   ('image' | 'file')
 *     - createdAt: Timestamp
 *     - deletedAt: Timestamp | null
 */

import {
  addDoc,
  collection,
  deleteDoc,
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
  where,
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
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage: string;
  lastMessageTime: Timestamp | null;
  lastSenderId: string;
  unreadCount: Record<string, number>;
  createdAt: Timestamp | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: 'image' | 'file' | null;
  createdAt: Timestamp | null;
  deletedAt: Timestamp | null;
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
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTime', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snap) => {
      const convs: Conversation[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Conversation, 'id'>),
      }));
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
    where('participants', 'array-contains', currentUserId)
  );
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const data = d.data() as Omit<Conversation, 'id'>;
    if (
      data.participants.length === 2 &&
      data.participants.includes(otherUserId)
    ) {
      return d.id;
    }
  }

  // Create new conversation
  const convRef = doc(collection(db, 'conversations'));
  await setDoc(convRef, {
    participants: [currentUserId, otherUserId],
    participantNames: {
      [currentUserId]: currentUserName,
      [otherUserId]: otherUserName,
    },
    lastMessage: '',
    lastMessageTime: serverTimestamp(),
    lastSenderId: '',
    unreadCount: { [currentUserId]: 0, [otherUserId]: 0 },
    createdAt: serverTimestamp(),
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
    orderBy('createdAt', 'asc'),
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
    senderName,
    text: trimmed,
    attachmentUrl: null,
    attachmentName: null,
    attachmentType: null,
    createdAt: serverTimestamp(),
    deletedAt: null,
  });

  // Update conversation metadata
  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: trimmed,
    lastMessageTime: serverTimestamp(),
    lastSenderId: senderId,
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
  const isImage = mimeType.startsWith('image/');

  const msgRef = collection(db, 'conversations', conversationId, 'messages');
  await addDoc(msgRef, {
    senderId,
    senderName,
    text: captionText.trim(),
    attachmentUrl: downloadUrl,
    attachmentName: fileName,
    attachmentType: isImage ? 'image' : 'file',
    createdAt: serverTimestamp(),
    deletedAt: null,
  });

  const preview = captionText.trim() || `📎 ${fileName}`;
  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: preview,
    lastMessageTime: serverTimestamp(),
    lastSenderId: senderId,
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
    deletedAt: serverTimestamp(),
    text: '',
    attachmentUrl: null,
    attachmentName: null,
    attachmentType: null,
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
  const users: Array<{ uid: string; name: string; email: string; role: string }> = [];
  snap.forEach((d) => {
    if (d.id !== currentUserId) {
      const data = d.data();
      users.push({
        uid: d.id,
        name: data.name || 'Unknown User',
        email: data.email || '',
        role: data.role || 'student',
      });
    }
  });
  return users;
}
