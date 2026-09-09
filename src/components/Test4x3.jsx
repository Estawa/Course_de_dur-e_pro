import { useEffect, useRef, useState } from 'react'
import { Play, Square, Check } from 'lucide-react'
import { beepDepart, beepFin, beep } from '../utils/audio'
import { formatDuree } from '../utils/calc'
import { storage } from '../utils/storage'
import { useGpsSuivi } from '../utils/gps'
import IndicateurGps from './IndicateurGps'

const DUREE_EFFORT = 3 * 60
const DUREE_RECUP = 4 * 60 + 30
const ESPACEMENT_PLOT = 50 // 1 plot tous les 50 m autour de la piste

// Pour un effort de 3 minutes pile, la vitesse (km/h) = distance(m) / 50.
// Avec un plot tous les 50 m, le nombre de plots parcourus est donc numériquement
// égal à la VMA du tour en km/h : pas de calcul à faire pour l'élève.
function correspondancePlots(distanceM) {
  if (!distanceM || distanceM <= 0) return null
  const valeur = Math.round((distanceM / ESPACEMENT_PLOT) * 100) / 100
  return { plots: valeur, vma: valeur }
}

function calculerVmaFinale(distances) {
  const vitesses = distances.map((d) => (d / 1000) / (DUREE_EFFORT / 3600))
  const moyenneToutes = vitesses.reduce((a, b) => a + b, 0) / vitesses.length
  const trie = [...vitesses].sort((a, b) => a - b)
  const trois = trie.slice(1)
  const moyenneTrois = trois.reduce((a, b) => a + b, 0) / trois.length
  const retenue = moyenneToutes < moyenneTrois - 0.5 ? moyenneTrois : moyenneToutes
  return Math.round(retenue * 10) / 10
}

function RecapDistances({ distances, viaGPS }) {
  const entrees = distances.map((d, i) => ({ i, d })).filter((x) => x.d !== null && x.d > 0)
  if (entrees.length === 0) return null
  return (
    <div className="bg-piste-50 border border-piste-100 rounded-2xl p-4 mt-4 text-left">
      <p className="text-[11px] font-semibold text-piste-700 uppercase tracking-wide mb-2">Récapitulatif</p>
      <ul className="space-y-1.5">
        {entrees.map(({ i, d }) => {
          const c = correspondancePlots(d)
          return (
            <li key={i} className="text-xs text-piste-700 flex items-center justify-between">
              <span>Répétition {i + 1}{viaGPS[i] ? ' · GPS' : ''}</span>
              <span className="font-medium">{d} m{c ? ` · ${c.vma} km/h` : ''}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function Test4x3({ eleve, onRetour }) {
  const [rep, setRep] = useState(0) // 0..3, répétition en cours ou juste terminée
  const [phase, setPhase] = useState('attente') // attente | effort | recup | saisie | resultat
  const [elapsed, setElapsed] = useState(0)
  const [distances, setDistances] = useState([null, null, null, null])
  const [validees, setValidees] = useState([false, false, false, false])
  const [viaGPS, setViaGPS] = useState([false, false, false, false])
  const [saisieKm, setSaisieKm] = useState('')
  const [saisieM, setSaisieM] = useState('')
  const [vmaFinale, setVmaFinale] = useState(null)
  const [enregistre, setEnregistre] = useState(false)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  // Suivi GPS continu dès l'ouverture de l'écran, jamais réinitialisé pendant tout le test : on
  // relève juste la distance totale au début et à la fin de chaque répétition pour en déduire,
  // par différence, la distance de cette répétition — aucun trou possible entre 2 répétitions.
  const { gpsOk, distanceTotale, vitesseInstant, checkpoint } = useGpsSuivi()
  const gpsOkRef = useRef(gpsOk)
  useEffect(() => { gpsOkRef.current = gpsOk }, [gpsOk])
  const departRepRef = useRef(0)

  const dureePhase = phase === 'effort' ? DUREE_EFFORT : DUREE_RECUP
  const distanceSaisie = (Number(saisieKm) || 0) * 1000 + (Number(saisieM) || 0)
  const correspondance = correspondancePlots(distanceSaisie)
  // Affichage live de la distance parcourue pendant la répétition en cours.
  const distanceRepEnCours = Math.max(0, distanceTotale - departRepRef.current)

  // Enregistre en direct, à chaque frappe, la distance de la répétition en cours dans le
  // tableau (jamais perdue même sans clic sur "Valider"), et redemande une validation
  // explicite si la valeur est retouchée après avoir déjà été validée. Utilisée seulement
  // en mode manuel (GPS indisponible pendant la répétition).
  function saisirDistance(km, m) {
    setSaisieKm(km)
    setSaisieM(m)
    const d = (Number(km) || 0) * 1000 + (Number(m) || 0)
    setDistances((prev) => { const c = [...prev]; c[rep] = d; return c })
    setValidees((prev) => { const c = [...prev]; c[rep] = false; return c })
  }

  function validerRep() {
    setValidees((prev) => { const c = [...prev]; c[rep] = true; return c })
  }

  useEffect(() => {
    if (phase !== 'effort' && phase !== 'recup') return
    intervalRef.current = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000
      if (t >= dureePhase) {
        clearInterval(intervalRef.current)
        if (phase === 'effort') {
          finirEffort()
        } else {
          // Fin de récupération : redémarre automatiquement la répétition suivante.
          beepDepart()
          setRep((r) => r + 1)
          setSaisieKm('')
          setSaisieM('')
          setPhase('effort')
          setElapsed(0)
          startRef.current = Date.now()
          departRepRef.current = checkpoint()
        }
      } else {
        setElapsed(t)
      }
    }, 200)
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function demarrerRep() {
    beepDepart()
    startRef.current = Date.now()
    setElapsed(0)
    setPhase('effort')
    departRepRef.current = checkpoint()
  }

  // Fin d'un effort (chrono écoulé ou arrêt manuel) : si le GPS était actif pendant la
  // répétition, la distance parcourue est mesurée automatiquement (différence de relevés,
  // même principe que le VAM-EVAL) et aucune saisie n'est demandée pour cette répétition.
  // Sinon, on retombe sur la saisie manuelle comme avant. La récupération démarre
  // automatiquement dans les deux cas (sauf pour la 4e répétition, où il faut le résultat de
  // la mesure/saisie pour conclure).
  function finirEffort() {
    beepFin()
    const viaGpsRep = gpsOkRef.current === true

    if (viaGpsRep) {
      const mesure = Math.round(checkpoint() - departRepRef.current)
      setDistances((prev) => { const c = [...prev]; c[rep] = mesure; return c })
      setValidees((prev) => { const c = [...prev]; c[rep] = true; return c })
      setViaGPS((prev) => { const c = [...prev]; c[rep] = true; return c })
      if (rep === 3) {
        finaliser(mesure, true)
        return
      }
    } else if (rep === 3) {
      setElapsed(dureePhase)
      setPhase('saisie')
      return
    }

    setPhase('recup')
    setElapsed(0)
    startRef.current = Date.now()
  }

  function arreterManuel() {
    beep({ freq: 400 })
    clearInterval(intervalRef.current)
    finirEffort()
  }

  function finaliser(distanceDerniereRep, gpsDerniereRep) {
    const toutesDistances = distances.map((d, i) => (i === rep ? distanceDerniereRep : d ?? 0))
    const toutesViaGPS = viaGPS.map((v, i) => (i === rep ? gpsDerniereRep : v))
    const finale = calculerVmaFinale(toutesDistances)
    setDistances(toutesDistances)
    setValidees((prev) => { const c = [...prev]; c[rep] = true; return c })
    setVmaFinale(finale)
    setPhase('resultat')
    storage.enregistrerResultatTest(eleve, finale, '4x3', { distances: toutesDistances, viaGPS: toutesViaGPS })
    setEnregistre(true)
  }

  function validerDistanceFinale() {
    finaliser(distanceSaisie, false)
  }

  if (phase === 'attente') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-piste-900 mb-2">Test 4×3 minutes</h2>
        <p className="text-sm text-piste-600 mb-3">4 répétitions de 3 min à allure maximale, séparées de 4min30 de récupération.</p>
        <p className="text-xs text-piste-500 mb-5">Si le GPS est actif, ta distance sera mesurée automatiquement à chaque répétition.</p>
        <IndicateurGps gpsOk={gpsOk} className="mb-8" />
        <button
          onClick={demarrerRep}
          className="w-24 h-24 mx-auto rounded-full bg-piste-800 hover:bg-piste-700 text-white flex items-center justify-center mb-6 active:scale-95 transition"
        >
          <Play size={32} fill="white" />
        </button>
        <button onClick={onRetour} className="text-xs text-piste-400 underline">Retour</button>
      </div>
    )
  }

  if (phase === 'effort') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">Répétition {rep + 1}/4</p>
        <p className="text-sm text-piste-600 mb-4">Effort maximal</p>
        <div className="font-display text-7xl text-piste-900 mb-6 tabular-nums">{formatDuree(dureePhase - elapsed)}</div>
        {gpsOk === true && (
          <div className="rounded-2xl border-2 border-piste-400 bg-piste-50 p-4 mb-6">
            <p className="font-display text-2xl text-piste-900 tabular-nums">{Math.round(distanceRepEnCours)} m</p>
            <p className="text-xs text-piste-600">{vitesseInstant.toFixed(1)} km/h · distance mesurée par GPS</p>
          </div>
        )}
        {gpsOk === false && (
          <p className="text-xs text-alerte mb-6">GPS indisponible : tu devras saisir ta distance à la fin de la répétition.</p>
        )}
        <button onClick={arreterManuel} className="flex items-center gap-2 mx-auto bg-alerte text-white px-5 py-3 rounded-xl">
          <Square size={16} fill="white" /> Arrêter l'effort
        </button>
      </div>
    )
  }

  // Récupération : le décompte tourne pendant que la distance de la répétition qui vient de se
  // terminer est soit déjà mesurée par GPS (affichage direct), soit à saisir à la main.
  if (phase === 'recup') {
    const gpsRep = viaGPS[rep]
    const corrGps = gpsRep ? correspondancePlots(distances[rep]) : null
    return (
      <div className="max-w-md mx-auto px-6 py-10 text-center">
        <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">Récupération</p>
        <p className="text-sm text-piste-600 mb-3">Avant la répétition {rep + 2}/4</p>
        <div className="font-display text-6xl text-piste-900 mb-6 tabular-nums">{formatDuree(dureePhase - elapsed)}</div>

        {gpsRep ? (
          <div className="bg-piste-50 border border-piste-100 rounded-2xl p-4">
            <p className="text-sm font-medium text-piste-900 mb-2">Distance de la répétition {rep + 1}</p>
            <p className="font-display text-2xl text-piste-900 tabular-nums mb-1">{distances[rep]} m</p>
            {corrGps && (
              <p className="text-xs text-piste-600 mb-3">≈ {corrGps.vma} km/h de VMA sur ce tour</p>
            )}
            <p className="text-xs text-piste-700 font-medium flex items-center justify-center gap-1.5 bg-white border border-piste-200 rounded-xl py-2">
              <Check size={14} /> Mesurée par GPS
            </p>
          </div>
        ) : (
          <div className="bg-piste-50 border border-piste-100 rounded-2xl p-4">
            <p className="text-sm font-medium text-piste-900 mb-3">Distance de la répétition {rep + 1}</p>
            <div className="flex items-center gap-2 justify-center mb-3">
              <input
                type="number"
                value={saisieKm}
                onChange={(e) => saisirDistance(e.target.value, saisieM)}
                placeholder="km"
                className="w-20 rounded-lg border border-piste-200 px-2 py-2 text-center"
              />
              <input
                type="number"
                value={saisieM}
                onChange={(e) => saisirDistance(saisieKm, e.target.value)}
                placeholder="m"
                className="w-20 rounded-lg border border-piste-200 px-2 py-2 text-center"
              />
            </div>
            {correspondance ? (
              <p className="text-xs text-piste-600 mb-3">
                ≈ {correspondance.plots} plot{correspondance.plots > 1 ? 's' : ''} (tous les {ESPACEMENT_PLOT} m) · soit {correspondance.vma} km/h de VMA sur ce tour
              </p>
            ) : (
              <p className="text-xs text-piste-400 mb-3">1 plot = {ESPACEMENT_PLOT} m — la correspondance en km/h s'affiche dès la saisie.</p>
            )}
            {validees[rep] ? (
              <p className="text-xs text-piste-700 font-medium flex items-center justify-center gap-1.5 bg-white border border-piste-200 rounded-xl py-2">
                <Check size={14} /> Distance prise en compte
              </p>
            ) : (
              <button
                onClick={validerRep}
                disabled={!distanceSaisie}
                className={`w-full py-2.5 rounded-xl font-medium text-sm transition ${distanceSaisie ? 'bg-piste-800 text-white' : 'bg-piste-100 text-piste-400'}`}
              >
                Valider cette distance
              </button>
            )}
          </div>
        )}

        <RecapDistances distances={distances} viaGPS={viaGPS} />

        <p className="text-[11px] text-piste-400 mt-4">La récupération et la répétition suivante démarrent automatiquement.</p>
      </div>
    )
  }

  if (phase === 'saisie') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-xl text-piste-900 mb-2">Distance parcourue — répétition {rep + 1}</h2>
        <p className="text-xs text-piste-500 mb-6">Dernière répétition, GPS indisponible : entre ta distance pour voir ton résultat.</p>
        <div className="flex items-center gap-2 justify-center mb-3">
          <input
            type="number"
            value={saisieKm}
            onChange={(e) => saisirDistance(e.target.value, saisieM)}
            placeholder="km"
            className="w-20 rounded-lg border border-piste-200 px-2 py-2 text-center"
          />
          <input
            type="number"
            value={saisieM}
            onChange={(e) => saisirDistance(saisieKm, e.target.value)}
            placeholder="m"
            className="w-20 rounded-lg border border-piste-200 px-2 py-2 text-center"
          />
        </div>
        {correspondance && (
          <p className="text-xs text-piste-600 mb-6">
            ≈ {correspondance.plots} plot{correspondance.plots > 1 ? 's' : ''} (tous les {ESPACEMENT_PLOT} m) · soit {correspondance.vma} km/h de VMA sur ce tour
          </p>
        )}
        <button
          onClick={validerDistanceFinale}
          disabled={!distanceSaisie}
          className={`w-full font-medium py-3 rounded-xl ${distanceSaisie ? 'bg-piste-800 text-white' : 'bg-piste-100 text-piste-400'}`}
        >
          Valider et voir le résultat
        </button>
        <RecapDistances distances={distances} viaGPS={viaGPS} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h2 className="font-display text-2xl text-piste-900 mb-2">VMA estimée</h2>
      <p className="font-display text-4xl text-piste-900 mb-6">{vmaFinale} km/h</p>
      {enregistre && <p className="text-sm text-piste-600 mb-3">Résultat transmis à ton professeur. Il sera pris en compte, sauf s'il a fixé une autre valeur.</p>}
      <RecapDistances distances={distances} viaGPS={viaGPS} />
      <button onClick={onRetour} className="text-xs text-piste-400 underline mt-4">Retour aux tests</button>
    </div>
  )
}
