import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

// Idle: plain outline icon. Active: a clean monochrome pill with the icon + remaining
// time label (e.g. "3h", "45m") — no color-shifting ring, kept neutral/minimal on purpose.
export default function TimerIconButton({ active, status, onPress }) {
  const showLabel = active && status && !status.expired;

  return (
    <TouchableOpacity
      style={[styles.btn, showLabel && styles.btnActive]}
      onPress={onPress}
      activeOpacity={0.6}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name={active ? 'timer' : 'timer-outline'}
        size={showLabel ? 14 : 20}
        color={active ? colors.primaryDark : colors.textSecondary}
      />
      {showLabel && <Text style={styles.label}>{status.label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    flexDirection: 'row',
    width: 'auto',
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 9,
    gap: 4,
    backgroundColor: colors.primaryLight + '30',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});
