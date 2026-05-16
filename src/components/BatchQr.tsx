import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

type BatchQrProps = {
  value: string
  size?: number
  fgColor?: string
  bgColor?: string
}

export default function BatchQr({
  value,
  size = 168,
  fgColor,
  bgColor,
}: BatchQrProps) {
  const [svg, setSvg] = useState('')
  const { isDark } = useTheme()

  // Default colors if not provided, adjusted for theme
  const finalFg = fgColor || (isDark ? '#f8fafc' : '#020617')
  const finalBg = bgColor || (isDark ? '#0b1121' : '#ffffff')

  useEffect(() => {
    let alive = true

    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      width: size,
      errorCorrectionLevel: 'M',
      color: {
        dark: finalFg,
        light: finalBg,
      },
    })
      .then((markup) => {
        if (alive) {
          setSvg(markup)
        }
      })
      .catch(() => {
        if (alive) {
          setSvg('')
        }
      })

    return () => {
      alive = false
    }
  }, [finalBg, finalFg, size, value])

  return (
    <div className="flex items-center justify-center">
      {svg ? (
        <div 
          style={{ width: size, height: size }} 
          dangerouslySetInnerHTML={{ __html: svg }} 
        />
      ) : (
        <div 
          style={{ width: size, height: size }} 
          className="flex items-center justify-center rounded-[1.2rem] muted text-xs font-medium bg-slate-100 dark:bg-white/5"
        >
          Generating QR
        </div>
      )}
    </div>
  )
}

export function BatchQrDownloadButton({ value, batchId }: { value: string; batchId: string }) {
  const handleDownload = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(value, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'H',
      })
      
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `QR-${batchId}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Failed to generate QR for download', err)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="btn btn-emerald inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium"
    >
      <Download size={16} />
      Download QR
    </button>
  )
}