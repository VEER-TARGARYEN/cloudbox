import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as LegacyFileSystem from 'expo-file-system/legacy';

import { mimeFromName } from './fileType';

// Open a downloaded file in the right app. On Android this fires an ACTION_VIEW
// intent (so a PDF opens in a PDF viewer, a photo in the gallery, etc.) instead
// of the share sheet. On iOS we present it via the document/preview sheet.
export async function openLocalFile(uri: string, name: string): Promise<void> {
  const mime = mimeFromName(name);

  if (Platform.OS === 'android') {
    const contentUri = await LegacyFileSystem.getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: mime,
    });
    return;
  }

  // iOS / other: the share/preview sheet is the system way to view a file.
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: mime });
  }
}

// Explicitly hand the file to the OS share sheet ("send to…").
export async function shareLocalFile(uri: string, name: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: mimeFromName(name) });
  }
}
