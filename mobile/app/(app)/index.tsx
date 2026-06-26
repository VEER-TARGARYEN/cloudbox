import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { Screen } from '../../src/components/Screen';
import { FileRow } from '../../src/components/FileRow';
import { useAuth } from '../../src/auth/AuthContext';
import { api, ApiError, type FileItem } from '../../src/api/client';
import { colors, radius, spacing } from '../../src/theme';

export default function DashboardScreen() {
  const { user, token, signOut } = useAuth();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true); // initial load spinner
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh
  const [error, setError] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null); // 0..1 while uploading
  const [busyId, setBusyId] = useState<string | null>(null); // file being downloaded

  // Fetch the user's files. The token is attached by the api client.
  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const res = await api.listFiles(token);
      setFiles(res.files);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load files');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // Pick a file from the device and upload it, streaming progress into the pill.
  const onUpload = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (picked.canceled || !token) return;

      const asset = picked.assets[0];
      setUploadPct(0);
      const created = await api.uploadFile(
        token,
        { uri: asset.uri, name: asset.name, mimeType: asset.mimeType },
        setUploadPct,
      );
      // Prepend so it appears at the top (the list is newest-first).
      setFiles((prev) => [created, ...prev]);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setUploadPct(null);
    }
  }, [token]);

  // Download to cache, then hand the local file to the OS share/preview sheet.
  const onOpen = useCallback(
    async (file: FileItem) => {
      if (!token) return;
      try {
        setBusyId(file.id);
        const uri = await api.downloadToCache(token, file);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: file.mime_type, dialogTitle: file.name });
        } else {
          Alert.alert('Downloaded', `Saved to:\n${uri}`);
        }
      } catch (e) {
        Alert.alert('Download failed', e instanceof ApiError ? e.message : 'Something went wrong');
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  // Optimistic delete: remove from the list immediately, roll back if the
  // server call fails.
  const onDelete = useCallback(
    (file: FileItem) => {
      Alert.alert('Delete file', `Delete "${file.name}"? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            const snapshot = files;
            setFiles((f) => f.filter((x) => x.id !== file.id));
            try {
              await api.deleteFile(token, file.id);
            } catch (e) {
              setFiles(snapshot);
              Alert.alert(
                'Delete failed',
                e instanceof ApiError ? e.message : 'Something went wrong',
              );
            }
          },
        },
      ]);
    },
    [files, token],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your files</Text>
          <Text style={styles.subtitle}>{user?.email}</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.signout}>Sign out</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            onPress={() => {
              setLoading(true);
              load();
            }}
          >
            <Text style={styles.retry}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FileRow
              file={item}
              busy={busyId === item.id}
              onPress={() => onOpen(item)}
              onDelete={() => onDelete(item)}
            />
          )}
          contentContainerStyle={files.length === 0 ? styles.emptyWrap : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyTitle}>No files yet</Text>
              <Text style={styles.emptyText}>Tap the + button to upload your first file.</Text>
            </View>
          }
        />
      )}

      {/* Upload progress pill (only while an upload is in flight) */}
      {uploadPct !== null && (
        <View style={styles.progressPill}>
          <ActivityIndicator color={colors.primaryText} />
          <Text style={styles.progressText}>Uploading {Math.round(uploadPct * 100)}%</Text>
        </View>
      )}

      {/* Floating upload button */}
      <Pressable
        onPress={onUpload}
        disabled={uploadPct !== null}
        style={({ pressed }) => [
          styles.fab,
          pressed && styles.fabPressed,
          uploadPct !== null && styles.fabDisabled,
        ]}
      >
        <Text style={styles.fabPlus}>＋</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing(2),
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 2 },
  signout: { color: colors.primary, fontSize: 15, fontWeight: '600', paddingTop: spacing(1) },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  error: { color: colors.danger, fontSize: 15, textAlign: 'center', marginBottom: spacing(1) },
  retry: { color: colors.primary, fontWeight: '600' },

  listContent: { paddingBottom: spacing(12) },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  emptyIcon: { fontSize: 44, marginBottom: spacing(1) },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 14, marginTop: 4, textAlign: 'center' },

  progressPill: {
    position: 'absolute',
    bottom: spacing(3),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.25),
    borderRadius: 999,
  },
  progressText: {
    color: colors.primaryText,
    fontWeight: '700',
    marginLeft: spacing(1),
  },

  fab: {
    position: 'absolute',
    right: 0,
    bottom: spacing(1),
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.85 },
  fabDisabled: { opacity: 0.4 },
  fabPlus: { color: colors.primaryText, fontSize: 32, fontWeight: '600', marginTop: -2 },
});
