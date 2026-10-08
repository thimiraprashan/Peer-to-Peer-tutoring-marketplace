/**
 * messages.tsx (student tab)
 * Conversation List screen — shows all conversations for the current user.
 * Tapping a conversation navigates to the Chat Detail screen.
 * The "+" FAB opens a New Conversation modal to start a chat with any user.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Avatar } from '../../components/ui/Avatar';
import { ConversationItem } from '../../components/chat/ConversationItem';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  Conversation,
  fetchAllUsers,
  getOrCreateConversation,
  subscribeToConversations,
} from '../../services/chatService';

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useCurrentUser();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New conversation modal state
  const [newConvModalVisible, setNewConvModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<
    Array<{ uid: string; name: string; email: string; role: string }>
  >([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingConv, setCreatingConv] = useState(false);

  const unsubRef = useRef<(() => void) | null>(null);

  // Subscribe to conversations in real time
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
      },
      (err) => {
        setError('Failed to load conversations. Pull to retry.');
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

  // Open the user selector modal
  const openNewConversation = async () => {
    setNewConvModalVisible(true);
    setSearchQuery('');
    setUsersLoading(true);
    try {
      const users = await fetchAllUsers(user!.uid);
      setAllUsers(users);
    } catch {
      Alert.alert('Error', 'Could not load users. Please try again.');
    } finally {
      setUsersLoading(false);
    }
  };

  const startConversation = async (otherUser: {
    uid: string;
    name: string;
  }) => {
    if (!user?.uid || !profile?.name) return;
    setCreatingConv(true);
    try {
      const convId = await getOrCreateConversation(
        user.uid,
        profile.name,
        otherUser.uid,
        otherUser.name
      );
      setNewConvModalVisible(false);
      router.push(`/chat/${convId}` as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not start conversation.');
    } finally {
      setCreatingConv(false);
    }
  };

  // Get display name of the other participant
  const getOtherParticipant = (conv: Conversation) => {
    if (!user?.uid) return { uid: '', name: 'Unknown' };
    const otherId = conv.participants.find((p) => p !== user.uid) || '';
    const name = conv.participantNames?.[otherId] || 'Unknown User';
    return { uid: otherId, name };
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderConversation = ({ item }: { item: Conversation }) => {
    const other = getOtherParticipant(item);
    const myUnread = item.unreadCount?.[user?.uid || ''] ?? 0;

    return (
      <ConversationItem
        otherName={other.name}
        lastMessage={item.lastMessage}
        lastMessageTime={item.lastMessageTime}
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
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>
            {conversations.length > 0
              ? `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}`
              : 'Your conversations'}
          </Text>
        </View>
        <Pressable
          style={styles.newButton}
          onPress={openNewConversation}
          accessibilityRole="button"
          accessibilityLabel="Start new conversation"
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedText} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={subscribe}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the compose button above to start a new conversation.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        />
      )}

      {/* New Conversation Modal */}
      <Modal
        visible={newConvModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNewConvModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !creatingConv && setNewConvModalVisible(false)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal handle */}
            <View style={styles.sheetHandle} />

            <Text style={styles.modalTitle}>New Conversation</Text>
            <Text style={styles.modalSubtitle}>Select a user to message</Text>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Ionicons
                name="search-outline"
                size={18}
                color={colors.mutedText}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or email..."
                placeholderTextColor={colors.mutedText}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedText} />
                </Pressable>
              )}
            </View>

            {usersLoading ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : filteredUsers.length === 0 ? (
              <View style={styles.modalCenter}>
                <Text style={styles.noUsersText}>
                  {searchQuery ? 'No users match your search.' : 'No other users found.'}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.userList}
                showsVerticalScrollIndicator={false}
              >
                {filteredUsers.map((u) => (
                  <Pressable
                    key={u.uid}
                    style={({ pressed }) => [
                      styles.userRow,
                      pressed && styles.userRowPressed,
                      creatingConv && styles.userRowDisabled,
                    ]}
                    onPress={() => !creatingConv && startConversation(u)}
                    accessibilityRole="button"
                    accessibilityLabel={`Start conversation with ${u.name}`}
                  >
                    <Avatar name={u.name} size={42} />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{u.name}</Text>
                      <Text style={styles.userRole}>
                        {u.role.charAt(0).toUpperCase() + u.role.slice(1)} ·{' '}
                        {u.email}
                      </Text>
                    </View>
                    {creatingConv ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons
                        name="chatbubble-outline"
                        size={18}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.card,
  },
  headerLeft: {},
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  newButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E8D5FF',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#E8D5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal
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
  searchContainer: {
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
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    height: '100%',
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
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  userRowPressed: {
    backgroundColor: '#E8D5FF',
    borderRadius: 10,
  },
  userRowDisabled: {
    opacity: 0.6,
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
