import { useEffect, useState, type ReactElement } from 'react'
import { subscribeApprovedPhotos, deletePhoto, type PhotoDoc } from '../services/photoService'
import { authenticateAdminWithWallet } from '../services/authService'

export default function AdminGallery(): ReactElement {
  const [photos, setPhotos] = useState<PhotoDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [actionStatus, setActionStatus] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const stop = await subscribeApprovedPhotos(
      48,
      (items) => {
        setPhotos(items)
        setLoading(false)
      },
      () => {
        setLoading(false)
      }
    )
    return stop
  }

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    void load().then((stop) => {
      unsubscribe = stop
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const handleDelete = async (p: PhotoDoc) => {
    if (!confirm('Delete this photo permanently?')) return
    setBusyId(p.id || p.imageUrl)
    setActionStatus('Deleting image...')
    try {
      await authenticateAdminWithWallet()
      await deletePhoto(p)
      setActionStatus('Deleted')
      await load()
    } catch (e: any) {
      setActionStatus('Delete failed: ' + (e?.message || e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card theme-glass rounded-[2rem] p-5 shadow-sm backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] bg-slate-100 dark:bg-white/5 muted">
          {photos.length} photos
        </div>
      </div>

      {loading && <p className="muted mb-4">Loading gallery...</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {photos.map((p) => (
          <article key={p.id || p.imageUrl} className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-white/10 bg-[var(--bg-secondary)] shadow-sm transition-transform hover:-translate-y-0.5">
            <div className="relative">
              <img src={p.thumbUrl || p.imageUrl} alt={p.caption || p.filename || 'gallery photo'} className="h-48 w-full object-cover" />
              <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
                Company
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="font-bold theme-text line-clamp-1">{p.caption || p.filename || 'Untitled image'}</div>
                <div className="text-xs muted mt-1">Company photo • public archive</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDelete(p)} disabled={busyId === (p.id || p.imageUrl)} className={`btn btn-rose flex-1 text-sm ${busyId === (p.id || p.imageUrl) ? 'btn-disabled' : ''}`}>
                  {busyId === (p.id || p.imageUrl) ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {photos.length === 0 && !loading && <div className="muted">No gallery images yet.</div>}
      <div className="mt-4 text-sm muted">{actionStatus}</div>
    </div>
  )
}
