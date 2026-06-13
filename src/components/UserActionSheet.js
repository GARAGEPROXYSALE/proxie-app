import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function UserActionSheet({ visible, onClose, seller, listing, navigation }) {
  const { startConversation, messages, blockUser } = useApp();
  const [confirmBlock, setConfirmBlock] = useState(false);

  if (!seller) return null;

  const close = () => {
    setConfirmBlock(false);
    onClose();
  };

  const handleViewProfile = () => {
    close();
    navigation.navigate('SellerProfile', { seller, listing });
  };

  const handleMessage = () => {
    close();
    if (!listing) return;
    try {
      const thread = startConversation(listing);
      navigation.navigate('Chat', { thread, item: listing });
    } catch (e) {
      console.error('[UserActionSheet] message nav failed:', e);
    }
  };

  const handleBlockConfirmed = () => {
    blockUser(seller.id);
    close();
    // Navigate back since their content will now be hidden
    navigation.goBack();
  };

  // ── Confirm block panel ──────────────────────────────────────
  const renderConfirm = () => (
    <View style={styles.confirmPanel}>
      <View style={styles.blockIconWrap}>
        <Ionicons name="ban-outline" size={32} color={colors.danger} />
      </View>
      <Text style={styles.confirmTitle}>Block {seller.name}?</Text>
      <Text style={styles.confirmSub}>
        Their listings will be hidden from your feed and you won't be able to message each other.
      </Text>
      <TouchableOpacity style={styles.blockBtn} onPress={handleBlockConfirmed} activeOpacity={0.85}>
        <Text style={styles.blockBtnText}>Block</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelRow} onPress={() => setConfirmBlock(false)}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Main sheet ───────────────────────────────────────────────
  const renderMain = () => (
    <>
      {/* Seller identity — non-tappable header */}
      <View style={styles.sellerHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{initials(seller.name)}</Text>
        </View>
        <View style={styles.sellerMeta}>
          <Text style={styles.sellerName}>{seller.name}</Text>
          {seller.rating != null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#FFB800" />
              <Text style={styles.ratingText}>{seller.rating} · {seller.sales ?? 0} sales</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Actions */}
      <TouchableOpacity style={styles.action} onPress={handleViewProfile} activeOpacity={0.7}>
        <Ionicons name="person-outline" size={20} color={colors.primary} />
        <Text style={styles.actionLabel}>View Profile</Text>
      </TouchableOpacity>

      <View style={styles.hairline} />

      <TouchableOpacity style={styles.action} onPress={handleMessage} activeOpacity={0.7}>
        <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
        <Text style={styles.actionLabel}>Message</Text>
      </TouchableOpacity>

      <View style={styles.hairline} />

      <TouchableOpacity style={styles.action} onPress={() => setConfirmBlock(true)} activeOpacity={0.7}>
        <Ionicons name="ban-outline" size={20} color={colors.danger} />
        <Text style={[styles.actionLabel, { color: colors.danger }]}>Block</Text>
      </TouchableOpacity>

      {/* Cancel */}
      <TouchableOpacity style={styles.cancelBtn} onPress={close} activeOpacity={0.7}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>
        {confirmBlock ? renderConfirm() : renderMain()}
        <View style={{ height: 28 }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },

  // Seller header (non-tappable)
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  sellerMeta: { flex: 1 },
  sellerName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  ratingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 0,
  },

  // Action rows
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 17,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  hairline: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 60,
  },

  // Cancel
  cancelBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },

  // Block confirm
  confirmPanel: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  blockIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.danger + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  confirmSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  blockBtn: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
  },
  blockBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cancelRow: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
