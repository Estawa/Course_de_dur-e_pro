import { useState } from 'react'
import { NIVEAUX_BORG } from '../utils/borg'

export default function BorgScale({ onValide }) {
  const [selection, setSelection] = useState(null)

  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <h2 className="font-display text-2xl text-piste-900 mb-1 text-center">Ton ressenti de séance</h2>
      <p className="text-sm text-piste-600 mb-6 text-center">Échelle de Borg — choisis le niveau d'effort ressenti.</p>

      <div className="space-y-1.5 mb-6">
        {NIVEAUX_BORG.map((n) => (
          <button
            key={n.valeur}
            onClick={() => setSelection(n.valeur)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 border-2 transition ${selection === n.valeur ? 'border-piste-800' : 'border-transparent'}`}
            style={{ backgroundColor: `${n.couleur}33` }}
          >
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
              style={{ backgroundColor: n.couleur }}
            >
              {n.valeur}
            </span>
            <span className="text-sm text-piste-800 text-left">{n.label}</span>
          </button>
        ))}
      </div>

      <button
        disabled={selection === null}
        onClick={() => onValide(selection)}
        className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        Continuer
      </button>
    </div>
  )
}
