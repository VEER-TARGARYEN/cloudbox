import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type DimensionValue,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { Screen } from '../../src/components/Screen';
import { TopBar } from '../../src/components/TopBar';
import { FileRow } from '../../src/components/FileRow';
import { BottomSheet } from '../../src/components/BottomSheet';
import { useAuth } from '../../src/auth/AuthContext';
import { api, ApiError, type FileItem } from '../../src/api/client';
import { fileVisual } from '../../src/utils/fileType';
import { formatBytes, formatDate, mimeLabel } from '../../src/utils/format';
import { colors, font, PAGE_PADDING, radius, spacing, typography } from '../../src/theme';

type UploadState = { name: string; total?: number; pct: number };

export default function FilesScreen() {
  const { user, token } = useAuth();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<FileItem | null>(null);

  const cancelUploadRef = useRef<null | (() => void)>(null);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, query]);

  const onUpload = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (picked.canceled || !token) return;
      const asset = picked.assets[0];

      setUpload({ name: asset.name, total: asset.size, pct: 0 });
      const created = await api.uploadFile(
        token,
        { uri: asset.uri, name: asset.name, mimeType: asset.mimeType },
        (f) => setUpload((u) => (u ? { ...u, pct: f } : u)),
        (cancel) => {
          cancelUploadRef.current = cancel;
        },
      );
      setFiles((prev) => [created, ...prev]);
    } catch (e) {
      const canceled = e instanceof ApiError && /cancel/i.test(e.message);
      if (!canceled) {
        Alert.alert('Upload failed', e instanceof ApiError ? e.message : 'Something went wrong');
      }
    } finally {
      setUpload(null);
      cancelUploadRef.current = null;
    }
  }, [token]);

  // Download to cache then hand the local file to the OS share/preview sheet.
  const openFile = useCallback(
    async (file: FileItem) => {
      if (!token) return;
      setSelected(null);
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

  const deleteFile = useCallback(
    (file: FileItem) => {
      setSelected(null);
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
              Alert.alert('Delete failed', e instanceof ApiError ? e.message : 'Something went wrong');
            }
          },
        },
      ]);
    },
    [files, token],
  );

  return (
    <Screen edges={['top']}>
      <TopBar email={user?.email} />

      <View style={styles.headerArea}>
        <Text style={styles.title}>Your files</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search files..."
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x" size={18} color={colors.textFaint} />
            </Pressable>
          )}
        </View>
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
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FileRow file={item} busy={busyId === item.id} onPress={() => setSelected(item)} />
          )}
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyWrap : styles.listContent
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name={query ? 'search' : 'upload-cloud'} size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{query ? 'No matches' : 'No files yet'}</Text>
              <Text style={styles.emptyText}>
                {query ? 'Try a different search.' : 'Tap the + button to upload your first file.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating upload button */}
      <Pressable
        onPress={onUpload}
        disabled={!!upload}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed, !!upload && styles.fabDisabled]}
      >
        <Feather name="plus" size={26} color={colors.onPrimary} />
      </Pressable>

      {/* Upload progress sheet (persistent bottom card while uploading) */}
      {upload && (
        <View style={styles.uploadSheet}>
          <View style={styles.handle} />
          <View style={styles.uploadRow}>
            <View style={styles.uploadIcon}>
              <Feather name="upload-cloud" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadTitle}>Uploading 1 file…</Text>
              <Text style={styles.uploadName} numberOfLines={1}>
                {upload.name}
              </Text>
            </View>
            <Pressable onPress={() => cancelUploadRef.current?.()} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
          <View style={styles.uploadMetaRow}>
            <Text style={styles.uploadMeta}>
              {upload.total
                ? `${formatBytes(upload.pct * upload.total)} of ${formatBytes(upload.total)}`
                : 'Uploading…'}
            </Text>
            <Text style={styles.uploadPct}>{Math.round(upload.pct * 100)}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(2, upload.pct * 100)}%` as DimensionValue }]} />
          </View>
        </View>
      )}

      {/* File actions sheet */}
      <BottomSheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && <FileActions file={selected} onOpen={openFile} onDelete={deleteFile} />}
      </BottomSheet>
    </Screen>
  );
}

// ── File actions sheet body ────────────────────────────────────────────────
function FileActions({
  file,
  onOpen,
  onDelete,
}: {
  file: FileItem;
  onOpen: (f: FileItem) => void;
  onDelete: (f: FileItem) => void;
}) {
  const v = fileVisual(file.mime_type);
  return (
    <View>
      <View style={styles.sheetHeader}>
        <View style={[styles.sheetIcon, { backgroundColor: v.bg }]}>
          <Feather name={v.icon} size={22} color={v.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetName} numberOfLines={1}>
            {file.name}
          </Text>
          <Text style={styles.sheetMeta}>
            {formatBytes(file.size_bytes)} · {mimeLabel(file.mime_type)} · {formatDate(file.created_at)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <SheetAction icon="external-link" label="Open" onPress={() => onOpen(file)} />
      <SheetAction icon="download" label="Download" onPress={() => onOpen(file)} />
      <SheetAction icon="share-2" label="Share" onPress={() => onOpen(file)} />

      <View style={styles.divider} />

      <SheetAction icon="trash-2" label="Delete" danger onPress={() => onDelete(file)} />
    </View>
  );
}

function SheetAction({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const fg = danger ? colors.danger : colors.primary;
  const bg = danger ? colors.dangerTint : colors.primaryTint;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceLow }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>
        <Feather name={icon} size={18} color={fg} />
      </View>
      <Text style={[styles.actionLabel, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerArea: { paddingHorizontal: PAGE_PADDING, paddingTop: spacing(4) },
  title: { ...typography.display, color: colors.text },
  email: { ...typography.body, color: colors.textMuted, marginTop: spacing(1) },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: spacing(4),
    marginTop: spacing(4),
    gap: spacing(2),
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.text, padding: 0 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(6) },
  error: { ...typography.body, color: colors.danger, textAlign: 'center', marginBottom: spacing(2) },
  retry: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },

  listContent: { paddingHorizontal: PAGE_PADDING, paddingTop: spacing(4), paddingBottom: spacing(28) },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: PAGE_PADDING },
  empty: { alignItems: 'center' },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(4),
  },
  emptyTitle: { ...typography.headline, color: colors.text },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing(1), textAlign: 'center' },

  fab: {
    position: 'absolute',
    right: PAGE_PADDING,
    bottom: spacing(5),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabPressed: { transform: [{ scale: 0.96 }] },
  fabDisabled: { opacity: 0.5 },

  uploadSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: spacing(2),
    paddingBottom: spacing(5),
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.outline,
    marginBottom: spacing(4),
  },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: { fontFamily: font.semibold, fontSize: 16, color: colors.text },
  uploadName: { fontFamily: font.regular, fontSize: 13, color: colors.textFaint, marginTop: 1 },
  cancel: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },
  uploadMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing(4), marginBottom: spacing(2) },
  uploadMeta: { fontFamily: font.medium, fontSize: 13, color: colors.textMuted },
  uploadPct: { fontFamily: font.bold, fontSize: 13, color: colors.primary },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainer, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },

  // actions sheet
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), marginBottom: spacing(3) },
  sheetIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sheetName: { fontFamily: font.bold, fontSize: 18, color: colors.text },
  sheetMeta: { fontFamily: font.medium, fontSize: 13, color: colors.textFaint, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(2) },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing(4), paddingVertical: spacing(3), borderRadius: radius.md, paddingHorizontal: spacing(2) },
  actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: font.medium, fontSize: 16 },
});
