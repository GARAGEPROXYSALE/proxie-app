export function onProfilePress(userId, navigation, listings) {
  const listing = listings.find((l) => l.seller?.id === userId) || null;
  const seller = listing?.seller || { id: userId };
  navigation.navigate('SellerProfile', { seller, listing });
}
