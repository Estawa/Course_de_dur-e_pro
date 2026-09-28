import { useCallback, useEffect, useState } from 'react'
import ArretProfAnnonce from './ArretProfAnnonce'
import { useArretProf } from '../utils/arretProf'
import { storage } from '../utils/storage'
import { ChevronRight } from 'lucide-react'
import TestDemiCooper from './TestDemiCooper'
import Test4x3 from './Test4x3'
import TestGacon from './TestGacon'
import TestVamEval from './TestVamEval'

const TESTS = [
  { id: 'cooper', titre: 'Demi-Cooper (6 min)', description: 'Distance maximale en 6 minutes' },
  { id: '4x3', titre: 'Test 4×3 minutes', description: '4 répétitions de 3 min avec récupération' },
  { id: 'gacon', titre: 'Test Gacon (45/15)', description: 'Paliers progressifs de 45 secondes' },
  { id: 'vameval', titre: 'VAM-EVAL', description: 'Paliers continus de 1 min vérifiés par GPS, départ 7 km/h, +0,5 km/h' }
]

// Sessions de reprise propres à chaque test (voir TYPE_SESSION dans chaque composant de test).
const SESSIONS_TESTS = { cooper: 'test-cooper', '4x3': 'test-4x3', gacon: 'test-gacon', vameval: 'test-vameval' }

// Arrêt par le professeur pendant un test : le test est ANNULÉ (aucune VMA enregistrée) — une
// VMA calculée sur un test incomplet ne serait pas fiable. Chaque test n'enregistre son résultat
// qu'une fois obtenu : démonter le test en cours suffit donc à ne rien enregistrer.
export default function VmaTests({ eleve, onActiviteEnCours }) {
  const [testActif, setTestActif] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const [debutTs, setDebutTs] = useState(null)
  const [testAnnule, setTestAnnule] = useState(null) // { arret, titre }

  const signalerActivite = useCallback((actif) => {
    setEnCours(!!actif)
    onActiviteEnCours?.(actif)
  }, [onActiviteEnCours])

  useEffect(() => {
    if (enCours && !debutTs) setDebutTs(Date.now())
    if (!testActif) setDebutTs(null)
  }, [enCours, testActif, debutTs])

  const titreTest = TESTS.find((t) => t.id === testActif)?.titre || 'Test VMA'
  const arret = useArretProf({
    eleve,
    actif: !!testActif && enCours && !!debutTs,
    debutTs,
    infos: { type: 'test', titre: titreTest, niveauNom: '' }
  })

  useEffect(() => {
    if (!arret || !testActif || !enCours) return
    if (SESSIONS_TESTS[testActif]) storage.effacerSessionCours(eleve, SESSIONS_TESTS[testActif])
    setTestAnnule({ arret, titre: titreTest })
    setTestActif(null)
    signalerActivite(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arret])

  if (testAnnule) {
    return (
      <ArretProfAnnonce
        arret={testAnnule.arret}
        message={`${testAnnule.titre} annulé : aucun résultat n'est enregistré, ta VMA ne change pas. Tu repasseras le test plus tard.`}
        libelleBouton="Retour aux tests"
        onContinuer={() => setTestAnnule(null)}
      />
    )
  }

  if (testActif === 'cooper') return <TestDemiCooper eleve={eleve} onRetour={() => setTestActif(null)} onActiviteEnCours={signalerActivite} />
  if (testActif === '4x3') return <Test4x3 eleve={eleve} onRetour={() => setTestActif(null)} onActiviteEnCours={signalerActivite} />
  if (testActif === 'gacon') return <TestGacon eleve={eleve} onRetour={() => setTestActif(null)} onActiviteEnCours={signalerActivite} />
  if (testActif === 'vameval') return <TestVamEval eleve={eleve} onRetour={() => setTestActif(null)} onActiviteEnCours={signalerActivite} />

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
