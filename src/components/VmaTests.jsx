import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import TestDemiCooper from './TestDemiCooper'
import Test4x3 from './Test4x3'
import TestGacon from './TestGacon'

const TESTS = [
  { id: 'cooper', titre: 'Demi-Cooper (6 min)', description: 'Distance maximale en 6 minutes' },
  { id: '4x3', titre: 'Test 4×3 minutes', description: '4 répétitions de 3 min avec récupération' },
  { id: 'gacon', titre: 'Test Gacon (45/15)', description: 'Paliers progressifs de 45 secondes' }
]

export default function VmaTests({ eleve }) {
  const [testActif, setTestActif] = useState(null)

  if (testActif === 'cooper') return <TestDemiCooper eleve={eleve} onRetour={() => setTestActif(null)} />
  if (testActif === '4x3') return <Test4x3 eleve={eleve} onRetour={() => setTestActif(null)} />
  if (testActif === 'gacon') return <TestGacon eleve={eleve} onRetour={() => setTestActif(null)} />

  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <h2 className="font-display text-2xl text-piste-900 mb-1 text-center">Tests de VMA</h2>
      <p className="text-sm text-piste-600 mb-6 text-center">Choisis le protocole à réaliser.</p>

      <div className="space-y-3">
        {TESTS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTestActif(t.id)}
            className="w-full flex items-center justify-between bg-white border border-piste-100 rounded-xl px-4 py-3.5 hover:border-piste-300 transition"
          >
            <div className="text-left">
              <p className="text-sm font-medium text-piste-900">{t.titre}</p>
              <p className="text-xs text-piste-500">{t.description}</p>
            </div>
            <ChevronRight size={16} className="text-piste-400 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
