import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

export default function SavedScreen({ navigation }) {
  const { listings, toggleSaved } = useApp();
  const saved = listings.filter((l) => l.saved);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hearted</Text>
        <Text style={styles.headerCount}>{saved.length} item{saved.length !== 1 ? 's' : ''}</Text>
      </View>

      {saved.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={52} color={colors.primaryLight} />
          <Text style={styles.emptyTitle}>Nothing hearted yet</Text>
          <Text style={styles.emptySub}>Tap the heart on any listing to save it here.</Text>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('ItemDetail', { item })}
              activeOpacity={0.88}
            >
              <Image source={{ uri: item.photos[0] }} style={styles.photo} resizeMode="cover" />
              <TouchableOpacity
                style={styles.heartBtn}
                onPress={() => toggleSaved(item.id)}
                activeOpacity={0.8}
              >
                <Ionicons name="heart" size={16} color={colors.danger} />
              </TouchableOpacity>
              <View style={styles.info}>
                <Text style={styles.price}>${item.price}</Text>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                {item.distance != null && (
                  <View style={styles.distRow}>
                    <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                    <Text style={styles.dist}>{item.distance} mi</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerCount: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  grid: { padding: 12, paddingBottom: 40 },
  row: { gap: 10 },
  card: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  photo: { width: '100%', height: 120, backgroundColor: colors.border },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    padding: 5,
  },
  info: { padding: 10 },
  price: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  title: { fontSize: 12, fontWeight: '500', color: colors.text, marginBottom: 4 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dist: { fontSize: 11, color: colors.textSecondary },
});
