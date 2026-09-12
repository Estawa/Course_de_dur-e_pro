import { useEffect } from 'react'
import { Footprints } from 'lucide-react'
import pkg from '../../package.json'

// Écran vu très brièvement à l'ouverture de l'appli (juste l'icône), puis bascule
// automatiquement vers l'identification élève, sans aucune action requise.
export default function Demarrage({ onTermine }) {
  useEffect(() => {
    const t = setTimeout(onTermine, 700)
    return () => clearTimeout(t)
  }, [onTermine])

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-24 h-24 rounded-3xl bg-piste-800 flex items-center justify-center mb-6 shadow-lg">
        <Footprints className="text-piste-200" size={44} />
      </div>
      <h1 className="font-display text-2xl text-piste-900 mb-1">Course de Durée Pro</h1>
      <p className="text-xs text-piste-400">by C. Guilhem · v{pkg.version}</p>
    </div>
  )
}
