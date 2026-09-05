import { useState } from 'react'
import { X } from 'lucide-react'

export default function VisibiliteClasses({ seance, classesDisponibles, onValider, onFermer }) {
  const initiale = Array.isArray(seance.classesVisibles)
    ? seance.classesVisibles
    : seance.visible
    ? classesDisponibles
    : []
  const [selection, setSelection] = useState(initiale)

  function toggle(c) {
    setSelection((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" onClick={onFermer}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg text-piste-900">Visible pour quelles classes ?</h3>
          <button onClick={onFermer} className="p-1.5 rounded-full hover:bg-piste-100">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-piste-600 mb-4">{seance.titre}</p>

        {classesDisponibles.length === 0 ? (
          <p className="text-sm text-piste-500 mb-5">Aucune classe pour l'instant.</p>
        ) : (
          <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
            {classesDisponibles.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-piste-800 bg-piste-50 rounded-lg px-3 py-2.5">
                <input type="checkbox" checked={selection.includes(c)} onChange={() => toggle(c)} className="w-4 h-4" />
                {c || '(sans nom)'}
              </label>
            ))}
          </div>
        )}

        <button
          onClick={() => onValider(selection)}
          className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3 rounded-xl transition"
        >
          Valider
        </button>
      </div>
    </div>
  )
}
