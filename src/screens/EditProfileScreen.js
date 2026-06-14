import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/db';
import BuildingPicker from '../components/BuildingPicker';
import colors from '../theme/colors';

export default function EditProfileScreen({ navigation }) {
  const { user, setUser } = useApp();

  const [name, setName] = useState(user.name || '');
  const [headline, setHeadline] = useState(user.status || '');
  const [bio, setBio] = useState(user.bio || '');
  const [building, setBuilding] = useState(user.building || null);
  const [avatarUri, setAvatarUri] = useState(user.avatar_url || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const nameOk = name.trim().length >= 2;
  const canSave = nameOk && !loading && !avatarUploading;

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setSaveMsg('Photo access is needed to set a profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setAvatarUploading(true);
    setSaveMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSaveMsg('Not signed in.'); return; }
      const asset = result.assets[0];
      const url = await uploadAvatar(asset.file ?? asset.uri, session.user.id);
      setAvatarUri(url);
      setUser((prev) => ({ ...prev, avatar_url: url }));
      await supabase.from('profiles').upsert({ id: session.user.id, avatar_url: url }, { onConflict: 'id' });
    } catch (e) {
      setSaveMsg('Photo upload failed. Try a smaller image.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    setSaveMsg('');
    if (!nameOk) { setSaveMsg('Please enter a display name of at least 2 characters.'); return; }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSaveMsg('Not signed in. Please sign in to update your profile.'); return; }

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          display_name: name.trim(),
          status: headline.trim(),
          bio: bio.trim(),
          building: building || null,
        }, { onConflict: 'id' });

      if (error) { setSaveMsg(error.message); return; }

      setUser((prev) => ({
        ...prev,
        name: name.trim(),
        status: headline.trim(),
        bio: bio.trim(),
        building: building || null,
      }));

      setSaveMsg('saved');
      setTimeout(() => navigation.goBack(), 800);
    } catch (e) {
      setSaveMsg('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerBadge}>
            <Ionicons name="person" size={14} color={colors.primary} />
            <Text style={styles.headerBadgeText}>Edit Profile</Text>
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            {saveMsg === 'saved' ? (
              <View style={[styles.msgBanner, { backgroundColor: colors.success + '15', borderColor: colors.success + '40' }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                <Text style={[styles.msgText, { color: colors.success }]}>Profile saved!</Text>
              </View>
            ) : saveMsg ? (
              <View style={styles.msgBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.msgText}>{saveMsg}</Text>
              </View>
            ) : null}

            {/* Avatar */}
            <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} activeOpacity={0.8}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={36} color={colors.primaryLight} />
                </View>
              )}
              <View style={styles.avatarBadge}>
                {avatarUploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to change photo</Text>

            {/* Display Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Display Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Jordan Smith"
                placeholderTextColor={colors.textLight}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                maxLength={50}
              />
            </View>

            {/* Headline */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Selling Headline
                <Text style={styles.optional}> (optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder='e.g. "Weekend garage sale enthusiast"'
                placeholderTextColor={colors.textLight}
                value={headline}
                onChangeText={setHeadline}
                maxLength={80}
              />
            </View>

            {/* Bio */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Short Bio
                <Text style={styles.optional}> (optional)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell buyers a bit about yourself and what you sell..."
                placeholderTextColor={colors.textLight}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
              />
            </View>

            {/* Building */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Building
                <Text style={styles.optional}> (optional)</Text>
              </Text>
              <BuildingPicker
                value={building}
                onChange={(val) => setBuilding(val || null)}
                placeholder="Select your building"
              />
            </View>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveBtnDisabled: {
    backgroundColor: colors.textLight,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  saveBtnTextDisabled: {
    color: '#fff',
  },

  scroll: { flex: 1 },

  form: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  msgBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.danger + '12',
    borderRadius: 14, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: colors.danger + '30',
  },
  msgText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: '500', lineHeight: 18 },

  avatarWrap: { alignSelf: 'center', marginBottom: 6, position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.border },
  avatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.cardBackground,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  avatarHint: { textAlign: 'center', fontSize: 12, color: colors.textLight, marginBottom: 20 },

  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  optional: {
    fontWeight: '400',
    color: colors.textLight,
    fontSize: 13,
  },
  input: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 90,
    paddingTop: 14,
  },
});
