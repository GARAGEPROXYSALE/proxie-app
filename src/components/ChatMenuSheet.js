import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ScrollView, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

// ── Safety tips content ──────────────────────────────────────
const SAFETY_TIPS = [
  { icon: 'location-outline', text: 'Meet in a public place — a lobby, coffee shop, or well-lit area.' },
  { icon: 'people-outline', text: 'Bring a friend when picking up large or high-value items.' },
  { icon: 'card-outline', text: 'Never send payment before you see the item in person.' },
  { icon: 'search-outline', text: 'Inspect items thoroughly before completing the exchange.' },
  { icon: 'time-outline', text: 'Let someone know where you\'re going and when to expect you back.' },
  { icon: 'alert-circle-outline', text: 'Trust your instincts — if something feels off, cancel.' },
];

// ── Report categories ────────────────────────────────────────
const REPORT_CATS = [
  { id: 'spam', label: 'Spam or scam', icon: 'warning-outline' },
  { id: 'counterfeit', label: 'Counterfeit item', icon: 'shield-outline' },
  { id: 'prohibited', label: 'Prohibited item', icon: 'ban-outline' },
  { id: 'wrong_price', label: 'Misleading price', icon: 'cash-outline' },
  { id: 'other', label: 'Something else', icon: 'ellipsis-horizontal-circle-outline' },
];

// ── Mute duration options ────────────────────────────────────
const MUTE_OPTIONS = [
  { label: '8 hours', value: 8 * 60 * 60 * 1000 },
  { label: '24 hours', value: 24 * 60 * 60 * 1000 },
  { label: '1 week', value: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Forever', value: 'forever' },
];

export default function ChatMenuSheet({ visible, onClose, thread, item, navigation, onOpenOffer, onOpenMeetup }) {
  const {
    messages, markUnread, pinThread, muteThread, unmuteThread,
    archiveThread, deleteThread,
  } = useApp();

  // Which sub-panel is showing
  const [panel, setPanel] = useState(null); // null | 'safety' | 'mute' | 'report' | 'delete'
  const [reportCategory, setReportCategory] = useState(null);
  const [reportDone, setReportDone] = useState(false);

  const currentThread = messages.find((t) => t.id === thread?.id) || thread;
  const isPinned = currentThread?.pinned;
  const isMuted = currentThread?.muted;
  const isUnread = currentThread?.markedUnread || currentThread?.unread > 0;
  const pinnedCount = messages.filter((t) => t.pinned).length;

  const close = () => {
    setPanel(null);
    setReportCategory(null);
    setReportDone(false);
    onClose();
  };

  const handleMarkUnread = () => {
    markUnread(currentThread.id);
    close();
  };

  const handlePin = () => {
    if (!isPinned && pinnedCount >= 3) {
      // Show inline note instead of closing
      setPanel('pinLimit');
      return;
    }
    pinThread(currentThread.id);
    close();
  };

  const handleMute = (duration) => {
    muteThread(currentThread.id, duration);
    close();
  };

  const handleUnmute = () => {
    unmuteThread(currentThread.id);
    close();
  };

  const handleArchive = () => {
    archiveThread(currentThread.id);
    navigation.goBack();
    close();
  };

  const handleDelete = () => {
    deleteThread(currentThread.id);
    navigation.goBack();
    close();
  };

  const handleReportSubmit = () => {
    if (!reportCategory) return;
    setReportDone(true);
  };

  const handleOfferPress = () => {
    close();
    onOpenOffer();
  };

  const handleMeetupPress = () => {
    close();
    onOpenMeetup();
  };

  // ── Render helpers ───────────────────────────────────────────

  const MenuItem = ({ icon, label, onPress, color, danger, rightElement }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: (color || colors.primary) + '18' }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : (color || colors.primary)} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      {rightElement || <Ionicons name="chevron-forward" size={16} color={colors.textLight} />}
    </TouchableOpacity>
  );

  // ── Sub-panels ───────────────────────────────────────────────

  const renderSafetyPanel = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <TouchableOpacity onPress={() => setPanel(null)}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.panelTitle}>Safety Tips</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.safetyIntro}>
          <View style={styles.safetyIconWrap}>
            <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          </View>
          <Text style={styles.safetyTitle}>Stay safe when meeting up</Text>
          <Text style={styles.safetySub}>These tips help make every transaction smooth and safe.</Text>
        </View>
        {SAFETY_TIPS.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <View style={styles.tipIcon}>
              <Ionicons name={tip.icon} size={18} color={colors.primary} />
            </View>
            <Text style={styles.tipText}>{tip.text}</Text>
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );

  const renderMutePanel = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <TouchableOpacity onPress={() => setPanel(null)}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.panelTitle}>Mute for how long?</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.panelSub}>You won't get notifications for this chat.</Text>
      {MUTE_OPTIONS.map((opt) => (
        <TouchableOpacity key={opt.label} style={styles.muteOption} onPress={() => handleMute(opt.value)} activeOpacity={0.7}>
          <Text style={styles.muteLabel}>{opt.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderReportPanel = () => {
    if (reportDone) {
      return (
        <View style={[styles.panel, styles.panelCenter]}>
          <View style={styles.reportDoneIcon}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={styles.reportDoneTitle}>Report submitted</Text>
          <Text style={styles.reportDoneSub}>
            Thanks for letting us know. We review all reports within 24 hours.
          </Text>
          <TouchableOpacity style={styles.reportDoneBtn} onPress={close}>
            <Text style={styles.reportDoneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <TouchableOpacity onPress={() => setPanel(null)}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.panelTitle}>Report listing</Text>
          <View style={{ width: 22 }} />
        </View>
        <Text style={styles.panelSub}>What's the issue with this listing?</Text>
        {REPORT_CATS.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.reportOption, reportCategory === cat.id && styles.reportOptionSelected]}
            onPress={() => setReportCategory(cat.id)}
            activeOpacity={0.7}
          >
            <Ionicons name={cat.icon} size={18} color={reportCategory === cat.id ? colors.primary : colors.textSecondary} />
            <Text style={[styles.reportLabel, reportCategory === cat.id && { color: colors.primary, fontWeight: '600' }]}>
              {cat.label}
            </Text>
            {reportCategory === cat.id && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.reportSubmitBtn, !reportCategory && styles.reportSubmitDisabled]}
          onPress={handleReportSubmit}
          disabled={!reportCategory}
          activeOpacity={0.85}
        >
          <Text style={styles.reportSubmitText}>Submit Report</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDeletePanel = () => (
    <View style={[styles.panel, styles.panelCenter]}>
      <View style={styles.deleteIcon}>
        <Ionicons name="trash-outline" size={36} color={colors.danger} />
      </View>
      <Text style={styles.deleteTitle}>Delete this conversation?</Text>
      <Text style={styles.deleteSub}>
        This will permanently remove the chat with {currentThread?.with?.name}. This can't be undone.
      </Text>
      <TouchableOpacity style={styles.deleteConfirmBtn} onPress={handleDelete} activeOpacity={0.85}>
        <Text style={styles.deleteConfirmText}>Yes, Delete</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setPanel(null)} activeOpacity={0.7}>
        <Text style={styles.deleteCancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPinLimitPanel = () => (
    <View style={[styles.panel, styles.panelCenter]}>
      <Ionicons name="pin" size={36} color={colors.warning} />
      <Text style={styles.deleteTitle}>Pin limit reached</Text>
      <Text style={styles.deleteSub}>You can pin up to 3 conversations. Unpin one first.</Text>
      <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setPanel(null)} activeOpacity={0.7}>
        <Text style={styles.deleteCancelText}>Got it</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Main menu ────────────────────────────────────────────────

  const renderMainMenu = () => (
    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
      {/* Header */}
      <View style={styles.handleRow}>
        <View style={styles.handle} />
      </View>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {currentThread?.with?.name || 'Chat Options'}
        </Text>
        <Text style={styles.sheetSub} numberOfLines={1}>
          {currentThread?.listingTitle}
        </Text>
      </View>

      {/* Listing actions */}
      <Text style={styles.groupLabel}>Listing</Text>
      <MenuItem
        icon="cash-outline"
        label="Make an Offer"
        onPress={handleOfferPress}
      />
      <MenuItem
        icon="calendar-outline"
        label="Schedule a Meetup"
        onPress={handleMeetupPress}
      />
      <MenuItem
        icon="flag-outline"
        label="Report Listing"
        onPress={() => setPanel('report')}
        color={colors.warning}
      />

      {/* Conversation actions */}
      <Text style={styles.groupLabel}>Conversation</Text>
      <MenuItem
        icon={isUnread ? 'mail-open-outline' : 'mail-unread-outline'}
        label={isUnread ? 'Mark as Read' : 'Mark as Unread'}
        onPress={handleMarkUnread}
        rightElement={null}
      />
      <MenuItem
        icon="pin-outline"
        label={isPinned ? 'Unpin Conversation' : 'Pin Conversation'}
        onPress={handlePin}
        rightElement={null}
      />
      <MenuItem
        icon={isMuted ? 'notifications-outline' : 'notifications-off-outline'}
        label={isMuted ? 'Unmute' : 'Mute Notifications'}
        onPress={isMuted ? handleUnmute : () => setPanel('mute')}
        color={isMuted ? colors.success : colors.textSecondary}
      />
      <MenuItem
        icon="archive-outline"
        label="Archive Chat"
        onPress={handleArchive}
        color={colors.textSecondary}
        rightElement={null}
      />
      <MenuItem
        icon="trash-outline"
        label="Delete Conversation"
        onPress={() => setPanel('delete')}
        danger
        rightElement={null}
      />

      {/* Safety */}
      <Text style={styles.groupLabel}>Safety</Text>
      <MenuItem
        icon="shield-checkmark-outline"
        label="Safety Tips"
        onPress={() => setPanel('safety')}
        color={colors.success}
      />

      <View style={{ height: 32 }} />
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        {panel === 'safety' && renderSafetyPanel()}
        {panel === 'mute' && renderMutePanel()}
        {panel === 'report' && renderReportPanel()}
        {panel === 'delete' && renderDeletePanel()}
        {panel === 'pinLimit' && renderPinLimitPanel()}
        {panel === null && renderMainMenu()}
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
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
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
  sheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sheetSub: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },

  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    backgroundColor: colors.cardBackground,
    marginHorizontal: 12,
    marginBottom: 2,
    borderRadius: 14,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },

  // Sub-panel shared
  panel: {
    padding: 20,
    minHeight: 200,
  },
  panelCenter: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  panelSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },

  // Safety panel
  safetyIntro: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  safetyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  safetySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },

  // Mute panel
  muteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 8,
  },
  muteLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },

  // Report panel
  reportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reportOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '0A',
  },
  reportLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  reportSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  reportSubmitDisabled: {
    backgroundColor: colors.textLight,
  },
  reportSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  reportDoneIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  reportDoneTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  reportDoneSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  reportDoneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 40,
    marginTop: 12,
  },
  reportDoneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Delete panel
  deleteIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.danger + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  deleteSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  deleteConfirmBtn: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 40,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  deleteCancelBtn: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
