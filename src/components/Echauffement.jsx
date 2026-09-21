import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { beepDepart, beepFin, annoncerVocal } from '../utils/audio'
import { formatDuree } from '../utils/calc'
import { useGpsSuivi } from '../utils/gps'
import { ECHAUFFEMENT_FIXE } from '../utils/phasesFixes'
import IndicateurGps from './IndicateurGps'

// Phase Échauffement structurée et identique pour toutes les séances du cycle : temps/distance
// minimale annoncés, GPS actif (avec repli sur saisie manuelle s'il est indisponible), gammes de
// courses affichées comme rappel, et % de réussite (temps + distance) transmis au parent pour
// alimenter le bilan de fin de séance.
// dureeS : durée réglée pour ce niveau (utils/bareme n'y touche pas — c'est un réglage de séance,
// voir SeanceEditor "Échauffement"), remplace la durée fixe par défaut de phasesFixes.js. La
// distance minimale est recalculée proportionnellement, pour que l'objectif d'allure (%VMA min)
// reste cohérent quelle que soit la durée choisie.
export default function Echauffement({ onTermine, dureeS }) {
  const { pctVmaMin, distanceMinM: distanceMinMFixe, duree_s: dureeSFixe, gammes, gammesDistanceM, retourAuCalme } = ECHAUFFEMENT_FIXE
  const duree_s = dureeS > 0 ? dureeS : dureeSFixe
  const distanceMinM = Math.round(distanceMinMFixe * (duree_s / dureeSFixe))
  const [elapsed, setElapsed] = useState(0)
  const [gammesOuvertes, setGammesOuvertes] = useState(true)
  const [distanceManuelle, setDistanceManuelle] = useState('')
  const startRef = useRef(null)
  const intervalRef = useRef(null)
  const termineRef = useRef(false)
  const { gpsOk, distanceTotale } = useGpsSuivi()

  useEffect(() => {
    beepDepart()
    annoncerVocal('Départ échauffement !')
    startRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000
      if (t >= duree_s) {
        setElapsed(duree_s)
        if (!termineRef.current) {
          termineRef.current = true
          clearInterval(intervalRef.current)
          beepFin()
          terminerAuto()
        }
      } else {
        setElapsed(t)
      }
    }, 250)
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function construireResultat(dureeReelle, distanceFinale, viaGPS) {
    return {
      dureeRealisee_s: Math.round(dureeReelle),
      dureeCible_s: duree_s,
      distanceRealisee_m: Math.round(distanceFinale || 0),
      distanceCible_m: distanceMinM,
      pctTemps: Math.round(Math.min(100, (dureeReelle / duree_s) * 100)),
      pctDistance: Math.round(Math.min(100, ((distanceFinale || 0) / distanceMinM) * 100)),
      viaGPS
    }
  }

  function terminerAuto() {
    onTermine(construireResultat(duree_s, gpsOk === true ? distanceTotale : distanceMinM, gpsOk === true))
  }

  function passer() {
    if (termineRef.current) return
    termineRef.current = true
    clearInterval(intervalRef.current)
    if (gpsOk === true) {
      onTermine(construireResultat(elapsed, distanceTotale, true))
    } else {
      const d = Number(distanceManuelle) || 0
      onTermine(construireResultat(elapsed, d, false))
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">Échauffement</p>
      <h2 className="font-display text-2xl text-piste-900 mb-4">Départ Échauffement !</h2>

      <div className="font-display text-6xl text-piste-900 mb-3 tabular-nums">{formatDuree(Math.max(0, duree_s - elapsed))}</div>

      <div className="bg-piste-50 rounded-xl px-4 py-3 mb-4 text-left">
        <p className="text-sm text-piste-800">Temps de course prévu : <span className="font-medium">{formatDuree(duree_s)}</span> à minimum {pctVmaMin}% VMA</p>
        <p className="text-sm text-piste-800 mt-0.5">Distance minimale : <span className="font-medium">{distanceMinM} m</span></p>
      </div>

      <div className="mb-4 flex justify-center">
        <IndicateurGps gpsOk={gpsOk} className="" />
      </div>

      {gpsOk === true && (
        <p className="text-sm text-piste-600 mb-4">{Math.round(distanceTotale)} m parcourus</p>
      )}

      {gpsOk === false && (
        <div className="mb-4 text-left">
          <label className="block text-xs text-piste-600 mb-1">Distance parcourue estimée (m), à renseigner toi-même</label>
          <input
            type="number"
            inputMode="numeric"
            value={distanceManuelle}
            onChange={(e) => setDistanceManuelle(e.target.value)}
            placeholder={String(distanceMinM)}
            className="w-full rounded-lg border border-piste-200 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="text-left bg-white border border-piste-100 rounded-xl mb-6">
        <button
          onClick={() => setGammesOuvertes((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <span className="text-sm font-medium text-piste-900">Gammes sur {gammesDistanceM}m en footing continu</span>
          {gammesOuvertes ? <ChevronUp size={16} className="text-piste-400" /> : <ChevronDown size={16} className="text-piste-400" />}
        </button>
        {gammesOuvertes && (
          <ul className="px-4 pb-3 space-y-1">
            {gammes.map((g) => (
              <li key={g} className="text-xs text-piste-600">• {g}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-piste-500 px-4 pb-3 pt-1 border-t border-piste-100">{retourAuCalme}</p>
      </div>

      <button onClick={passer} className="text-xs text-piste-400 underline">Passer l'échauffement</button>
    </div>
  )
}
