import { PermissionsAndroid, Platform } from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

/** Saves a picture (by its address) to the phone's gallery. Returns false when the person refused the permission. */
export async function saveToGallery(url: string): Promise<boolean> {
  // Android 10 and later save through the media store with no permission; Android 9 and earlier ask for storage.
  if (Platform.OS === 'android' && Number(Platform.Version) < 29) {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    if (r !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }
  await CameraRoll.saveAsset(url, { type: 'photo' });
  return true;
}
