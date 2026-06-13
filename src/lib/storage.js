import { supabase } from './supabase';

export async function uploadAvatar(userId, fileUri) {
  try {
    const ext = fileUri.split('.').pop() || 'jpg';
    const path = `${userId}/avatar.${ext}`;
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const formData = new FormData();
    formData.append('file', { uri: fileUri, name: `avatar.${ext}`, type: blob.type || 'image/jpeg' });
    const { error } = await supabase.storage.from('avatars').upload(path, formData, { upsert: true, contentType: blob.type || 'image/jpeg' });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error('[storage] uploadAvatar:', e);
    return null;
  }
}

export async function uploadListingPhoto(listingId, fileUri) {
  try {
    const ext = fileUri.split('.').pop() || 'jpg';
    const path = `${listingId}/${Date.now()}.${ext}`;
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const formData = new FormData();
    formData.append('file', { uri: fileUri, name: `photo.${ext}`, type: blob.type || 'image/jpeg' });
    const { error } = await supabase.storage.from('listings').upload(path, formData, { upsert: true, contentType: blob.type || 'image/jpeg' });
    if (error) throw error;
    const { data } = supabase.storage.from('listings').getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error('[storage] uploadListingPhoto:', e);
    return null;
  }
}
