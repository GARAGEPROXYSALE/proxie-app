import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTimerStatus } from '../lib/listingUtils';
import colors from '../theme/colors';

const COLOR_MAP = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

export default function ChatTimerBar({ thread, onExtend, canExtend = true }) {
  const [, setTick] = useState(0);

  // Re-render every second so the countdown + color stay live
  useEffect(() => {
    if (!thread?.timerExpiresAt) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [thread?.timerExpiresAt]);

  if (!thread?.timerExpiresAt) return null;

  const status = getTimerStatus(thread.timerExpiresAt, thread.timerDurationMs || 60 * 60000);
  if (!status) return null;

  const barColor = COLOR_MAP[status.color] || colors.success;

  if (status.expired) {
    return (
      <View style={[styles.bar, styles.barExpired]}>
        <Ionicons name="time-outline" size={14} color={colors.textLight} />
        <Text style={styles.expiredText}>
          {canExtend ? 'Timer expired — no longer in the area?' : 'Buyer\'s timer expired'}
        </Text>
        {canExtend && (
          <TouchableOpacity style={styles.extendBtn} onPress={() => onExtend(30)} activeOpacity={0.85}>
            <Text style={styles.extendBtnText}>Extend</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <Ionicons name="walk-outline" size={14} color={barColor} />
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(status.percent * 100)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.timeText, { color: barColor }]}>{status.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 38,
    textAlign: 'right',
  },

  barExpired: {
    backgroundColor: '#F4F4F5',
  },
  expiredText: {
    flex: 1,
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '500',
  },
  extendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  extendBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
