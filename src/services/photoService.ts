export type PhotoDoc = {
  id?: string
  imageUrl: string
  deleteUrl?: string
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
  uploadedAt?: any
}

const firebaseConfig = {
  apiKey: (import.meta.env as any).VITE_FIREBASE_API_KEY,
  authDomain: (import.meta.env as any).VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta.env as any).VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta.env as any).VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta.env as any).VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta.env as any).VITE_FIREBASE_APP_ID,
}

const getFirebaseApp = async () => {
  if (!firebaseConfig.projectId) {
    throw new Error('Firebase not configured')
  }

  const { initializeApp, getApp, getApps } = await import('firebase/app')
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
}

const getFirestoreDb = async () => {
  const app = await getFirebaseApp()
  const { getFirestore } = await import('firebase/firestore')
  return getFirestore(app)
}

export async function fetchApprovedPhotos(limit = 100): Promise<PhotoDoc[]> {
  try {
    const { collection, query, where, orderBy, limit: limitFn, getDocs } = await import('firebase/firestore')
    const db = await getFirestoreDb()

    const photosCol = collection(db, 'photos')
    const q = query(photosCol, where('approved', '==', true), orderBy('uploadedAt', 'desc'), limitFn(limit))
    const snap = await getDocs(q)
    const items: PhotoDoc[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    return items
  } catch (err: any) {
    console.warn('fetchApprovedPhotos: failed or not configured:', err?.message || err)
    return []
  }
}

export async function fetchUnapprovedPhotos(limit = 200): Promise<PhotoDoc[]> {
  try {
    const { collection, query, where, orderBy, limit: limitFn, getDocs } = await import('firebase/firestore')
    const db = await getFirestoreDb()

    const photosCol = collection(db, 'photos')
    const q = query(photosCol, where('approved', '==', false), orderBy('uploadedAt', 'desc'), limitFn(limit))
    const snap = await getDocs(q)
    const items: PhotoDoc[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    return items
  } catch (err: any) {
    console.warn('fetchUnapprovedPhotos: failed or not configured:', err?.message || err)
    return []
  }
}

export async function approvePhoto(photoId: string) {
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
  const db = await getFirestoreDb()
  const ref = doc(db, 'photos', photoId)
  await updateDoc(ref, { approved: true, approvedAt: serverTimestamp() })
}

export async function deletePhoto(photo: PhotoDoc) {
  // If a deleteUrl exists, call Netlify function to perform the deletion server-side
  try {
    if (photo.deleteUrl) {
      await fetch('/.netlify/functions/delete-imgbb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteUrl: photo.deleteUrl })
      })
    }
  } catch (e) {
    console.warn('delete-imgbb call failed:', e)
  }

  const { doc, deleteDoc } = await import('firebase/firestore')
  const db = await getFirestoreDb()
  const ref = doc(db, 'photos', photo.id!)
  await deleteDoc(ref)
}

export async function subscribeApprovedPhotos(
  limit = 100,
  onChange?: (items: PhotoDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const { collection, query, where, orderBy, limit: limitFn, onSnapshot } = await import('firebase/firestore')
  const db = await getFirestoreDb()
  const photosCol = collection(db, 'photos')
  const q = query(photosCol, where('approved', '==', true), orderBy('uploadedAt', 'desc'), limitFn(limit))

  return onSnapshot(
    q,
    (snap) => {
      const items: PhotoDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      onChange?.(items)
    },
    (err) => {
      console.warn('subscribeApprovedPhotos: failed:', err?.message || err)
      onError?.(err as Error)
    }
  )
}
