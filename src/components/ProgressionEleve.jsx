import { TrendingUp, Star } from 'lucide-react'
import { tauxReussiteRealisation } from '../utils/calc'

const LARGEUR = 320
const HAUTEUR = 100
const MARGE = 14

// Courbe de tendance du taux de réussite par séance, volontairement sans aucune valeur ni note
// chiffrée affichée (voir décision : ne jamais laisser l'élève déduire une moyenne de cycle) —
// seule la forme de la courbe, la séance la plus réussie et une éventuelle série de progression
// sont montrées. SVG écrit à la main (pas de librairie de graphiques) pour rester cohérent avec
// le reste de l'appli, qui n'en embarque aucune.
export default function ProgressionEleve({ realisations }) {
  const serie = realisations
    .filter((r) => !r.exclureCycle)
    .slice()
    .sort((a, b) => a.date - b.date)
    .map((r) => tauxReussiteRealisation(r))
    .filter((v) => v != null)

  if (serie.length < 2) return null

  const min = Math.min(...serie)
  const max = Math.max(...serie)
  const etendue = max - min || 1
  const pasX = (LARGEUR - 2 * MARGE) / (serie.length - 1)

  const points = serie.map((v, i) => ({
    x: MARGE + i * pasX,
    y: HAUTEUR - MARGE - ((v - min) / etendue) * (HAUTEUR - 2 * MARGE)
  }))

  const chemin = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const aire = `${chemin} L${points[points.length - 1].x.toFixed(1)},${HAUTEUR - MARGE} L${points[0].x.toFixed(1)},${HAUTEUR - MARGE} Z`

  const indexMeilleure = serie.indexOf(max)

  // Série de progression en cours : nombre de séances consécutives (en partant de la fin) où le
  // taux de réussite a augmenté par rapport à la précédente.
  let streak = 0
  for (let i = serie.length - 1; i > 0; i--) {
    if (serie[i] > serie[i - 1]) streak++
    else break
  }

  return (
    <div className="mb-6">
      {streak >= 2 && (
        <div className="inline-flex items-center gap-1.5 bg-piste-50 rounded-full px-3 py-1 mb-3">
          <TrendingUp size={14} className="text-piste-600" />
          <span className="text-xs text-piste-700">{streak} séances d'affilée en progression</span>
        </div>
      )}
      <p className="text-[11px] text-piste-500 mb-1">Ta tendance</p>
      <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} className="w-full" role="img" aria-label="Courbe de tendance de tes séances, sans valeur chiffrée">
        <path d={aire} fill="rgba(31,77,64,0.08)" stroke="none" />
        <path d={chemin} fill="none" stroke="#1f4d40" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) =>
          i === indexMeilleure ? (
            <circle key={i} cx={p.x} cy={p.y} r={5} fill="#1f4d40" stroke="white" strokeWidth={2} />
          ) : null
        )}
      </svg>
      <div className="flex justify-between mt-1">
        {serie.map((_, i) => (
          <span key={i} className="text-[10px] text-piste-400">S{i + 1}</span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-piste-100">
        <Star size={13} className="text-piste-500" />
        <span className="text-xs text-piste-600">Meilleure séance : S{indexMeilleure + 1}</span>
      </div>
    </div>
  )
}
