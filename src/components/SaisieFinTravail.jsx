import { useEffect, useRef, useState } from 'react'
import { formatDuree } from '../utils/calc'
import { NIVEAUX_BORG } from '../utils/borg'
import PriseDePouls from './PriseDePouls'

const DUREE_FENETRE_S = 2 * 60 + 30

// Tout ce que l'élève doit faire immédiatement après sa dernière répétition de travail : pouls,
// puis (distance/temps déjà mesurés automatiquement, affichés pour mémoire) observation libre et
// échelle de Borg. Un décompte de 2min30 reste affiché en continu pendant toute la séquence — il
// est indicatif (rien ne bloque si l'élève dépasse), pour donner un repère de temps pendant que la
// récupération de fin de séance a déjà commencé à courir en arrière-plan (voir SeanceRunner).
export default function SaisieFinTravail({ distanceRealisee, dureeRealisee, binomeNom, onValide }) {
  const [etape, setEtape] = useState('pouls') // 'pouls' | 'recap'
  const [pouls, setPouls] = useState(null)
  const [poulsBinome, setPoulsBinome] = useState(null)
  const [observation, setObservation] = useState('')
  const [borg, setBorg] = useState(null)
  const [restant, setRestant] = useState(DUREE_FENETRE_S)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const iv = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000
      setRestant(Math.max(0, DUREE_FENETRE_S - t))
    }, 250)
    return () => clearInterval(iv)
  }, [])

  function handlePouls(valeur, valeurBinome) {
    setPouls(valeur)
    setPoulsBinome(valeurBinome ?? null)
    setEtape('recap')
  }

  function valider() {
    const dureeEcouleeS = (Date.now() - startRef.current) / 1000
    onValide({ pouls, poulsBinome, observation, borg, dureeEcouleeS })
  }

  return (
    <div className="max-w-md mx-auto px-6 py-6">
      <div className="sticky top-0 bg-white/95 backdrop-blur pt-2 pb-3 mb-3 text-center z-10">
        <p className="text-[11px] uppercase tracking-wide text-piste-500 mb-0.5">Fin du travail — à remplir maintenant</p>
        <p className="font-display text-2xl text-piste-900 tabular-nums">-{formatDuree(restant)}</p>
      </div>

      {etape === 'pouls' && (
        <PriseDePouls
          titre="Pouls immédiat après l'effort"
          binomeNom={binomeNom}
          onValide={handlePouls}
        />
      )}

      {etape === 'recap' && (
        <div>
          <div className="bg-piste-50 rounded-xl px-4 py-3 mb-4 text-left">
            <p className="text-xs text-piste-500">Distance réalisée</p>
            <p className="text-sm font-medium text-piste-900 mb-2">{distanceRealisee} m</p>
            <p className="text-xs text-piste-500">Temps de travail réalisé</p>
            <p className="text-sm font-medium text-piste-900 mb-2">{formatDuree(dureeRealisee)}</p>
            <p className="text-xs text-piste-500">Pouls immédiat</p>
            <p className="text-sm font-medium text-piste-900">{pouls} bpm/min{binomeNom ? ` · ${binomeNom} : ${poulsBinome} bpm/min` : ''}</p>
          </div>

          <label className="block text-[11px] font-semibold text-piste-500 uppercase tracking-wide mb-1.5">
            Observation (facultatif)
          </label>
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-piste-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500 mb-5"
            placeholder="Ex : conditions, ressenti, gêne particulière..."
          />

          <p className="text-[11px] font-semibold text-piste-500 uppercase tracking-wide mb-1.5">
            Échelle de Borg — ton ressenti sur ce travail
          </p>
          <div className="space-y-1.5 mb-6">
            {NIVEAUX_BORG.map((n) => (
              <button
                key={n.valeur}
                onClick={() => setBorg(n.valeur)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 border-2 transition ${borg === n.valeur ? 'border-piste-800' : 'border-transparent'}`}
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
            disabled={borg === null}
            onClick={valider}
            className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
          >
            Valider et continuer vers la récupération
          </button>
        </div>
      )}
    </div>
  )
}
