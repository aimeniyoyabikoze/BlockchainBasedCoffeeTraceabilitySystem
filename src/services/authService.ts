import { ethers } from 'ethers'
import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInWithCustomToken } from 'firebase/auth'

const firebaseConfig = {
  apiKey: (import.meta.env as any).VITE_FIREBASE_API_KEY,
  authDomain: (import.meta.env as any).VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta.env as any).VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta.env as any).VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta.env as any).VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta.env as any).VITE_FIREBASE_APP_ID,
}

let firebaseInitialized = false
let firebaseAuthReadyPromise: Promise<void> | null = null
export function ensureFirebase() {
  if (firebaseInitialized) return
  if (!firebaseConfig.projectId) throw new Error('Firebase not configured')
  initializeApp(firebaseConfig)
  firebaseInitialized = true
  const auth = getAuth()
  if (!firebaseAuthReadyPromise) {
    firebaseAuthReadyPromise = setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('Failed to set Firebase auth persistence:', err)
    })
  }
}

export async function waitForFirebaseAuthReady(): Promise<void> {
  ensureFirebase()
  const auth = getAuth()
  if (firebaseAuthReadyPromise) {
    await firebaseAuthReadyPromise
  }

  if (auth.currentUser) return

  await new Promise<void>((resolve) => {
    let unsubscribe = () => {}
    unsubscribe = onAuthStateChanged(
      auth,
      () => {
        unsubscribe()
        resolve()
      },
      () => {
        unsubscribe()
        resolve()
      }
    )
  })
}

export function getFirebaseWalletUid(address: string) {
  return `wallet:${address.toLowerCase()}`
}

export async function ensureAdminFirebaseSession(address?: string): Promise<boolean> {
  ensureFirebase()
  const auth = getAuth()
  if (auth.currentUser && (!address || auth.currentUser.uid === getFirebaseWalletUid(address))) {
    return true
  }

  if (!address) return false
  if (!(window as any).ethereum) throw new Error('MetaMask not available')

  const provider = new ethers.BrowserProvider((window as any).ethereum)
  const signer = await provider.getSigner()
  const signerAddress = await signer.getAddress()
  if (signerAddress.toLowerCase() !== address.toLowerCase()) {
    throw new Error('Connected wallet does not match the active dashboard account')
  }

  const message = `CoffeeTrace authentication ${Date.now()}`
  const signature = await signer.signMessage(message)

  const res = await fetch('/.netlify/functions/firebase-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: signerAddress, message, signature })
  })
  if (!res.ok) throw new Error('Auth server rejected')
  const json = await res.json()
  await signInWithCustomToken(auth, json.customToken)
  return true
}

export async function authenticateAdminWithWallet(): Promise<void> {
  if (!(window as any).ethereum) throw new Error('MetaMask not available')
  const provider = new ethers.BrowserProvider((window as any).ethereum)
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  await ensureAdminFirebaseSession(address)
}
