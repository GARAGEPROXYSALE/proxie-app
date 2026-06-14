import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, Animated, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

export default function MarkSoldModal() {
  const { markSoldModal, closeMarkSoldModal, confirmMarkSold } = useApp();
  const { visible, item, buyers = [] } = markSoldModal || {};

  const [selectedBuyer, setSelectedBuyer] = useState(null); // { id, name, threadId } | 'other'
  const [otherName, setOtherName] = useState('');
  const slideY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      setSelectedBuyer(null);
      setOtherName('');
      Animated.spring(slideY, {
        toValue: 0, bounciness: 4, speed: 14, useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: 400, duration: 200, useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  if (!visible && !item) return null;

  const hasBuyers = buyers.length > 0;

  const handleConfirm = () => {
    if (selectedBuyer === 'other') {
      confirmMarkSold(item?.id, { name: otherName.trim() });
    } else if (selectedBuyer) {
      confirmMarkSold(item?.id, selectedBuyer);
    } else {
      // No buyer selected — confirm without one
      confirmMarkSold(item?.id, null);
    }
  };

  const canConfirm = !hasBuyers || selectedBuyer !== null;

  return (
    <Modal transparent visible={!!visible} animationType="none" onRequestClose={closeMarkSoldModal}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeMarkSoldModal} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.soldIcon}>
              <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            </View>
            <Text style={styles.title}>Mark as Sold</Text>
            <Text style={styles.subtitle}>"{item?.title}" — ${item?.price}</Text>
          </View>

          {/* Who bought it */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Who bought it?{' '}
              {!hasBuyers && <Text style={styles.optional}>(optional)</Text>}
            </Text>

            {hasBuyers ? (
              <>
                <Text style={styles.hint}>Select the buyer so both of you can rate the experience.</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {buyers.map((buyer) => {
                    const isSelected = selectedBuyer?.id === buyer.id;
                    return (
                      <TouchableOpacity
                        key={buyer.id}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => setSelectedBuyer(buyer)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.chipAvatar, isSelected && styles.chipAvatarSelected]}>
                          <Text style={[styles.chipInitial, isSelected && styles.chipInitialSelected]}>
                            {buyer.name?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <Text style={[styles.chipName, isSelected && styles.chipNameSelected]}>
                          {buyer.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color="#fff" />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* Someone else option */}
                  <TouchableOpacity
                    style={[styles.chip, selectedBuyer === 'other' && styles.chipSelected]}
                    onPress={() => setSelectedBuyer('other')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.chipAvatar, selectedBuyer === 'other' && styles.chipAvatarSelected]}>
                      <Ionicons name="person-add-outline" size={14} color={selectedBuyer === 'other' ? '#fff' : colors.textSecondary} />
                    </View>
                    <Text style={[styles.chipName, selectedBuyer === 'other' && styles.chipNameSelected]}>
                      Someone else
                    </Text>
                  </TouchableOpacity>
                </ScrollView>

                {selectedBuyer === 'other' && (
                  <TextInput
                    style={styles.input}
                    value={otherName}
                    onChangeText={setOtherName}
                    placeholder="Enter their name (optional)"
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="words"
                    returnKeyType="done"
                    autoFocus
                  />
                )}
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={otherName}
                  onChangeText={setOtherName}
                  placeholder="Enter buyer's name or leave blank"
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
                <Text style={styles.hint}>
                  No messages yet on this item — enter a name if you know who bought it.
                </Text>
              </>
            )}
          </View>

          {/* Confirm */}
          <TouchableOpacity
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.confirmText}>Confirm Sale</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={closeMarkSoldModal} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20,
  },
  header: { alignItems: 'center', marginBottom: 24 },
  soldIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#E8F8EE',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  optional: { fontWeight: '400', color: colors.textLight },
  hint: { fontSize: 12, color: colors.textLight, lineHeight: 17, marginBottom: 12 },

  chipsRow: { flexDirection: 'row', gap: 10, paddingBottom: 4, marginBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 24, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  chipSelected: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  chipAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  chipAvatarSelected: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipInitial: { fontSize: 12, fontWeight: '700', color: colors.primary },
  chipInitialSelected: { color: '#fff' },
  chipName: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipNameSelected: { color: '#fff' },

  input: {
    backgroundColor: colors.background,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.text, marginTop: 4,
  },

  confirmBtn: {
    backgroundColor: colors.success, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, gap: 8, marginBottom: 10,
    shadowColor: colors.success, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  confirmBtnDisabled: { backgroundColor: colors.border, shadowOpacity: 0, elevation: 0 },
  confirmText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 15, color: colors.textSecondary },
});
