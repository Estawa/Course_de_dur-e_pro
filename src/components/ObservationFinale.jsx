import { useState } from 'react'

export default function ObservationFinale({ onValide }) {
  const [observation, setObservation] = useState('')

  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <h2 className="font-display text-2xl text-piste-900 mb-1 text-center">Un mot sur ta séance ?</h2>
      <p className="text-sm text-piste-600 mb-6 text-center">Observation générale, facultative.</p>

      <textarea
        value={observation}
        onChange={(e) => setObservation(e.target.value)}
        rows={5}
        className="w-full rounded-xl border border-piste-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500 mb-6"
        placeholder="Ex : conditions météo, forme du jour, ce que tu retiens..."
      />

      <button
        onClick={() => onValide(observation.trim())}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        Terminer la séance
      </button>
    </div>
  )
}
