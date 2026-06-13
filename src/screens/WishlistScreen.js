import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { PROXIMITY_SNAPS, proximityLabel } from '../lib/listingUtils';
import colors from '../theme/colors';

const SCREEN_W = Dimensions.get('window').width;

const WISHLIST_CATEGORIES = [
  'Furniture',
  'Clothing & accessories',
  'Shoes & sneakers',
  'Electronics',
  'Collectibles & memorabilia',
  'Antiques',
  'Books / records / media',
  'Sporting goods',
  'Tools & hardware',
  'Toys & games',
  'Jewelry & watches',
  'Art & prints',
  'Musical instruments',
  'Baby & kids',
  'Automotive',
  'Home goods & décor',
  'Bags & luggage',
  'Vintage',
  'General / other',
];

function timeAgo(ts) {
  if (!ts) return 'Never';
  const ms = Date.now() - ts;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(ms / 86400000);
  return `${days}d ago`;
}

// ── Add Wishlist Modal ────────────────────────────────────────

function AddWishlistModal({ visible, onClose, onSave }) {
  const [selectedPills, setSelectedPills] = useState([]);
  const [maxPrice, setMaxPrice] = useState('');
  const [radiusOverride, setRadiusOverride] = useState(null);

  const togglePill = (cat) => {
    setSelectedPills((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSave = () => {
    onSave({
      category_pills: selectedPills,
      max_price: maxPrice ? parseFloat(maxPrice) : null,
      radius_override_miles: radiusOverride,
    });
    // Reset
    setSelectedPills([]);
    setMaxPrice('');
    setRadiusOverride(null);
    onClose();
  };

  const canSave = selectedPills.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={modal.root}>
        {/* Header */}
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={modal.title}>What are you looking for?</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={modal.scroll}
          contentContainerStyle={modal.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={modal.subtitle}>
            Tap categories to select. We'll notify you when a match appears nearby.
          </Text>

          {/* Category pills */}
          <View style={modal.pillGrid}>
            {WISHLIST_CATEGORIES.map((cat) => {
              const selected = selectedPills.includes(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  style={[modal.pill, selected && modal.pillSelected]}
                  onPress={() => togglePill(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[modal.pillText, selected && modal.pillTextSelected]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Max price */}
          <Text style={modal.fieldLabel}>Max price (optional)</Text>
          <View style={modal.inputWrap}>
            <Text style={modal.inputPrefix}>$</Text>
            <TextInput
              style={modal.input}
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              placeholder="Any price"
              placeholderTextColor={colors.textLight}
            />
          </View>

          {/* Radius override */}
          <Text style={modal.fieldLabel}>Radius (optional)</Text>
          <View style={modal.radiusRow}>
            {PROXIMITY_SNAPS.map((m) => {
              const isActive = radiusOverride === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[modal.radiusChip, isActive && modal.radiusChipActive]}
                  onPress={() => setRadiusOverride(isActive ? null : m)}
                  activeOpacity={0.8}
                >
                  <Text style={[modal.radiusChipText, isActive && modal.radiusChipTextActive]}>
                    {proximityLabel(m)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Save button */}
        <View style={modal.footer}>
          <TouchableOpacity
            style={[modal.saveBtn, !canSave && modal.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <Ionicons name="bookmark" size={18} color="#fff" />
            <Text style={modal.saveBtnText}>Save to Wishlist</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Wishlist Entry Card ────────────────────────────────────────

function WishlistEntryCard({ entry, onDelete }) {
  return (
    <View style={styles.entryCard}>
      <View style={styles.entryContent}>
        {/* Category pills */}
        <View style={styles.entryPillRow}>
          {entry.category_pills.map((cat) => (
            <View key={cat} style={styles.entryPill}>
              <Text style={styles.entryPillText}>{cat}</Text>
            </View>
          ))}
        </View>

        {/* Meta info */}
        <View style={styles.entryMeta}>
          {entry.max_price != null && (
            <View style={styles.entryMetaChip}>
              <Ionicons name="pricetag-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.entryMetaText}>Up to ${entry.max_price}</Text>
            </View>
          )}
          {entry.radius_override_miles != null && (
            <View style={styles.entryMetaChip}>
              <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.entryMetaText}>Within {proximityLabel(entry.radius_override_miles)}</Text>
            </View>
          )}
          <View style={styles.entryMetaChip}>
            <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
            <Text style={styles.entryMetaText}>
              Last match: {entry.last_match_at ? timeAgo(entry.last_match_at) : 'Never'}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDelete(entry.id)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={22} color={colors.textLight} />
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────

export default function WishlistScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { wishlist, addWishlistEntry, removeWishlistEntry } = useApp();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wishlist</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {wishlist.length === 0 ? (
        /* Empty state */
        <View style={styles.emptyState}>
          <Ionicons name="bookmark-outline" size={56} color={colors.primaryLight} />
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySub}>
            Select categories and we'll notify you the moment a match lists nearby — even when the app is closed.
          </Text>
          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.emptyAddBtnText}>Add to Wishlist</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.listHeader}>
            {wishlist.length} {wishlist.length === 1 ? 'alert' : 'alerts'} active
          </Text>
          {wishlist.map((entry) => (
            <WishlistEntryCard
              key={entry.id}
              entry={entry}
              onDelete={removeWishlistEntry}
            />
          ))}

          <TouchableOpacity
            style={styles.addMoreBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addMoreBtnText}>Add Another Alert</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <AddWishlistModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={addWishlistEntry}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyAddBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // List
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  listHeader: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 12,
  },

  // Entry card
  entryCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  entryContent: { flex: 1 },
  entryPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  entryPill: {
    backgroundColor: colors.primary + '20',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  entryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  entryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  entryMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  entryMetaText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  deleteBtn: {
    marginLeft: 10,
    marginTop: -2,
  },

  // Add more
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary + '50',
    borderRadius: 14,
    borderStyle: 'dashed',
    paddingVertical: 14,
    marginTop: 4,
  },
  addMoreBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});

// ── Modal styles ──────────────────────────────────────────────

const modal = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },

  // Category pills
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  pillTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },

  // Fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  inputPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },

  // Radius chips
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  radiusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  radiusChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  radiusChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtnDisabled: {
    backgroundColor: colors.textLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
