import { useEffect, useMemo, useState, type ReactElement } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import type { PhotoDoc } from '../services/photoService'

const AUTO_ADVANCE_MS = 5000

export default function GalleryGrid({ photos }: { photos: PhotoDoc[] }): ReactElement {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lastChangedAt, setLastChangedAt] = useState(Date.now())

  const slides = useMemo(
    () => photos.map((photo) => ({
      src: photo.imageUrl,
      alt: photo.caption || photo.filename || 'photo',
      title: photo.caption || photo.filename || 'Company image',
      description: photo.uploader || 'CoffeeTrace public gallery',
    })),
    [photos]
  )

  useEffect(() => {
    if (activeIndex >= photos.length) {
      setActiveIndex(0)
    }
  }, [activeIndex, photos.length])

  useEffect(() => {
    if (!photos.length) return

    const preloadImages = photos.forEach((photo) => {
      const full = new Image()
      full.src = photo.imageUrl
      const thumb = new Image()
      thumb.src = photo.thumbUrl || photo.imageUrl
    })

    return () => {
      void preloadImages
    }
  }, [photos])

  useEffect(() => {
    if (!photos.length) return
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % photos.length)
    }, AUTO_ADVANCE_MS)

    return () => window.clearInterval(timer)
  }, [photos.length])

  useEffect(() => {
    setLastChangedAt(Date.now())
  }, [activeIndex])

  const activePhoto = photos[activeIndex] || photos[0]

  const openLightboxAt = (index: number) => {
    setActiveIndex(index)
    setLightboxOpen(true)
  }

  return (
    <>
      <div className="space-y-8">
        <section className="card overflow-hidden rounded-4xl border border-slate-200/80 dark:border-white/10 bg-(--bg-secondary) shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 dark:border-white/10 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold muted">Featured frame</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs muted">
              <span className="rounded-full border border-slate-200/80 dark:border-white/10 bg-(--bg-tertiary) px-3 py-1">Auto-advances every 5s</span>
              <button onClick={() => openLightboxAt(activeIndex)} className="btn btn-outline-accent px-4 py-2 text-sm">
                Open Lightbox
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden bg-(--bg-tertiary)">
            {activePhoto ? (
              <div key={activeIndex} className="gallery-feature-swap relative">
                <img
                  src={activePhoto.imageUrl}
                  alt={activePhoto.caption || activePhoto.filename || 'company photo'}
                  className="h-[26rem] w-full object-cover sm:h-[34rem] lg:h-[42rem]"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/5 to-black/10" />
                <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 p-5 text-white sm:p-6">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] backdrop-blur">
                    Public Gallery
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-white/90 sm:text-base">
                    {activePhoto.caption || activePhoto.filename || 'Company media updates, field moments, and visual progress.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-white/80">
                    <span className="rounded-full bg-black/30 px-3 py-1 backdrop-blur">
                      {photos.length > 0 ? `${activeIndex + 1} of ${photos.length}` : '0 of 0'}
                    </span>
                    <span className="rounded-full bg-black/30 px-3 py-1 backdrop-blur">
                      updated {new Date(lastChangedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    {/* <button
                      onClick={() => setActiveIndex((current) => (current - 1 + photos.length) % photos.length)}
                      className="rounded-full bg-black/30 px-3 py-1 backdrop-blur transition hover:bg-black/45 disabled:opacity-40"
                      disabled={!photos.length}
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setActiveIndex((current) => (current + 1) % photos.length)}
                      className="rounded-full bg-black/30 px-3 py-1 backdrop-blur transition hover:bg-black/45 disabled:opacity-40"
                      disabled={!photos.length}
                    >
                      Next
                    </button> */}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-80 items-center justify-center sm:h-120">
                <p className="muted">No photos available yet.</p>
              </div>
            )}
          </div>
        </section>

        <section className="card rounded-4xl border border-slate-200/80 dark:border-white/10 bg-(--bg-secondary) shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 px-5 py-4 sm:px-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold muted">Timeline</p>
            </div>
          </div>

          <div className="gallery-timeline px-4 py-4 sm:px-6">
            {photos.map((photo, index) => (
              <button
                key={photo.id || photo.imageUrl}
                onClick={() => setActiveIndex(index)}
                className={`gallery-timeline-item flex min-w-42.5 items-center gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition-all ${activeIndex === index ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-slate-200/80 dark:border-white/10 bg-(--bg-tertiary) hover:border-emerald-500/30'}`}
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-white/10">
                  <img src={photo.thumbUrl || photo.imageUrl} alt={photo.caption || photo.filename || 'photo'} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold theme-text">{photo.caption || photo.filename || 'Company image'}</p>
                  <p className="truncate text-xs muted">Image {index + 1}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={activeIndex}
        slides={slides}
      />
    </>
  )
}
