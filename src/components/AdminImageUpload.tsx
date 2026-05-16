import { useEffect, useState, type ReactElement } from 'react'
import { uploadToImgBB, savePhotoMetadata } from '../services/imageService'
import { authenticateAdminWithWallet, ensureFirebase, waitForFirebaseAuthReady } from '../services/authService'
import { getAuth } from 'firebase/auth'

type AdminImageUploadProps = {
  onUploaded?: () => void
}

export default function AdminImageUpload({ onUploaded }: AdminImageUploadProps): ReactElement {
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [status, setStatus] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const autoSignIn = async () => {
      try {
        ensureFirebase()
        await waitForFirebaseAuthReady()
        const auth = getAuth()

        if (auth.currentUser) {
          if (!cancelled) {
            setSignedIn(true)
            setStatus('Signed in')
          }
          return
        }

        if (!cancelled) setStatus('Signing in automatically...')
        await authenticateAdminWithWallet()

        if (!cancelled) {
          setSignedIn(true)
          setStatus('Signed in')
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus('Auto sign-in failed: ' + (err?.message || String(err)))
        }
      }
    }

    void autoSignIn()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleUpload() {
    try {
      ensureFirebase()
      await waitForFirebaseAuthReady()
      const auth = getAuth()
      if (!auth.currentUser) {
        await authenticateAdminWithWallet()
      }
      setSignedIn(true)
    } catch (err: any) {
      setStatus('Authentication failed: ' + (err?.message || String(err)))
      return
    }
    if (!file) return
    setUploading(true)
    setStatus('Uploading...')
    try {
      const res = await uploadToImgBB(file)
      setStatus('Saved to ImgBB, writing metadata...')

      const meta = {
        imageUrl: res.imageUrl,
        thumbUrl: res.thumbUrl,
        filename: file.name,
        uploader: 'admin',
        ownerType: 'company',
        caption,
        approved: true,
        featured: false,
      }

      const save = await savePhotoMetadata(meta as any)
      setStatus(`Done. ImgBB: ${res.imageUrl} | Firestore: ${JSON.stringify(save)}`)
      setFile(null)
      setCaption('')
      onUploaded?.()
    } catch (err: any) {
      setStatus('Upload failed: ' + (err?.message || String(err)))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="card theme-glass rounded-[2rem] p-5 shadow-sm backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 mb-5">
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${signedIn ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
          {signedIn ? 'Signed In' : 'Wallet Needed'}
        </span>
      </div>

      <div className="space-y-4">
        <label className="block rounded-3xl border border-dashed border-slate-300/80 dark:border-white/10 bg-[var(--bg-tertiary)]/80 p-5 cursor-pointer hover:border-emerald-500/60 transition-colors">
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <div className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">Choose Image</div>
            <p className="text-sm font-medium theme-text">{file ? file.name : 'Click to browse or drop a photo here'}</p>
            <p className="text-xs muted">PNG, JPG, WebP</p>
          </div>
        </label>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest muted ml-1">Caption</label>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} className="input w-full mt-2" placeholder="Short image caption" />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {!signedIn && (
            <button
              onClick={async () => {
                try {
                  await authenticateAdminWithWallet()
                  setSignedIn(true)
                  setStatus('Signed in')
                } catch (e: any) {
                  setStatus('Sign-in failed: ' + (e?.message || e))
                }
              }}
              className="btn btn-outline-accent px-5 py-3"
            >
              Sign in with Wallet
            </button>
          )}
          <button onClick={handleUpload} disabled={!file || uploading} className={`btn btn-emerald px-6 py-3 ${(!file || uploading) ? 'btn-disabled' : ''}`}>
            {uploading ? 'Uploading...' : 'Upload Image'}
          </button>
        </div>

        <div className="hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-[var(--bg-tertiary)] px-4 py-3 text-sm muted">
          {status || 'Images publish immediately to the gallery after upload.'}
        </div>
      </div>
    </div>
  )
}
