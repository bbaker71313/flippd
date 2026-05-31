import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from './supabase'

const MAX_PHOTOS = 10
const JPEG_QUALITY = 0.8

export { MAX_PHOTOS }

export async function pickAndCompressPhoto(): Promise<{ uri: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 1,
  })
  if (result.canceled || !result.assets?.[0]) return null

  const compressed = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 1200 } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  )
  return { uri: compressed.uri }
}

export async function uploadItemPhoto(
  userId: number,
  itemId: number,
  photoUri: string,
): Promise<string> {
  const filename = `${Date.now()}.jpg`
  const path = `item-photos/${userId}/${itemId}/${filename}`

  const response = await fetch(photoUri)
  const blob = await response.blob()

  if (blob.size > 1_100_000) {
    throw new Error('Photo exceeds 1MB limit after compression')
  }

  const { error } = await supabase.storage
    .from('item-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('item-photos').getPublicUrl(path)
  return data.publicUrl
}
