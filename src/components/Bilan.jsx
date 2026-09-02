import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react'

const STYLE_REUSSITE = {
  reussi: { icone: CheckCircle2, couleur: 'text-piste-600', label: 'Réussi' },
  partiel: { icone: MinusCircle, couleur: 'text-cendre', label: 'Partiellement réussi' },
  non_reussi: { icone: XCircle, couleur: 'text-alerte', label: 'Non réussi' }
}

export default function Bilan({ resultat, niveau, onRetourAccueil }) {
  const { blocsResultats, borg, observationGenerale, note } = resultat

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 ${note >= 18 ? 'bg-piste-100' : note >= 12 ? 'bg-[#f7f2e8]' : 'bg-[#fbeeea]'}`}>
        <span className="font-display text-3xl text-piste-900">{note}/20</span>
      </div>

      <h2 className="font-display text-2xl text-piste-900 mb-1">Séance terminée</h2>
      <p className="text-sm text-piste-600 mb-8">{niveau.nom} · {blocsResultats.length} bloc{blocsResultats.length > 1 ? 's' : ''}</p>

      <div className="space-y-3 text-left mb-6">
        {blocsResultats.map((b, i) => {
          const { icone: Icone, couleur, label } = STYLE_REUSSITE[b.reussite]
          return (
            <div key={b.blocId} className="bg-piste-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <Icone className={`${couleur} shrink-0`} size={20} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-piste-900">Bloc {i + 1} · {label}</p>
                  {b.note && <p className="text-xs text-piste-500 mt-0.5">{b.note}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-piste-50 rounded-xl px-4 py-3 text-left mb-2">
        <p className="text-sm font-medium text-piste-900">Ressenti (Borg) : {borg}/10</p>
      </div>
      {observationGenerale && (
        <div className="bg-piste-50 rounded-xl px-4 py-3 text-left mb-8">
          <p className="text-xs text-piste-600">{observationGenerale}</p>
        </div>
      )}

      <button
        onClick={onRetourAccueil}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98] mt-2"
      >
        Retour à l'accueil
      </button>
    </div>
  )
}
