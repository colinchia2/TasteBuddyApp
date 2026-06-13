// Shared photo-source helpers for in-app uploads. "Last photo taken" grabs the
// single most-recent camera-roll photo in one tap; the resolved URI is fed into
// each screen's EXISTING /api/photos/upload path (no new endpoint, no dup logic).
import { Platform, ActionSheetIOS, Alert, Linking } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';

// Build an uploadable multipart filename with an extension the server accepts.
// expo-image-picker (especially multi-select) can hand back a uri with no/odd
// extension; /api/photos/upload rejects names whose extension isn't allowed
// ("File type not allowed"). The backend re-encodes to JPEG via Pillow regardless
// of the name (it detects the real format from bytes), so forcing .jpg is safe.
const _UPLOAD_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
export function safePhotoName(uri) {
  const last = (String(uri || '').split('/').pop() || '').split('?')[0].split('#')[0];
  const ext = last.includes('.') ? last.split('.').pop().toLowerCase() : '';
  return _UPLOAD_EXTS.includes(ext) ? last : 'photo.jpg';
}

// Options sheet: Camera · Last photo taken · Choose from library. onCamera is
// optional — callers that don't pass it simply omit the row.
export function presentPhotoSource({ onCamera, onLast, onLibrary }) {
  const opts = [];
  if (onCamera) opts.push({ text: 'Take photo', onPress: onCamera });
  opts.push({ text: 'Last photo taken', onPress: onLast });
  opts.push({ text: 'Choose from library', onPress: onLibrary });
  if (Platform.OS === 'ios' && ActionSheetIOS) {
    const labels = opts.map(o => o.text).concat('Cancel');
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Add a photo', options: labels, cancelButtonIndex: opts.length },
      (i) => { if (i < opts.length) opts[i].onPress?.(); }
    );
  } else {
    Alert.alert('Add a photo', undefined,
      opts.concat({ text: 'Cancel', style: 'cancel' }));
  }
}

// Camera capture → onUri(localUri). Requests camera permission first (graceful
// denial). After a successful capture, saves the photo to the device library
// (Colin's ask — library-picked photos are already there; captures are not), via
// expo-media-library write/add permission. Saving is best-effort: a save failure
// never blocks attaching the photo to the visit. The returned uri is uploaded
// through the EXISTING api.uploadFile() (expo-file-system) path — never
// fetch+FormData (New-Arch rejects file parts).
export async function capturePhoto({ onUri }) {
  let perm;
  try {
    perm = await ImagePicker.requestCameraPermissionsAsync();
  } catch (e) {
    Alert.alert('Camera unavailable', 'Could not access the camera.');
    return;
  }
  if (!perm || !perm.granted) {
    Alert.alert(
      'Camera access needed',
      'Enable camera access for TasteBuddy in Settings to take a photo.',
      [{ text: 'Open Settings', onPress: () => Linking.openSettings() }, { text: 'Cancel', style: 'cancel' }],
    );
    return;
  }
  let result;
  try {
    result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
  } catch (e) {
    Alert.alert('Camera error', 'Something went wrong taking the photo.');
    return;
  }
  if (result.canceled || !result.assets?.length) return;
  const uri = result.assets[0].uri;
  // Save the capture to the camera roll (best-effort, add-only permission).
  try {
    const can = await MediaLibrary.requestPermissionsAsync(true); // writeOnly = add
    if (can?.granted) await MediaLibrary.saveToLibraryAsync(uri);
  } catch (_) { /* non-fatal — still attach to the visit */ }
  onUri(uri);
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
