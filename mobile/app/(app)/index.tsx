import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type DimensionValue,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { Screen } from '../../src/components/Screen';
import { TopBar } from '../../src/components/TopBar';
import { FsRow } from '../../src/components/FsRow';
import { BottomSheet } from '../../src/components/BottomSheet';
import { useAuth } from '../../src/auth/AuthContext';
import { api, ApiError, type FsEntry, type FsRoot } from '../../src/api/client';
import { fileVisualByName, rootIcon } from '../../src/utils/fileType';
import { formatBytes, formatDate } from '../../src/utils/format';
import { colors, font, PAGE_PADDING, radius, spacing, typography } from '../../src/theme';

type UploadState = { name: string; total?: number; pct: number };

// Last path segment, e.g. "C:\Users\me\Downloads" -> "Downloads".
function baseName(p: string): string {
  const n = p.replace(/[\\/]+$/, '');
  const i = Math.max(n.lastIndexOf('\\'), n.lastIndexOf('/'));
  return (i >= 0 ? n.slice(i + 1) : n) || p;
}

// Parent directory, or null when already at a drive root (-> back to roots).
function parentPath(p: string): string | null {
  const n = p.replace(/[\\/]+$/, '');
  const i = Math.max(n.lastIndexOf('\\'), n.lastIndexOf('/'));
  if (i < 0) return null;
  const parent = n.slice(0, i);
  if (/^[A-Za-z]:$/.test(parent)) return parent + '\\'; // drive root e.g. "C:\"
  return parent || null;
}

export default function BrowserScreen() {
  const { user, token } = useAuth();

  const [path, setPath] = useState<string | null>(null); // null = roots (My Laptop)
  const [roots, setRoots] = useState<FsRoot[]>([]);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<FsEntry | null>(null);

  const cancelUploadRef = useRef<null | (() => void)>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      if (path === null) {
        const res = await api.fsRoots(token);
        setRoots(res.roots);
      } else {
        const res = await api.fsList(token, path);
        setEntries(res.entries);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open this location');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, path]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const goUp = useCallback(() => {
    if (path !== null) setPath(parentPath(path));
  }, [path]);

  const onUpload = useCallback(async () => {
    if (path === null || !token) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (picked.canceled) return;
      const asset = picked.assets[0];

      setUpload({ name: asset.name, total: asset.size, pct: 0 });
      await api.fsUpload(
        token,
        path,
        { uri: asset.uri, name: asset.name, mimeType: asset.mimeType },
        (f) => setUpload((u) => (u ? { ...u, pct: f } : u)),
        (cancel) => {
          cancelUploadRef.current = cancel;
        },
      );
      load(); // refresh the current folder
    } catch (e) {
      const canceled = e instanceof ApiError && /cancel/i.test(e.message);
      if (!canceled) {
        Alert.alert('Upload failed', e instanceof ApiError ? e.message : 'Something went wrong');
      }
    } finally {
      setUpload(null);
      cancelUploadRef.current = null;
    }
  }, [path, token, load]);

  // Download a real file to cache, then hand it to the OS share/preview sheet.
  const openEntry = useCallback(
    async (entry: FsEntry) => {
      if (!token) return;
      setSelected(null);
      try {
        setBusyPath(entry.path);
        const uri = await api.fsDownloadToCache(token, entry);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { dialogTitle: entry.name });
        } else {
          Alert.alert('Downloaded', `Saved to:\n${uri}`);
        }
      } catch (e) {
        Alert.alert('Download failed', e instanceof ApiError ? e.message : 'Something went wrong');
      } finally {
        setBusyPath(null);
      }
    },
    [token],
  );

  const renderRow = (item: FsRoot | FsEntry) => {
    // Roots have no is_dir field; treat them as folders.
    if (!('is_dir' in item)) {
      return (
        <FsRow
          title={item.name}
          icon={rootIcon(item.name)}
          iconBg={colors.primaryTint}
          iconFg={colors.primary}
          showChevron
          onPress={() => setPath(item.path)}
        />
      );
    }
    if (item.is_dir) {
      return (
        <FsRow
          title={item.name}
          icon="folder"
          iconBg={colors.primaryTint}
          iconFg={colors.primary}
          showChevron
          onPress={() => setPath(item.path)}
        />
      );
    }
    const v = fileVisualByName(item.name);
    return (
      <FsRow
        title={item.name}
        subtitle={`${formatBytes(item.size)} · ${formatDate(item.mod_time)}`}
        icon={v.icon}
        iconBg={v.bg}
        iconFg={v.fg}
        busy={busyPath === item.path}
        onPress={() => setSelected(item)}
      />
    );
  };

  const data: (FsRoot | FsEntry)[] = path === null ? roots : entries;

  return (
    <Screen edges={['top']}>
      <TopBar email={user?.email} />

      <View style={styles.nav}>
        {path !== null && (
          <Pressable onPress={goUp} hitSlop={8} style={styles.back}>
            <Feather name="chevron-left" size={26} color={colors.text} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {path === null ? 'My Laptop' : baseName(path)}
          </Text>
          {path !== null && (
            <Text style={styles.path} numberOfLines={1}>
              {path}
            </Text>
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
          data={data}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => renderRow(item)}
          contentContainerStyle={data.length === 0 ? styles.emptyWrap : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name="folder" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>This folder is empty</Text>
            </View>
          }
        />
      )}

      {/* Upload into the current folder (only inside a folder) */}
      {path !== null && (
        <Pressable
          onPress={onUpload}
          disabled={!!upload}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed, !!upload && styles.fabDisabled]}
        >
          <Feather name="upload" size={24} color={colors.onPrimary} />
        </Pressable>
      )}

      {/* Upload progress sheet */}
      {upload && (
        <View style={styles.uploadSheet}>
          <View style={styles.handle} />
          <View style={styles.uploadRow}>
            <View style={styles.uploadIcon}>
              <Feather name="upload-cloud" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadTitle}>Uploading…</Text>
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
        {selected && <FileActions entry={selected} onOpen={openEntry} />}
      </BottomSheet>
    </Screen>
  );
}

function FileActions({ entry, onOpen }: { entry: FsEntry; onOpen: (e: FsEntry) => void }) {
  const v = fileVisualByName(entry.name);
  return (
    <View>
      <View style={styles.sheetHeader}>
        <View style={[styles.sheetIcon, { backgroundColor: v.bg }]}>
          <Feather name={v.icon} size={22} color={v.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetName} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={styles.sheetMeta}>
            {formatBytes(entry.size)} · {formatDate(entry.mod_time)}
          </Text>
        </View>
      </View>
      <View style={styles.divider} />
      <SheetAction icon="external-link" label="Open" onPress={() => onOpen(entry)} />
      <SheetAction icon="download" label="Download" onPress={() => onOpen(entry)} />
      <SheetAction icon="share-2" label="Share" onPress={() => onOpen(entry)} />
    </View>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceLow }]}
    >
      <View style={styles.actionIcon}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAGE_PADDING,
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
  },
  back: { marginRight: spacing(2), marginLeft: -spacing(1) },
  title: { ...typography.title, color: colors.text },
  path: { fontFamily: font.medium, fontSize: 12, color: colors.textFaint, marginTop: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(6) },
  error: { ...typography.body, color: colors.danger, textAlign: 'center', marginBottom: spacing(2) },
  retry: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },

  listContent: { paddingHorizontal: PAGE_PADDING, paddingTop: spacing(2), paddingBottom: spacing(28) },
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
  fabDisabled: { opacity: 0.4 },

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

  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), marginBottom: spacing(3) },
  sheetIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sheetName: { fontFamily: font.bold, fontSize: 18, color: colors.text },
  sheetMeta: { fontFamily: font.medium, fontSize: 13, color: colors.textFaint, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(2) },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing(4), paddingVertical: spacing(3), borderRadius: radius.md, paddingHorizontal: spacing(2) },
  actionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: font.medium, fontSize: 16, color: colors.text },
});
