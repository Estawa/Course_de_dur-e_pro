import { useState } from 'react'
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react'

const CHOIX = [
  { valeur: 'reussi', label: 'Réussi', icone: CheckCircle2, couleur: 'border-piste-500 bg-piste-50 text-piste-800' },
  { valeur: 'partiel', label: 'Partiellement réussi', icone: MinusCircle, couleur: 'border-cendre bg-[#f7f2e8] text-piste-800' },
  { valeur: 'non_reussi', label: 'Non réussi', icone: XCircle, couleur: 'border-alerte/50 bg-[#fbeeea] text-piste-800' }
]

export default function BilanBloc({ labelBloc, onValide }) {
  const [choix, setChoix] = useState(null)
  const [note, setNote] = useState('')

  const besoinNote = choix === 'partiel' || choix === 'non_reussi'

  return (
    <div className="max-w-md mx-auto px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1 text-center">{labelBloc}</p>
      <h2 className="font-display text-2xl text-piste-900 mb-6 text-center">Comment s'est passé ce bloc ?</h2>

      <div className="space-y-3 mb-5">
        {CHOIX.map(({ valeur, label, icone: Icone, couleur }) => (
          <button
            key={valeur}
            onClick={() => setChoix(valeur)}
            className={`w-full flex items-center gap-3 border-2 rounded-xl px-4 py-3.5 transition ${choix === valeur ? couleur : 'border-piste-100 text-piste-700'}`}
          >
            <Icone size={20} className={choix === valeur ? '' : 'text-piste-300'} />
            <span className="font-medium text-sm">{label}</span>
          </button>
        ))}
      </div>

      {besoinNote && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-piste-800 mb-1.5">Explique ce qui s'est passé</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-piste-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
            placeholder="Ex : point de côté, allure trop rapide au départ..."
          />
        </div>
      )}

      <button
        disabled={!choix}
        onClick={() => onValide({ reussite: choix, note: besoinNote ? note.trim() : '' })}
        className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        Valider
      </button>
    </div>
  )
}
