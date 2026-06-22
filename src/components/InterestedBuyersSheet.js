import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(ms / (24 * 3600000));
  return `${days}d ago`;
}

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// Pure visibility tool — no ordering/claim logic. The seller decides who to
// respond to or honor first, entirely on their own; this just shows who's asked.
export default function InterestedBuyersSheet({ visible, onClose, listing, navigation }) {
  const { getInterestedBuyersForListing, messages } = useApp();
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !listing?.id) return;
    setLoading(true);
    getInterestedBuyersForListing(listing.id)
      .then(setBuyers)
      .catch(() => setBuyers([]))
      .finally(() => setLoading(false));
  }, [visible, listing?.id]);

  const handleOpenChat = (buyer) => {
    const thread = messages.find((t) => t.id === buyer.conversationId);
    onClose();
    navigation.navigate('Chat', {
      thread: thread || {
        id: buyer.conversationId,
        dbConversationId: buyer.conversationId,
        with: { id: buyer.buyerId, name: buyer.name },
        listingId: listing.id,
        listingTitle: listing.title,
        messages: [],
      },
      item: listing,
    });
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{listing?.title}</Text>
            <Text style={styles.subtitle}>{buyers.length} interested</Text>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
          ) : (
            <FlatList
              data={buyers}
              keyExtractor={(b) => b.conversationId}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="chatbubbles-outline" size={36} color={colors.primaryLight} />
                  <Text style={styles.emptyText}>No messages about this listing yet</Text>
                </View>
              }
              renderItem={({ item: buyer, index }) => (
                <TouchableOpacity style={styles.row} onPress={() => handleOpenChat(buyer)} activeOpacity={0.7}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(buyer.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.buyerName}>{buyer.name}</Text>
                    <Text style={styles.firstContact}>First messaged {timeAgo(buyer.firstMessageAt)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, paddingHorizontal: 20, paddingBottom: 24,
    maxHeight: '70%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16,
  },
  header: { marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },

  list: { paddingBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rank: { width: 18, fontSize: 12, fontWeight: '700', color: colors.textLight, textAlign: 'center' },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  buyerName: { fontSize: 14, fontWeight: '700', color: colors.text },
  firstContact: { fontSize: 12, color: colors.textLight, marginTop: 1 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, color: colors.textSecondary },
});
