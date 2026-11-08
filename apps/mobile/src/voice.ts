import { PermissionsAndroid, Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import type { VoiceFile } from '@wehdathub/shared';

/** Asks for the microphone (Android asks at run time; iOS asks on first record). Returns false when refused. */
export async function ensureMic(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export async function startRecording(): Promise<void> {
  await AudioRecorderPlayer.startRecorder();
}

/** Stops and returns the recorded note as an upload (AAC in an m4a/mp4 container on both phones). */
export async function stopRecording(): Promise<VoiceFile> {
  const uri = await AudioRecorderPlayer.stopRecorder();
  return { uri: uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`, name: 'search.m4a', type: 'audio/mp4' };
}
