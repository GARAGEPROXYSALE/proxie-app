import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

const COLOR_MAP = { success: colors.success, warning: colors.warning, danger: colors.danger };
const SIZE = 30;
const HALF = SIZE / 2;
const STROKE = 2;

// Circular progress ring built from two rotating half-circle clips — no SVG dependency.
// percent: 1 = full time remaining (full ring), 0 = none.
function ProgressRing({ percent, color }) {
  const angle = Math.max(0, Math.min(1, percent)) * 360;
  const rightRotate = Math.min(angle, 180);
  const leftRotate = Math.max(angle - 180, 0);

  return (
    <View style={styles.ringWrap} pointerEvents="none">
      <View style={[styles.ringTrack, { borderColor: colors.border }]} />
      <View style={[styles.ringHalfClip, { left: HALF }]}>
        <View
          style={[
            styles.ringCircle,
            { borderColor: color, left: -HALF, transform: [{ rotate: `${rightRotate}deg` }] },
          ]}
        />
      </View>
      <View style={[styles.ringHalfClip, { left: 0 }]}>
        <View
          style={[
            styles.ringCircle,
            { borderColor: color, left: 0, transform: [{ rotate: `${leftRotate}deg` }] },
          ]}
        />
      </View>
    </View>
  );
}

export default function TimerIconButton({ active, status, onPress }) {
  const color = status ? COLOR_MAP[status.color] || colors.success : colors.textSecondary;

  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      {active && status && !status.expired && <ProgressRing percent={status.percent} color={color} />}
      <Ionicons
        name={active ? 'timer' : 'timer-outline'}
        size={20}
        color={active ? color : colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: HALF,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
  ringTrack: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: HALF,
    borderWidth: STROKE,
  },
  ringHalfClip: {
    position: 'absolute',
    width: HALF,
    height: SIZE,
    overflow: 'hidden',
  },
  ringCircle: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: HALF,
    borderWidth: STROKE,
    borderColor: 'transparent',
  },
});
