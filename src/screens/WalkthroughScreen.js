import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../theme/colors';

const { width } = Dimensions.get('window');
const WALKTHROUGH_KEY = 'proxie_seen_walkthrough';

const SLIDES = [
  {
    icon: 'radio',
    iconBg: colors.primary,
    accent: colors.primary,
    headline: 'Your block is\na marketplace',
    body: 'Proxie shows you real items for sale within walking distance — from 500 ft up to 7 miles away. No shipping. No waiting.',
    detail: [
      { icon: 'location', text: 'Hyper-local radius you control' },
      { icon: 'time',     text: 'Listings expire so the feed stays fresh' },
    ],
  },
  {
    icon: 'search',
    iconBg: '#5A4FCF',
    accent: '#5A4FCF',
    headline: 'Find it before\nit\'s gone',
    body: 'Browse a live feed of items near you. Filter by distance, category, and availability — and get to it before someone else does.',
    detail: [
      { icon: 'funnel',        text: 'Filter by category & distance' },
      { icon: 'heart-outline', text: 'Heart items to save for later' },
    ],
  },
  {
    icon: 'camera',
    iconBg: colors.success,
    accent: colors.success,
    headline: 'Post in\n60 seconds',
    body: 'Snap a photo, set your price, and go live instantly. Buyers message you directly — no middleman, no fees.',
    detail: [
      { icon: 'storefront-outline', text: 'Free to list, free to sell' },
      { icon: 'chatbubble-outline', text: 'Buyers message you in-app' },
    ],
  },
  {
    icon: 'shield-checkmark',
    iconBg: colors.warning,
    accent: colors.warning,
    headline: 'Verified\nneighbors',
    body: 'Every seller is phone-verified. After each deal, both sides rate each other — so trust builds over time.',
    detail: [
      { icon: 'call-outline',  text: 'Phone-verified accounts only' },
      { icon: 'star-outline',  text: 'Ratings after every transaction' },
    ],
  },
];

export default function WalkthroughScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Skip immediately for returning users
  React.useEffect(() => {
    AsyncStorage.getItem(WALKTHROUGH_KEY).then((val) => {
      if (val) navigation.replace('Welcome');
    });
  }, []);

  const finish = async () => {
    await AsyncStorage.setItem(WALKTHROUGH_KEY, '1');
    navigation.replace('Welcome');
  };

  const next = () => {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false },
  );

  const onMomentumEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(idx);
  };

  const slide = SLIDES[activeIndex];
  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={styles.skip} onPress={finish} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => <Slide slide={item} />}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 22, 8], extrapolate: 'clamp' });
          const opacity   = scrollX.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width: dotWidth, opacity, backgroundColor: slide.accent }]}
            />
          );
        })}
      </View>

      {/* CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: slide.accent }]}
          onPress={next}
          activeOpacity={0.88}
        >
          <Text style={styles.btnText}>{isLast ? 'Get Started' : 'Next'}</Text>
          <Ionicons name={isLast ? 'storefront-outline' : 'arrow-forward'} size={18} color="#fff" />
        </TouchableOpacity>
      </View>

    </View>
  );
}

function Slide({ slide }) {
  return (
    <View style={styles.slide}>
      {/* Icon illustration */}
      <View style={[styles.iconWrap, { backgroundColor: slide.iconBg + '18' }]}>
        <View style={[styles.iconCircle, { backgroundColor: slide.iconBg }]}>
          <Ionicons name={slide.icon} size={52} color="#fff" />
        </View>
        {/* Decorative rings */}
        <View style={[styles.ring, styles.ring1, { borderColor: slide.iconBg + '28' }]} />
        <View style={[styles.ring, styles.ring2, { borderColor: slide.iconBg + '14' }]} />
      </View>

      {/* Text */}
      <Text style={styles.headline}>{slide.headline}</Text>
      <Text style={styles.body}>{slide.body}</Text>

      {/* Detail bullets */}
      <View style={styles.details}>
        {slide.detail.map((d, i) => (
          <View key={i} style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: slide.accent + '18' }]}>
              <Ionicons name={d.icon} size={14} color={slide.accent} />
            </View>
            <Text style={styles.detailText}>{d.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skip: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  iconWrap: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  ring1: { width: 154, height: 154 },
  ring2: { width: 194, height: 194 },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 40,
    marginBottom: 16,
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: 32,
  },
  details: {
    gap: 10,
    alignSelf: 'stretch',
    paddingHorizontal: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 12,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 24,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    paddingVertical: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
});
