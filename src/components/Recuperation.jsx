import { useEffect, useRef, useState } from 'react'
import { beepDepart, beepFin, annoncerVocal } from '../utils/audio'
import { formatDuree } from '../utils/calc'
import { useGpsSuivi } from '../utils/gps'
import { RECUPERATION_FIXE } from '../utils/phasesFixes'
import IndicateurGps from './IndicateurGps'

// Phase Récupération de fin de séance, structurée et identique pour toutes les séances du cycle
// par défaut. dureeS : durée dérivée du dernier bloc du niveau quand il a sa propre récupération
// Full Power active (voir utils/fullpower.js dureeRecuperationFinale), sinon repli sur la durée
// fixe par défaut de phasesFixes.js ; la distance minimale est recalculée proportionnellement
// pour garder un objectif d'allure cohérent.
// dejaEcouleS : temps (s) déjà passé avant l'arrivée sur cet écran (saisie pouls/distance/Borg
// juste après la dernière répétition de travail, voir SaisieFinTravail) — le décompte en tient
// compte dès le départ, pour que cette saisie fasse partie intégrante de la récupération plutôt
// que de s'y ajouter (une seule phase continue, sans temps de récup fantôme en double).
// Peut être passée (temps de séance insuffisant) via onPasser : le parent (SeanceRunner) garde
// alors la possibilité de revenir en arrière tant que le bilan final n'est pas validé, en cas
// d'erreur de manipulation. "Terminer la récupération" demande une confirmation (un premier appui
// affiche le bouton de confirmation, qui disparaît de lui-même après 3s s'il n'est pas validé),
// pour éviter qu'un appui accidentel ne coupe la récupération avant l'heure.
export default function Recuperation({ onTermine, onPasser, dejaEcouleS = 0, dureeS }) {
  const { pctVmaMin, distanceMinM: distanceMinMFixe, duree_s: dureeSFixe, retourAuCalme } = RECUPERATION_FIXE
  const duree_s = dureeS > 0 ? dureeS : dureeSFixe
  const distanceMinM = Math.round(distanceMinMFixe * (duree_s / dureeSFixe))
  const [elapsed, setElapsed] = useState(Math.min(dejaEcouleS, duree_s))
  const [distanceManuelle, setDistanceManuelle] = useState('')
  const [confirmationTerminer, setConfirmationTerminer] = useState(false)
  const startRef = useRef(null)
  const intervalRef = useRef(null)
  const termineRef = useRef(false)
  const confirmationTimeoutRef = useRef(null)
  const { gpsOk, distanceTotale } = useGpsSuivi()

  useEffect(() => {
    beepDepart()
    annoncerVocal('Récupération Fin de séance !')
    startRef.current = Date.now() - dejaEcouleS * 1000
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
      viaGPS,
      sautee: false
    }
  }

  function terminerAuto() {
    onTermine(construireResultat(duree_s, gpsOk === true ? distanceTotale : distanceMinM, gpsOk === true))
  }

  function terminerMaintenant() {
    if (termineRef.current) return
    termineRef.current = true
    clearTimeout(confirmationTimeoutRef.current)
    clearInterval(intervalRef.current)
    if (gpsOk === true) {
      onTermine(construireResultat(elapsed, distanceTotale, true))
    } else {
      const d = Number(distanceManuelle) || 0
      onTermine(construireResultat(elapsed, d, false))
    }
  }

  function demanderConfirmationTerminer() {
    setConfirmationTerminer(true)
    clearTimeout(confirmationTimeoutRef.current)
    confirmationTimeoutRef.current = setTimeout(() => setConfirmationTerminer(false), 3000)
  }

  function annulerConfirmationTerminer() {
    clearTimeout(confirmationTimeoutRef.current)
    setConfirmationTerminer(false)
  }

  useEffect(() => () => clearTimeout(confirmationTimeoutRef.current), [])

  function passer() {
    if (termineRef.current) return
    termineRef.current = true
    clearInterval(intervalRef.current)
    onPasser()
  }

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">Récupération</p>
      <h2 className="font-display text-2xl text-piste-900 mb-4">Récupération Fin de séance</h2>

      <div className="font-display text-6xl text-piste-900 mb-3 tabular-nums">-{formatDuree(Math.max(0, duree_s - elapsed))}</div>

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

      <p className="text-xs text-piste-500 mb-6">{retourAuCalme}</p>

      {confirmationTerminer ? (
        <div className="rounded-xl border-2 border-alerte/40 bg-[#fbeeea] p-4 mb-3">
          <p className="text-xs text-piste-700 mb-3">Confirme pour terminer la récupération maintenant</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={terminerMaintenant} className="bg-alerte text-white px-5 py-3 rounded-xl font-medium">
              Confirmer
            </button>
            <button onClick={annulerConfirmationTerminer} className="text-xs text-piste-500 underline px-2">Annuler</button>
          </div>
        </div>
      ) : (
        <button
          onClick={demanderConfirmationTerminer}
          className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3 rounded-xl transition active:scale-[0.98] mb-3"
        >
          Terminer la récupération
        </button>
      )}
      <button onClick={passer} className="text-xs text-piste-400 underline">
        Passer la récupération (temps insuffisant)
      </button>
    </div>
  )
}
