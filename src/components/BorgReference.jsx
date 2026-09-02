import { NIVEAUX_BORG } from '../utils/borg'

export default function BorgReference() {
  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <h2 className="font-display text-2xl text-piste-900 mb-1 text-center">Échelle de Borg</h2>
      <p className="text-sm text-piste-600 mb-6 text-center">Repère ton niveau d'effort ressenti pendant l'effort.</p>

      <div className="space-y-1.5">
        {NIVEAUX_BORG.map((n) => (
          <div key={n.valeur} className="w-full flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: `${n.couleur}33` }}>
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
              style={{ backgroundColor: n.couleur }}
            >
              {n.valeur}
            </span>
            <span className="text-sm text-piste-800">{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
