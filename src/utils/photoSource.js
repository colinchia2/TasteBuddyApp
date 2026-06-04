// Shared photo-source helpers for in-app uploads. "Last photo taken" grabs the
// single most-recent camera-roll photo in one tap; the resolved URI is fed into
// each screen's EXISTING /api/photos/upload path (no new endpoint, no dup logic).
import { Platform, ActionSheetIOS, Alert, Linking } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

// Options sheet with "Last photo taken" as the top option.
export function presentPhotoSource({ onLast, onLibrary }) {
  if (Platform.OS === 'ios' && ActionSheetIOS) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Add a photo',
        options: ['Last photo taken', 'Choose from library', 'Cancel'],
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) onLast();
        else if (i === 1) onLibrary();
      }
    );
  } else {
    Alert.alert('Add a photo', undefined, [
      { text: 'Last photo taken', onPress: onLast },
      { text: 'Choose from library', onPress: onLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
}

// Resolve the most-recent photo to an uploadable LOCAL uri.
// Returns { status, uri? }: 'ok' | 'denied' | 'limited' | 'empty' | 'error'.
export async function getLastPhotoUri() {
  let perm;
  try {
    perm = await MediaLibrary.requestPermissionsAsync();
  } catch (e) {
    return { status: 'error' };
  }
  if (!perm || !perm.granted) return { status: 'denied' };
  // iOS "limited": getAssetsAsync only sees user-selected photos, so "last" may
  // not be the true latest — surface it instead of grabbing the wrong photo.
  if (perm.accessPrivileges === 'limited') return { status: 'limited' };
  try {
    const page = await MediaLibrary.getAssetsAsync({
      first: 1,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    const asset = page && page.assets && page.assets[0];
    if (!asset) return { status: 'empty' };
    // iOS asset uris are often ph:// which can't be uploaded directly — resolve
    // the file-backed localUri.
    let uri = asset.uri;
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      if (info && info.localUri) uri = info.localUri;
    } catch (_) {}
    return { status: 'ok', uri };
  } catch (e) {
    return { status: 'error' };
  }
}

function _issueAlert({ title, message, onLibrary, showSettings }) {
  const buttons = [];
  if (showSettings) buttons.push({ text: 'Open Settings', onPress: () => Linking.openSettings() });
  if (onLibrary) buttons.push({ text: 'Choose from library', onPress: onLibrary });
  buttons.push({ text: 'Cancel', style: 'cancel' });
  Alert.alert(title, message, buttons);
}

// Full "Last photo taken" flow: resolve + handle every edge gracefully. Calls
// onUri(uri) only on success; otherwise prompts (Settings / fall back to picker).
export async function pickLastPhoto({ onUri, onLibrary }) {
  const res = await getLastPhotoUri();
  switch (res.status) {
    case 'ok':
      onUri(res.uri);
      break;
    case 'denied':
      _issueAlert({
        title: 'Photo access needed',
        message: 'Enable photo access for TasteBuddy in Settings to use “Last photo taken,” or pick from your library.',
        onLibrary, showSettings: true,
      });
      break;
    case 'limited':
      _issueAlert({
        title: 'Limited photo access',
        message: 'TasteBuddy can only see the photos you’ve selected, so this may not be your latest. Allow full access in Settings, or choose from your library.',
        onLibrary, showSettings: true,
      });
      break;
    case 'empty':
      _issueAlert({
        title: 'No recent photo',
        message: 'We couldn’t find a recent photo. Choose one from your library instead.',
        onLibrary,
      });
      break;
    default:
      _issueAlert({
        title: 'Couldn’t access photos',
        message: 'Something went wrong reading your photo library. Choose from your library instead.',
        onLibrary,
      });
  }
}
