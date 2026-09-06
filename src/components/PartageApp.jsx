import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Check, Share2 } from 'lucide-react'

export default function PartageApp() {
  const canvasRef = useRef(null)
  const [lien, setLien] = useState('')
  const [copie, setCopie] = useState(false)

  useEffect(() => {
    // Lien de l'appli telle qu'elle est réellement déployée (s'adapte à l'adresse utilisée)
    const url = window.location.origin + window.location.pathname
    setLien(url)
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 220,
        margin: 1,
        color: { dark: '#1c2b21', light: '#ffffff' }
      })
    }
  }, [])

  function copierLien() {
    navigator.clipboard.writeText(lien).then(() => {
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    })
  }

  function partagerLien() {
    if (navigator.share) {
      navigator.share({ title: 'Course de Durée Pro', url: lien }).catch(() => {})
    } else {
      copierLien()
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      <h2 className="font-display text-2xl text-piste-900 mb-1">Partager l'application</h2>
      <p className="text-piste-600 text-sm mb-6">
        Fais scanner ce flashcode ou transmets le lien pour ouvrir l'application.
      </p>

      <div className="bg-white border-2 border-piste-100 rounded-2xl p-6 flex flex-col items-center gap-4">
        <canvas ref={canvasRef} className="rounded-xl" />

        <div className="w-full bg-piste-50 border border-piste-100 rounded-xl px-3 py-2.5 text-xs text-piste-700 break-all">
          {lien}
        </div>

        <div className="flex gap-2 w-full">
          <button
            onClick={copierLien}
            className="flex-1 flex items-center justify-center gap-1.5 bg-piste-100 hover:bg-piste-200 text-piste-800 font-medium py-2.5 rounded-xl transition active:scale-[0.98] text-sm"
          >
            {copie ? <Check size={16} /> : <Copy size={16} />}
            {copie ? 'Lien copié' : 'Copier le lien'}
          </button>
          <button
            onClick={partagerLien}
            className="flex-1 flex items-center justify-center gap-1.5 bg-piste-800 hover:bg-piste-700 text-white font-medium py-2.5 rounded-xl transition active:scale-[0.98] text-sm"
          >
            <Share2 size={16} />
            Partager
          </button>
        </div>
      </div>
    </div>
  )
}
