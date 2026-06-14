import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { onProfilePress } from '../lib/profilePress';
import colors from '../theme/colors';

function ThreadRow({ item, onPress, navigation, listings }) {
  const isUnread = item.markedUnread || item.unread > 0;
  const isMuted = !!item.muted;
  const isPinned = !!item.pinned;

  return (
    <TouchableOpacity style={styles.thread} onPress={onPress} activeOpacity={0.85}>
      {/* Avatar — tap to open profile */}
      <TouchableOpacity
        style={styles.avatarWrap}
        onPress={() => onProfilePress(item.with.id, navigation, listings)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.avatar}>
          <Ionicons name="person" size={22} color={colors.primaryLight} />
        </View>
        {isPinned && (
          <View style={styles.pinDot}>
            <Ionicons name="pin" size={9} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.threadInfo}>
        <View style={styles.threadTop}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, isUnread && styles.nameUnread]}>{item.with.name}</Text>
            {isMuted && (
              <Ionicons name="notifications-off" size={13} color={colors.textLight} />
            )}
          </View>
          <Text style={[styles.time, isUnread && styles.timeUnread]}>{item.timestamp}</Text>
        </View>
        <Text style={styles.listingName} numberOfLines={1}>{item.listingTitle}</Text>
        <Text style={[styles.lastMsg, isUnread && styles.lastMsgUnread]} numberOfLines={1}>
          {item.lastMessage || 'New conversation'}
        </Text>
      </View>

      {/* Unread badge */}
      {isUnread ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread || '●'}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function SwipeableThreadRow({ item, onPress, onDelete, navigation, listings }) {
  const swipeRef = useRef(null);

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => { swipeRef.current?.close(); onDelete(item); }}
      activeOpacity={0.85}
    >
      <Ionicons name="trash-outline" size={20} color="#fff" />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <ThreadRow item={item} onPress={onPress} navigation={navigation} listings={listings} />
    </Swipeable>
  );
}

export default function MessagesScreen({ navigation }) {
  const { visibleMessages: messages, userType, signOut, unarchiveThread, deleteThread, listings } = useApp();
  const [tab, setTab] = useState('inbox'); // 'inbox' | 'archived'
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const deleteTimerRef = useRef(null);

  const handleDeleteThread = useCallback((thread) => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setPendingDeleteId(thread.id);
    deleteTimerRef.current = setTimeout(() => {
      deleteThread(thread.id);
      setPendingDeleteId(null);
    }, 4000);
  }, [deleteThread]);

  const handleUndo = useCallback(() => {
    clearTimeout(deleteTimerRef.current);
    setPendingDeleteId(null);
  }, []);

  const inbox = messages.filter((m) => !m.archived);
  const archived = messages.filter((m) => m.archived);
  const totalUnread = inbox.reduce((acc, m) => acc + (m.markedUnread ? 1 : m.unread || 0), 0);

  // Split inbox into pinned boxes + regular list
  const pinnedThreads = inbox.filter((m) => m.pinned && m.id !== pendingDeleteId);
  const regularThreads = inbox.filter((m) => !m.pinned && m.id !== pendingDeleteId);
  const archivedFiltered = archived.filter((m) => m.id !== pendingDeleteId);

  const isInbox = tab === 'inbox';
  const listData = isInbox ? regularThreads : archivedFiltered;
  const hasContent = listData.length > 0 || (isInbox && pinnedThreads.length > 0);

  const renderThread = ({ item }) => (
    <SwipeableThreadRow
      item={item}
      onPress={() => navigation.navigate('Chat', { thread: item })}
      onDelete={handleDeleteThread}
      navigation={navigation}
      listings={listings}
    />
  );

  const renderArchivedThread = ({ item }) => (
    <View style={styles.archivedRow}>
      <TouchableOpacity
        style={[styles.thread, { flex: 1 }]}
        onPress={() => navigation.navigate('Chat', { thread: item })}
        activeOpacity={0.85}
      >
        <View style={styles.avatar}>
          <Ionicons name="person" size={22} color={colors.primaryLight} />
        </View>
        <View style={styles.threadInfo}>
          <View style={styles.threadTop}>
            <Text style={styles.name}>{item.with.name}</Text>
            <Text style={styles.time}>{item.timestamp}</Text>
          </View>
          <Text style={styles.listingName} numberOfLines={1}>{item.listingTitle}</Text>
          <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage || 'Archived conversation'}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.unarchiveBtn}
        onPress={() => unarchiveThread(item.id)}
      >
        <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  if (userType === 'guest') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.wall}>
          <View style={styles.wallIconWrap}>
            <Ionicons name="lock-closed" size={36} color={colors.primary} />
          </View>
          <Text style={styles.wallTitle}>Messages require an account</Text>
          <Text style={styles.wallSub}>
            Create a free account to message sellers, ask questions, and arrange meetups with Hosts near you.
          </Text>
          <TouchableOpacity style={styles.wallBtn} onPress={signOut} activeOpacity={0.85}>
            <Ionicons name="storefront-outline" size={18} color="#fff" />
            <Text style={styles.wallBtnText}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.wallBack}>
            <Text style={styles.wallBackText}>Keep browsing</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'inbox' && styles.tabBtnActive]}
          onPress={() => setTab('inbox')}
        >
          <Text style={[styles.tabLabel, tab === 'inbox' && styles.tabLabelActive]}>Inbox</Text>
          {inbox.length > 0 && (
            <Text style={[styles.tabCount, tab === 'inbox' && styles.tabCountActive]}>
              {inbox.length}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'archived' && styles.tabBtnActive]}
          onPress={() => setTab('archived')}
        >
          <Text style={[styles.tabLabel, tab === 'archived' && styles.tabLabelActive]}>Archived</Text>
          {archived.length > 0 && (
            <Text style={[styles.tabCount, tab === 'archived' && styles.tabCountActive]}>
              {archived.length}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Undo delete toast */}
      {pendingDeleteId && (
        <View style={styles.undoToast}>
          <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.7)" />
          <Text style={styles.undoToastText}>Conversation deleted</Text>
          <TouchableOpacity onPress={handleUndo} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.undoToastBtn}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Thread list */}
      {!hasContent ? (
        <View style={styles.empty}>
          {isInbox ? (
            <>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.primaryLight} />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>When you message a Host about an item, it'll show up here.</Text>
            </>
          ) : (
            <>
              <Ionicons name="archive-outline" size={64} color={colors.primaryLight} />
              <Text style={styles.emptyTitle}>No archived chats</Text>
              <Text style={styles.emptySub}>Archived conversations will appear here.</Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(m) => m.id}
          renderItem={isInbox ? renderThread : renderArchivedThread}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListHeaderComponent={isInbox && pinnedThreads.length > 0 ? () => (
            <View style={styles.pinnedSection}>
              <View style={styles.pinnedSectionHeader}>
                <Ionicons name="pin" size={13} color={colors.textSecondary} />
                <Text style={styles.pinnedSectionLabel}>Pinned</Text>
              </View>
              {pinnedThreads.map((thread) => {
                const isUnread = thread.markedUnread || thread.unread > 0;
                return (
                  <TouchableOpacity
                    key={thread.id}
                    style={styles.pinnedCard}
                    onPress={() => navigation.navigate('Chat', { thread })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.pinnedAvatar}>
                      <Ionicons name="person" size={18} color={colors.primaryLight} />
                    </View>
                    <View style={styles.pinnedInfo}>
                      <View style={styles.pinnedTop}>
                        <Text style={[styles.pinnedName, isUnread && styles.pinnedNameUnread]} numberOfLines={1}>
                          {thread.with.name}
                        </Text>
                        <Text style={styles.pinnedTime}>{thread.timestamp}</Text>
                      </View>
                      <Text style={styles.pinnedListing} numberOfLines={1}>{thread.listingTitle}</Text>
                      <Text style={[styles.pinnedMsg, isUnread && styles.pinnedMsgUnread]} numberOfLines={1}>
                        {thread.lastMessage || 'New conversation'}
                      </Text>
                    </View>
                    <View style={styles.pinnedMeta}>
                      <Ionicons name="pin" size={11} color={colors.primary} />
                      {isUnread && (
                        <View style={styles.pinnedBadge}>
                          <Text style={styles.pinnedBadgeText}>{thread.unread || '●'}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {listData.length > 0 && <View style={styles.pinnedDivider} />}
            </View>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerBadge: {
    backgroundColor: colors.badge,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.cardBackground,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textLight,
  },
  tabCountActive: {
    color: 'rgba(255,255,255,0.8)',
  },

  // Thread row
  list: { padding: 16 },
  thread: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCE9F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.cardBackground,
  },
  threadInfo: { flex: 1 },
  threadTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  nameUnread: { fontWeight: '800' },
  time: { fontSize: 12, color: colors.textLight },
  timeUnread: { color: colors.primary, fontWeight: '600' },
  listingName: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 2,
  },
  lastMsg: { fontSize: 13, color: colors.textSecondary },
  lastMsgUnread: { color: colors.text, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  divider: { height: 8 },

  // Archived row
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unarchiveBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Guest wall
  wall: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 14,
  },
  wallIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  wallTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  wallSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  wallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  wallBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  wallBack: { paddingVertical: 8 },
  wallBackText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },

  // Pinned section
  pinnedSection: {
    marginBottom: 4,
  },
  pinnedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  pinnedSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pinnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '0C',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.primary + '22',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  pinnedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCE9F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedInfo: { flex: 1, gap: 1 },
  pinnedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 1,
  },
  pinnedName: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  pinnedNameUnread: { fontWeight: '800' },
  pinnedTime: { fontSize: 11, color: colors.textLight },
  pinnedListing: { fontSize: 11, color: colors.primary, fontWeight: '500' },
  pinnedMsg: { fontSize: 12, color: colors.textSecondary },
  pinnedMsgUnread: { color: colors.text, fontWeight: '600' },
  pinnedMeta: {
    alignItems: 'flex-end',
    gap: 5,
  },
  pinnedBadge: {
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pinnedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pinnedDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
    marginTop: 4,
  },

  // Swipe-to-delete
  deleteAction: {
    width: 80,
    marginLeft: 8,
    backgroundColor: colors.danger,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Undo toast
  undoToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  undoToastText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  undoToastBtn: {
    fontSize: 14,
    color: colors.primaryLight,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
