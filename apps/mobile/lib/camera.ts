import { CameraView } from 'expo-camera';
import type { RefObject } from 'react';

export async function takePicture(ref: RefObject<CameraView | null>): Promise<string> {
  if (!ref.current) throw new Error('Camera not ready');
  const photo = await ref.current.takePictureAsync({ base64: true, quality: 0.6 });
  if (!photo?.base64) throw new Error('Failed to capture image');
  return photo.base64;
}
