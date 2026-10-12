/**
 * messages.tsx (Tutor tab)
 * Tutor Messaging Screen — Displays real-time conversations from students.
 * Tapping a conversation opens the Chat Detail screen (/chat/[conversationId])
 * allowing the tutor to read incoming messages and reply.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConversationItem } from '../../../components/chat/ConversationItem';
import { Avatar } from '../../../components/ui/Avatar';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import {
  Conversation,
  fetchAllUsers,
  getOrCreateConversation,
  subscribeToConversations,
} from '../../../services/chatService';
import { colors } from '../../../theme/colors';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

export default function TutorMessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useCurrentUser();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cached participant names map: userId -> string
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  // New message / student selector modal
  const [newModalVisible, setNewModalVisible] = useState<boolean>(false);
  const [students, setStudents] = useState<
    Array<{ uid: string; name: string; email: string; role: string }>
  >([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [startingChat, setStartingChat] = useState<boolean>(false);

  const unsubRef = useRef<(() => void) | null>(null);

  // Subscribe to tutor's conversations in real time
  const subscribe = useCallback(() => {
    if (!user?.uid) return;

    unsubRef.current?.();
    setLoading(true);
    setError(null);

    unsubRef.current = subscribeToConversations(
      user.uid,
      (convs) => {
        setConversations(convs);
        setLoading(false);
        setRefreshing(false);

        // Resolve any unknown participant names
        convs.forEach((conv) => {
          const participantList = conv.participantIds || conv.participants || [];
          const otherId = participantList.find((p) => p !== user.uid);
          if (otherId && !conv.participantNames?.[otherId]) {
            // Fetch name asynchronously if not cached
            if (!resolvedNames[otherId]) {
              getDoc(doc(db, 'users', otherId))
                .then((snap) => {
                  if (snap.exists()) {
                    const data = snap.data();
                    const name = data.name || data.displayName || 'Student';
                    setResolvedNames((prev) => ({ ...prev, [otherId]: name }));
                  }
                })
                .catch(() => {});
            }
          }
        });
      },
      (err) => {
        console.error('Tutor subscribeToConversations error:', err);
        setError('Failed to load messages. Pull down to retry.');
        setLoading(false);
        setRefreshing(false);
      }
    );
  }, [user?.uid]);

  useEffect(() => {
    subscribe();
    return () => unsubRef.current?.();
  }, [subscribe]);

  const handleRefresh = () => {
    setRefreshing(true);
    subscribe();
  };

  // Helper to determine the other participant (the student)
  const getOtherParticipant = (conv: Conversation) => {
    if (!user?.uid) return { uid: '', name: 'Student' };
    const participantList = conv.participantIds || conv.participants || [];
    const otherId = participantList.find((p) => p !== user.uid) || '';
    const name =
      conv.participantNames?.[otherId] ||
      resolvedNames[otherId] ||
      'Student';
    return { uid: otherId, name };
  };

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((conv) => {
      const other = getOtherParticipant(conv);
      const nameMatch = other.name.toLowerCase().includes(q);
      const msgMatch = (conv.lastMessage || '').toLowerCase().includes(q);
      return nameMatch || msgMatch;
    });
  }, [conversations, searchQuery, resolvedNames]);

  // Open modal to message a student
  const openNewChatModal = async () => {
    if (!user?.uid) return;
    setNewModalVisible(true);
    setModalSearch('');
    setLoadingStudents(true);
    try {
      const all = await fetchAllUsers(user.uid);
      setStudents(all);
    } catch {
      // ignore
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleStartChatWithUser = async (other: { uid: string; name: string }) => {
    if (!user?.uid) return;
    setStartingChat(true);
    try {
      const convId = await getOrCreateConversation(
        user.uid,
        profile?.name || 'Tutor',
        other.uid,
        other.name
      );
      setNewModalVisible(false);
      router.push(`/chat/${convId}` as any);
    } catch (e: any) {
      console.warn('Could not start conversation:', e);
    } finally {
      setStartingChat(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!modalSearch.trim()) return students;
    const q = modalSearch.trim().toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [students, modalSearch]);

  const renderConversation = ({ item }: { item: Conversation }) => {
    const other = getOtherParticipant(item);
    const myUnread = item.unreadCount?.[user?.uid || ''] ?? 0;

    return (
      <ConversationItem
        otherName={other.name}
        lastMessage={item.lastMessage}
        lastMessageTime={(item.lastMessageAt || item.lastMessageTime) ?? null}
        unreadCount={myUnread}
        onPress={() => router.push(`/chat/${item.id}` as any)}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top + 12, 44) },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Messages</Text>
            <Text style={styles.headerSubtitle}>
              {conversations.length > 0
                ? `${conversations.length} conversation${
                    conversations.length === 1 ? '' : 's'
                  } with students`
                : 'Student communications & inquiries'}
            </Text>
          </View>

          <Pressable
            style={styles.composeBtn}
            onPress={openNewChatModal}
            accessibilityRole="button"
            accessibilityLabel="Message a student"
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={17}
            color={colors.mutedText}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search student messages..."
            placeholderTextColor={colors.mutedText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.mutedText} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading student messages...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedText} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={subscribe}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="chatbubbles-outline" size={42} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching conversations' : 'No student messages yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Try searching with a different student name.'
              : 'When students send inquiries or message you about sessions, their messages will appear here. You can reply instantly!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}

      {/* New Conversation Modal */}
      <Modal
        visible={newModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNewModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !startingChat && setNewModalVisible(false)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            <Text style={styles.modalTitle}>Contact Student</Text>
            <Text style={styles.modalSubtitle}>Select a student to start chatting</Text>

            <View style={styles.modalSearchBox}>
              <Ionicons
                name="search-outline"
                size={18}
                color={colors.mutedText}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search by student name or email..."
                placeholderTextColor={colors.mutedText}
                value={modalSearch}
                onChangeText={setModalSearch}
                autoCorrect={false}
              />
              {modalSearch.length > 0 && (
                <Pressable onPress={() => setModalSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedText} />
                </Pressable>
              )}
            </View>

            {loadingStudents ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : filteredStudents.length === 0 ? (
              <View style={styles.modalCenter}>
                <Text style={styles.noUsersText}>
                  {modalSearch ? 'No students match your search.' : 'No other students found.'}
                </Text>
              </View>
            ) : (
              <View style={styles.userList}>
                {filteredStudents.map((u) => (
                  <Pressable
                    key={u.uid}
                    style={({ pressed }) => [
                      styles.userRow,
                      pressed && styles.userRowPressed,
                      startingChat && { opacity: 0.6 },
                    ]}
                    onPress={() => !startingChat && handleStartChatWithUser(u)}
                  >
                    <Avatar name={u.name} size={42} />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{u.name}</Text>
                      <Text style={styles.userRole}>
                        {u.role.charAt(0).toUpperCase() + u.role.slice(1)} · {u.email}
                      </Text>
                    </View>
                    <Ionicons
                      name="chatbubble-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  composeBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '600',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: 16,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  modalCenter: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  noUsersText: {
    color: colors.mutedText,
    fontSize: 14,
  },
  userList: {
    maxHeight: 400,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  userRowPressed: {
    backgroundColor: colors.lightGreen,
    borderRadius: 10,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  userRole: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
});