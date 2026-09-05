import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { beepDepart, beepFin, beep } from '../utils/audio'
import { formatDuree } from '../utils/calc'
import { storage } from '../utils/storage'

const DUREE_EFFORT = 3 * 60
const DUREE_RECUP = 4 * 60 + 30

function calculerVmaFinale(distances) {
  const vitesses = distances.map((d) => (d / 1000) / (DUREE_EFFORT / 3600))
  const moyenneToutes = vitesses.reduce((a, b) => a + b, 0) / vitesses.length
  const trie = [...vitesses].sort((a, b) => a - b)
  const trois = trie.slice(1)
  const moyenneTrois = trois.reduce((a, b) => a + b, 0) / trois.length
  const retenue = moyenneToutes < moyenneTrois - 0.5 ? moyenneTrois : moyenneToutes
  return Math.round(retenue * 10) / 10
}

export default function Test4x3({ eleve, onRetour }) {
  const [rep, setRep] = useState(0) // 0..3
  const [phase, setPhase] = useState('attente') // attente | effort | recup | saisie | resultat
  const [elapsed, setElapsed] = useState(0)
  const [distances, setDistances] = useState([])
  const [saisieKm, setSaisieKm] = useState('')
  const [saisieM, setSaisieM] = useState('')
  const [vmaFinale, setVmaFinale] = useState(null)
  const [enregistre, setEnregistre] = useState(false)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  const dureePhase = phase === 'effort' ? DUREE_EFFORT : DUREE_RECUP

  useEffect(() => {
    if (phase !== 'effort' && phase !== 'recup') return
    intervalRef.current = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000
      if (t >= dureePhase) {
        clearInterval(intervalRef.current)
        if (phase === 'effort') {
          beepFin()
          setElapsed(dureePhase)
          setPhase('saisie')
        } else {
          beepDepart()
          setPhase('effort')
          setElapsed(0)
          startRef.current = Date.now()
        }
      } else {
        setElapsed(t)
      }
    }, 200)
    return () => clearInterval(intervalRef.current)
  }, [phase])

  function demarrerRep() {
    beepDepart()
    startRef.current = Date.now()
    setElapsed(0)
    setPhase('effort')
  }

  function arreterManuel() {
    beep({ freq: 400 })
    clearInterval(intervalRef.current)
    setPhase('saisie')
  }

  function validerDistance() {
    const distance = (Number(saisieKm) || 0) * 1000 + (Number(saisieM) || 0)
    const nouvelles = [...distances, distance]
    setDistances(nouvelles)
    setSaisieKm('')
    setSaisieM('')

    if (rep === 3) {
      setVmaFinale(calculerVmaFinale(nouvelles))
      setPhase('resultat')
    } else {
      setRep((r) => r + 1)
      startRef.current = Date.now()
      setElapsed(0)
      setPhase('recup')
    }
  }

  function enregistrerVma() {
    storage.enregistrerResultatTest(eleve, vmaFinale, '4x3')
    setEnregistre(true)
  }

  if (phase === 'attente') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-piste-900 mb-2">Test 4×3 minutes</h2>
        <p className="text-sm text-piste-600 mb-8">4 répétitions de 3 min à allure maximale, séparées de 4min30 de récupération.</p>
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

  if (phase === 'effort' || phase === 'recup') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">Répétition {rep + 1}/4</p>
        <p className="text-sm text-piste-600 mb-4">{phase === 'effort' ? 'Effort maximal' : 'Récupération'}</p>
        <div className="font-display text-7xl text-piste-900 mb-8 tabular-nums">{formatDuree(dureePhase - elapsed)}</div>
        {phase === 'effort' && (
          <button onClick={arreterManuel} className="flex items-center gap-2 mx-auto bg-alerte text-white px-5 py-3 rounded-xl">
            <Square size={16} fill="white" /> Arrêter l'effort
          </button>
        )}
      </div>
    )
  }

  if (phase === 'saisie') {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-xl text-piste-900 mb-6">Distance parcourue — répétition {rep + 1}</h2>
        <div className="flex items-center gap-2 justify-center mb-6">
          <input type="number" value={saisieKm} onChange={(e) => setSaisieKm(e.target.value)} placeholder="km" className="w-20 rounded-lg border border-piste-200 px-2 py-2 text-center" />
          <input type="number" value={saisieM} onChange={(e) => setSaisieM(e.target.value)} placeholder="m" className="w-20 rounded-lg border border-piste-200 px-2 py-2 text-center" />
        </div>
        <button onClick={validerDistance} className="w-full bg-piste-800 text-white font-medium py-3 rounded-xl">Valider</button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h2 className="font-display text-2xl text-piste-900 mb-2">VMA estimée</h2>
      <p className="font-display text-4xl text-piste-900 mb-6">{vmaFinale} km/h</p>
      {enregistre ? (
        <p className="text-sm text-piste-600 mb-3">Résultat transmis. Il sera pris en compte, sauf si ton professeur a fixé une autre valeur.</p>
      ) : (
        <button onClick={enregistrerVma} className="w-full bg-piste-800 text-white font-medium py-3 rounded-xl mb-3">Enregistrer ce résultat</button>
      )}
      <button onClick={onRetour} className="text-xs text-piste-400 underline">Retour aux tests</button>
    </div>
  )
}
