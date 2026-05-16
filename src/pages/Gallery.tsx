import { useEffect, useState, type ReactElement } from 'react'
import { subscribeApprovedPhotos, type PhotoDoc } from '../services/photoService'
import GalleryGrid from '../components/GalleryGrid'

export default function Gallery(): ReactElement {
  const [photos, setPhotos] = useState<PhotoDoc[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const unsubscribePromise = subscribeApprovedPhotos(
      200,
      (items) => {
        setPhotos(items)
        setLoading(false)
      },
      () => {
        setLoading(false)
      }
    )

    let unsubscribe: (() => void) | null = null
    void unsubscribePromise.then((stop) => {
      unsubscribe = stop
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return (
    <div className="min-h-screen theme-bg-primary theme-text transition-colors relative overflow-hidden px-4 py-4 md:px-8 md:py-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 blur-3xl" />
        <div className="absolute right-[-8rem] top-[10rem] h-80 w-80 rounded-full bg-sky-500/10 dark:bg-sky-500/15 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[20%] h-72 w-72 rounded-full bg-amber-500/10 dark:bg-amber-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2.25rem] border border-slate-200/80 dark:border-white/10 bg-[var(--bg-primary)] shadow-2xl shadow-black/[0.04] backdrop-blur-xl">
          <div className="flex flex-col gap-6 border-b border-slate-200/80 dark:border-white/10 px-6 py-7 md:px-8 md:py-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                Public Gallery
              </div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">See the work, the places, and the progress.</h2>
            </div>
          </div>

          <div className="px-6 py-6 md:px-8 md:py-8">
            {loading && <p className="muted">Loading photos...</p>}
            {!loading && photos.length === 0 && <p className="muted">No public photos available yet.</p>}
            <GalleryGrid photos={photos} />
          </div>
        </section>
      </div>
    </div>
  )
}
