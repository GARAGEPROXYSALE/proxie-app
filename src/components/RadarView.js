import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { getAvailabilityStatus } from '../lib/listingUtils';
import colors from '../theme/colors';

const RADAR_SIZE = 300;
const CENTER = RADAR_SIZE / 2;

function RadarRing({ delay, size }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 2800,
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = anim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.6, 0.3, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, opacity, transform: [{ scale }] },
      ]}
    />
  );
}

function AvailablePulse({ color }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1100, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <Animated.View
      style={[
        styles.availPulse,
        { borderColor: color, opacity, transform: [{ scale }] },
      ]}
    />
  );
}

export default function RadarView({ items, maxMiles, onItemPress }) {
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const itemsWithCoords = items.map((item) => {
    const rad = (item.angle * Math.PI) / 180;
    const r = (Math.min(item.distance, maxMiles) / maxMiles) * (CENTER - 24);
    return {
      ...item,
      x: CENTER + r * Math.cos(rad),
      y: CENTER + r * Math.sin(rad),
    };
  });

  const categoryColors = {
    Furniture: '#FF9500',
    Electronics: '#5B9BD5',
    Clothing: '#AF52DE',
    Books: '#34C759',
    Kitchen: '#FF3B30',
    Sports: '#00C7BE',
    default: '#FF6B35',
  };

  return (
    <View style={styles.outerWrapper}>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          {/* Static rings */}
          <View style={[styles.staticRing, { width: RADAR_SIZE * 0.95, height: RADAR_SIZE * 0.95, borderRadius: RADAR_SIZE * 0.475 }]} />
          <View style={[styles.staticRing, { width: RADAR_SIZE * 0.65, height: RADAR_SIZE * 0.65, borderRadius: RADAR_SIZE * 0.325 }]} />
          <View style={[styles.staticRing, { width: RADAR_SIZE * 0.35, height: RADAR_SIZE * 0.35, borderRadius: RADAR_SIZE * 0.175 }]} />

          {/* Pulse rings */}
          <View style={styles.ringsWrapper}>
            <RadarRing delay={0} size={RADAR_SIZE * 0.9} />
            <RadarRing delay={900} size={RADAR_SIZE * 0.9} />
            <RadarRing delay={1800} size={RADAR_SIZE * 0.9} />
          </View>

          {/* Center dot */}
          <View style={styles.centerDot} />

          {/* Item dots */}
          {itemsWithCoords.map((item) => {
            const dotColor = categoryColors[item.category] || categoryColors.default;
            const isAvailableNow = getAvailabilityStatus(item).state === 'available';
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemDot, { left: item.x - 10, top: item.y - 10, backgroundColor: dotColor }]}
                onPress={() => onItemPress(item)}
                activeOpacity={0.8}
              >
                {isAvailableNow && <AvailablePulse color={dotColor} />}
                <View style={[styles.itemDotInner, { borderColor: dotColor }]} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    alignItems: 'center',
  },
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
  },
  container: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

staticRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.radarRing,
  },
  ringsWrapper: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  centerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  itemDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  itemDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  availPulse: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },

});
