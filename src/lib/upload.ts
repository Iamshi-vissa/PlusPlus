import * as ImagePicker from 'expo-image-picker';

import { getSupabase } from '@/lib/supabase';

export type PickedImage = { uri: string; mimeType: string };

/** Lets the person choose (or take) a photo of a document. */
export async function pickDocumentImage(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
}

/**
 * Uploads into a PRIVATE bucket under the person's own folder. Only platform admins can read it back.
 * Returns the storage path, or null on failure.
 */
export async function uploadPrivateDocument(
  bucket: 'clinic-docs' | 'responder-docs',
  userId: string,
  kind: string,
  image: PickedImage,
): Promise<string | null> {
  try {
    const body = await (await fetch(image.uri)).arrayBuffer();
    const ext =
      image.mimeType === 'image/png' ? 'png' : image.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await getSupabase()
      .storage.from(bucket)
      .upload(path, body, { contentType: image.mimeType });
    return error ? null : path;
  } catch {
    return null;
  }
}
