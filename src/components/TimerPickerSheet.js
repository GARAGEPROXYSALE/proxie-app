import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTimerStatus } from '../lib/listingUtils';
import colors from '../theme/colors';

const TIMER_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

const COLOR_MAP = { success: colors.success, warning: colors.warning, danger: colors.danger };

// Standalone bottom sheet for the buyer's "in the area" timer — opened directly from the
// composer button. Picker mode when idle, manage mode (remaining time + Extend/Cancel) when active.
export default function TimerPickerSheet({ visible, onClose, thread, onStart, onExtend, onCancel }) {
  const slideY = useRef(new Animated.Value(400)).current;
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, bounciness: 4, speed: 14, useNativeDriver: false }).start();
    } else {
      Animated.timing(slideY, { toValue: 400, duration: 200, useNativeDriver: false }).start();
    }
  }, [visible]);

  // Tick every second while open + active so remaining time stays live
  useEffect(() => {
    if (!visible || !thread?.timerExpiresAt) return;
    const interval = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [visible, thread?.timerExpiresAt]);

  if (!visible) return null;

  const isActive = !!thread?.timerExpiresAt;
  const status = isActive ? getTimerStatus(thread.timerExpiresAt, thread.timerDurationMs || 60 * 60000) : null;
  const barColor = status ? COLOR_MAP[status.color] || colors.success : colors.primary;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: barColor + '18' }]}>
              <Ionicons name="hourglass" size={26} color={barColor} />
            </View>
            <Text style={styles.title}>
              {isActive
                ? (status.expired ? 'Timer expired' : "You're in the area")
                : "I'm in the area for..."}
            </Text>
            <Text style={styles.subtitle}>
              {isActive
                ? `Let ${thread?.with?.name} know if you need more time.`
                : `Let ${thread?.with?.name} know how long you'll be nearby for this item.`}
            </Text>
          </View>

          {isActive ? (
            <>
              {!status.expired && (
                <View style={styles.remainingBox}>
                  <Text style={[styles.remainingValue, { color: barColor }]}>{status.label}</Text>
                  <Text style={styles.remainingLabel}>remaining</Text>
                </View>
              )}
              <View style={styles.manageRow}>
                <TouchableOpacity style={styles.extendBtn} onPress={() => onExtend(30)} activeOpacity={0.85}>
                  <Ionicons name="add-circle-outline" size={16} color="#fff" />
                  <Text style={styles.extendBtnText}>Extend 30 min</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
                <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.cancelBtnText}>Cancel timer</Text>
              </TouchableOpacity>
            </>
          ) : (
            TIMER_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.label} style={styles.option} onPress={() => onStart(opt.minutes)} activeOpacity={0.7}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </TouchableOpacity>
            ))
          )}
        </Animated.View>
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
    padding: 24, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20,
  },
  header: { alignItems: 'center', marginBottom: 22 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  title: { fontSize: 19, fontWeight: '700', color: colors.text, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },

  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.cardBackground, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 15, marginBottom: 8,
  },
  optionLabel: { fontSize: 15, fontWeight: '500', color: colors.text },

  remainingBox: { alignItems: 'center', marginBottom: 20 },
  remainingValue: { fontSize: 32, fontWeight: '800' },
  remainingLabel: { fontSize: 12, color: colors.textLight, marginTop: 2 },

  manageRow: { marginBottom: 8 },
  extendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
  },
  extendBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, marginTop: 4,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.danger },
});
