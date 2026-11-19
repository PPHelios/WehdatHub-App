import { PermissionsAndroid, Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import type { VoiceFile } from '@wehdathub/shared';

/** Asks for the microphone (Android asks at run time; iOS asks on first record). Returns false when refused. */
export async function ensureMic(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

/** The recorder held no sound when stopped; treated like a too-short note, not reported as an error. */
export class EmptyRecordingError extends Error {
  constructor() {
    super('empty recording');
    this.name = 'EmptyRecordingError';
  }
}

export async function startRecording(): Promise<void> {
  await AudioRecorderPlayer.startRecorder();
}

/** Stops and returns the recorded note as an upload (AAC in an m4a/mp4 container on both phones). */
export async function stopRecording(): Promise<VoiceFile> {
  let uri: string;
  try {
    uri = await AudioRecorderPlayer.stopRecorder();
  } catch (e) {
    // Android's MediaRecorder.stop() throws "stop failed" when it caught no sound yet (a very short note): not a fault.
    if (/stop failed/i.test(String((e as Error)?.message ?? e))) throw new EmptyRecordingError();
    throw e;
  }
  return { uri: uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`, name: 'search.m4a', type: 'audio/mp4' };
}

/** Stops the recorder and throws the note away (the finger slid off, or the hold was too short). */
export async function cancelRecording(): Promise<void> {
  try {
    await AudioRecorderPlayer.stopRecorder();
  } catch {
    /* nothing was recording */
  }
}
