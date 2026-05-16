/*
  imageService.ts
  - upload images to the server Netlify function which forwards to ImgBB
  - optionally save metadata to Firebase Firestore if VITE_FIREBASE_* env vars are set

  Notes: install firebase when you want Firestore writes:
    npm install firebase
*/

export async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      // strip data:<mime>;base64, prefix if present
      const comma = result.indexOf(',')
      const base = comma >= 0 ? result.slice(comma + 1) : result
      resolve(base)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export type UploadResult = {
  imageUrl: string
  thumbUrl?: string
  deleteUrl?: string
  raw?: any
}

export async function uploadToImgBB(file: File, name?: string): Promise<UploadResult> {
  const base = await fileToBase64(file)

  const res = await fetch('/.netlify/functions/upload-imgbb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, content: base, name }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`ImgBB upload failed: ${res.status} ${txt}`)
  }

  const json = await res.json()
  return {
    imageUrl: json.imageUrl,
    thumbUrl: json.thumbUrl,
    deleteUrl: json.deleteUrl,
    raw: json.raw,
  }
}

export type PhotoMetadata = {
  imageUrl: string
  thumbUrl?: string
  filename?: string
  uploader?: string
  ownerType?: 'company' | 'producer' | 'user'
  ownerId?: string | null
  batchId?: string | null
  caption?: string
  tags?: string[]
  location?: any
  photographer?: string
  license?: string
  approved?: boolean
  featured?: boolean
}

export async function savePhotoMetadata(metadata: PhotoMetadata) {
  // Firestore write is optional; dynamically import firebase to avoid hard dependency
  try {
    const firebaseConfig = {
      apiKey: (import.meta.env as any).VITE_FIREBASE_API_KEY,
      authDomain: (import.meta.env as any).VITE_FIREBASE_AUTH_DOMAIN,
      projectId: (import.meta.env as any).VITE_FIREBASE_PROJECT_ID,
      storageBucket: (import.meta.env as any).VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: (import.meta.env as any).VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: (import.meta.env as any).VITE_FIREBASE_APP_ID,
    }

    if (!firebaseConfig.projectId) {
      throw new Error('Firebase config missing; skipping Firestore write')
    }

    const { initializeApp } = await import('firebase/app')
    const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore')

    const app = initializeApp(firebaseConfig)
    const db = getFirestore(app)

    const col = collection(db, 'photos')
    const docRef = await addDoc(col, { ...metadata, uploadedAt: serverTimestamp() })
    return { id: docRef.id }
  } catch (err: any) {
    // When firebase isn't installed or config missing, surface a helpful message
    console.warn('savePhotoMetadata: Firestore write skipped or failed:', err?.message || err)
    return { skipped: true, error: String(err?.message || err) }
  }
}
