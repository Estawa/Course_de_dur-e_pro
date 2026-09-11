import { useEffect, useRef, useState } from 'react'
import { MapPin, Pause, Play, AlertTriangle, Timer as TimerIcon, Square } from 'lucide-react'
import { useGpsSuivi } from '../utils/gps'
import { NIVEAUX_FARTLEK, TRANCHE_MALUS_S, distanceAttendueM, calculerNoteFartlek } from '../utils/fartlekCalc'
import { formatDuree } from '../utils/calc'
import { beep, beepDepart, beepFin, annoncerVocal } from '../utils/audio'
import BorgScale from './BorgScale'
import ObservationFinale from './ObservationFinale'
import { storage } from '../utils/storage'

function ChoixNiveauFartlek({ onChoisir }) {
  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <h2 className="font-display text-2xl text-piste-900 mb-1 text-center">Fartlek sur piste</h2>
      <p className="text-sm text-piste-600 mb-6 text-center">Choisis ton niveau.</p>
      <div className="space-y-3">
        {Object.entries(NIVEAUX_FARTLEK).map(([nom, cfg]) => (
          <button
            key={nom}
            onClick={() => onChoisir(nom)}
            className="w-full text-left bg-white border border-piste-100 rounded-2xl p-4 hover:border-piste-300 transition"
          >
            <p className="font-display text-lg text-piste-900">{nom}</p>
            <p className="text-xs text-piste-500 mt-0.5">
              Zones intenses {cfg.intenseM}m · récup {cfg.recupM}m · durée effective minimale {Math.round(cfg.dureeMinS / 60)} min
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function ApercuFartlek({ niveauNom, onDemarrer }) {
  const cfg = NIVEAUX_FARTLEK[niveauNom]
  return (
    <div className="max-w-md mx-auto px-6 py-6">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1 text-center">Fartlek sur piste</p>
      <h2 className="font-display text-2xl text-piste-900 mb-4 text-center">{niveauNom}</h2>

      <div className="bg-piste-50 rounded-xl p-4 mb-3 space-y-1.5">
        <p className="text-sm text-piste-800">Tour de 400m : {cfg.intenseM}m intense / {cfg.recupM}m récup, ×2</p>
        <p className="text-sm text-piste-800">Durée de course effective minimale : {Math.round(cfg.dureeMinS / 60)} min</p>
      </div>

      <div className="flex items-start gap-2 bg-[#eef4f1] rounded-xl px-4 py-3 mb-6">
        <MapPin size={16} className="text-piste-600 shrink-0 mt-0.5" />
        <p className="text-sm text-piste-800">
          Une zone de repos de 20m se trouve au niveau de la ligne de départ/arrivée : tu peux t'y
          arrêter (signale-le avec le bouton dédié). Un arrêt ailleurs sur la piste reste possible
          mais compte contre toi.
        </p>
      </div>

      <button
        onClick={onDemarrer}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
      >
        C'est parti
      </button>
    </div>
  )
}

function CourseFartlek({ niveauNom, vmaRef, onTermine }) {
  const cfg = NIVEAUX_FARTLEK[niveauNom]
  const { gpsOk, distanceTotale, vitesseInstant } = useGpsSuivi()

  // 'normal' | 'pauseRepos' | 'arretHorsZone'
  const [etat, setEtat] = useState('normal')
  const [, forceRender] = useState(0)
  const startRef = useRef(Date.now())
  const pauseDebutRef = useRef(null)
  const totalPauseReposMsRef = useRef(0)
  const arretDebutRef = useRef(null)
  const trancheCompteeRef = useRef(0)
  const malusRef = useRef(0)
  const nbArretsReposRef = useRef(0)
  const nbArretsHorsZoneRef = useRef(0)
  // Ref toujours à jour de l'état, utilisable dans la closure figée de l'interval ci-dessous.
  const etatRef = useRef(etat)
  etatRef.current = etat

  useEffect(() => {
    beepDepart()
    annoncerVocal('Départ Fartlek !')
    const id = setInterval(() => {
      if (etatRef.current === 'arretHorsZone' && arretDebutRef.current) {
        const elapsed = (Date.now() - arretDebutRef.current) / 1000
        const tranche = Math.floor(elapsed / TRANCHE_MALUS_S)
        if (tranche > trancheCompteeRef.current) {
          malusRef.current += tranche - trancheCompteeRef.current
          trancheCompteeRef.current = tranche
          beep({ freq: 300, duration: 0.15, volume: 0.25 })
        }
      }
      forceRender((v) => v + 1)
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function effectifMsMaintenant() {
    const now = Date.now()
    const pauseEnCours = etat === 'pauseRepos' && pauseDebutRef.current ? now - pauseDebutRef.current : 0
    return now - startRef.current - totalPauseReposMsRef.current - pauseEnCours
  }

  function debuterPauseRepos() {
    if (etat !== 'normal') return
    pauseDebutRef.current = Date.now()
    nbArretsReposRef.current += 1
    setEtat('pauseRepos')
    beep({ freq: 500, duration: 0.12 })
  }

  function debuterArretHorsZone() {
    if (etat !== 'normal') return
    arretDebutRef.current = Date.now()
    trancheCompteeRef.current = 0
    malusRef.current += 1 // pénalité immédiate
    nbArretsHorsZoneRef.current += 1
    setEtat('arretHorsZone')
    beep({ freq: 250, duration: 0.15, volume: 0.3 })
  }

  function reprendre() {
    if (etat === 'pauseRepos' && pauseDebutRef.current) {
      totalPauseReposMsRef.current += Date.now() - pauseDebutRef.current
      pauseDebutRef.current = null
    }
    if (etat === 'arretHorsZone') {
      arretDebutRef.current = null
    }
    setEtat('normal')
    beep({ freq: 700, duration: 0.1 })
  }

  const effectifS = effectifMsMaintenant() / 1000
  const dureeAtteinte = effectifS >= cfg.dureeMinS
  const peutTerminer = dureeAtteinte && etat === 'normal'

  function terminer() {
    beepFin()
    const distReelle = Math.round(distanceTotale)
    const distAttendue = Math.round(distanceAttendueM(niveauNom, vmaRef, effectifS))
    onTermine({
      niveauNom,
      dureeEffectiveS: Math.round(effectifS),
      dureeMinS: cfg.dureeMinS,
      distanceReelleM: distReelle,
      distanceAttendueM: distAttendue,
      viaGps: gpsOk === true,
      nbArretsRepos: nbArretsReposRef.current,
      nbArretsHorsZone: nbArretsHorsZoneRef.current,
      malusTotal: malusRef.current
    })
  }

  return (
    <div className="max-w-md mx-auto px-6 py-6 text-center">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">{niveauNom} · Fartlek</p>

      <div className="font-display text-6xl text-piste-900 mb-1 tabular-nums">
        {formatDuree(Math.max(0, effectifS))}
      </div>
      <p className="text-xs text-piste-500 mb-6">
        course effective / {Math.round(cfg.dureeMinS / 60)} min mini
        {!gpsOk && <span className="text-alerte"> · GPS indisponible</span>}
      </p>

      {etat === 'pauseRepos' && (
        <div className="flex items-center justify-center gap-2 bg-[#eef4f1] rounded-xl px-4 py-3 mb-4 text-piste-800 text-sm">
          <Pause size={16} /> En pause zone repos — le chrono est arrêté
        </div>
      )}
      {etat === 'arretHorsZone' && (
        <div className="flex items-center justify-center gap-2 bg-[#fbeeea] rounded-xl px-4 py-3 mb-4 text-alerte text-sm">
          <AlertTriangle size={16} /> Arrêt hors zone — le chrono continue, ça compte contre toi
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-piste-50 rounded-xl px-3 py-3">
          <p className="text-[11px] text-piste-500 uppercase tracking-wide">Vitesse</p>
          <p className="font-display text-lg text-piste-900">{vitesseInstant.toFixed(1)} km/h</p>
        </div>
        <div className="bg-piste-50 rounded-xl px-3 py-3">
          <p className="text-[11px] text-piste-500 uppercase tracking-wide">Distance</p>
          <p className="font-display text-lg text-piste-900">{Math.round(distanceTotale)} m</p>
        </div>
      </div>

      {etat === 'normal' && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={debuterPauseRepos}
            className="flex items-center justify-center gap-1.5 border border-piste-200 text-piste-800 text-sm font-medium py-3 rounded-xl"
          >
            <Pause size={15} /> Pause zone repos
          </button>
          <button
            onClick={debuterArretHorsZone}
            className="flex items-center justify-center gap-1.5 border border-[#f0d3ca] text-alerte text-sm font-medium py-3 rounded-xl"
          >
            <AlertTriangle size={15} /> Arrêt hors zone
          </button>
        </div>
      )}
      {etat !== 'normal' && (
        <button
          onClick={reprendre}
          className="w-full flex items-center justify-center gap-1.5 bg-piste-800 hover:bg-piste-700 text-white text-sm font-medium py-3 rounded-xl mb-4"
        >
          <Play size={15} /> Reprendre la course
        </button>
      )}

      <button
        onClick={terminer}
        disabled={!peutTerminer}
        className="w-full flex items-center justify-center gap-1.5 border-2 border-piste-800 disabled:opacity-30 text-piste-800 text-sm font-medium py-3 rounded-xl"
      >
        <Square size={15} /> Terminer {!dureeAtteinte && `(encore ${formatDuree(cfg.dureeMinS - effectifS)})`}
      </button>
    </div>
  )
}

export default function FartlekEval({ eleve, vmaRef, onTermine }) {
  const [phase, setPhase] = useState('niveau')
  const [niveauNom, setNiveauNom] = useState(null)
  const [donneesCourse, setDonneesCourse] = useState(null)
  const [borg, setBorg] = useState(null)

  function handleFinCourse(donnees) {
    setDonneesCourse(donnees)
    setPhase('borg')
  }

  function handleValideBorg(valeurBorg) {
    setBorg(valeurBorg)
    setPhase('observation')
  }

  function handleValideObservation(observationGenerale) {
    const noteInfo = calculerNoteFartlek({
      niveauNom: donneesCourse.niveauNom,
      distanceReelleM: donneesCourse.distanceReelleM,
      distanceAttendueM: donneesCourse.distanceAttendueM,
      malusTotal: donneesCourse.malusTotal
    })
    storage.enregistrerResultatFartlek(eleve, { ...donneesCourse, ...noteInfo, borg, observationGenerale })
    setPhase('recap')
  }

  if (phase === 'niveau') {
    return <ChoixNiveauFartlek onChoisir={(n) => { setNiveauNom(n); setPhase('apercu') }} />
  }
  if (phase === 'apercu') {
    return <ApercuFartlek niveauNom={niveauNom} onDemarrer={() => setPhase('course')} />
  }
  if (phase === 'course') {
    return <CourseFartlek niveauNom={niveauNom} vmaRef={vmaRef} onTermine={handleFinCourse} />
  }
  if (phase === 'borg') {
    return <BorgScale onValide={handleValideBorg} />
  }
  if (phase === 'observation') {
    return <ObservationFinale onValide={handleValideObservation} />
  }
  if (phase === 'recap') {
    return (
      <div className="max-w-md mx-auto px-6 py-10 text-center">
        <TimerIcon size={32} className="mx-auto mb-3 text-piste-600" />
        <h2 className="font-display text-2xl text-piste-900 mb-2">Évaluation enregistrée</h2>
        <p className="text-sm text-piste-600 mb-1">
          Durée effective : {formatDuree(donneesCourse.dureeEffectiveS)} · Distance : {donneesCourse.distanceReelleM} m
        </p>
        <p className="text-sm text-piste-600 mb-8">
          Arrêts zone repos : {donneesCourse.nbArretsRepos} · Arrêts hors zone : {donneesCourse.nbArretsHorsZone}
        </p>
        <p className="text-xs text-piste-400 mb-8">La note sera communiquée par ton professeur.</p>
        <button
          onClick={onTermine}
          className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition"
        >
          Retour à l'accueil
        </button>
      </div>
    )
  }
  return null
}
