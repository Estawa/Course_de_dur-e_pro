import { useEffect, useRef, useState } from 'react'
import { MapPin, Pause, Play, AlertTriangle, Timer as TimerIcon, Square, Plus, Minus, Volume2 } from 'lucide-react'
import { useGpsSuivi } from '../utils/gps'
import { NIVEAUX_FARTLEK, TRANCHE_MALUS_S, distanceAttendueM, calculerNoteFartlek, distanceTheoriqueFartlek, zoneA } from '../utils/fartlekCalc'
import { formatKmM, resoudreDistance, temps50mS } from '../utils/guidage'
import SaisieDistance from './SaisieDistance'
import { formatDuree } from '../utils/calc'
import { libelleNiveau } from '../utils/niveauLabels'
import { beep, beepDepart, beepFin, annoncerVocal, bipPlot, bipLigne, gongTransition } from '../utils/audio'
import BorgScale from './BorgScale'
import ObservationFinale from './ObservationFinale'
import { storage } from '../utils/storage'
import { useWakeLock } from '../utils/wakeLock'
import ReprisePrompt from './ReprisePrompt'

const TYPE_SESSION = 'fartlek'

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
              Zones intenses à {cfg.pctIntense}% VMA · récup à {cfg.pctRecup}% VMA · durée effective minimale {Math.round(cfg.dureeMinS / 60)} min
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
      <h2 className="font-display text-2xl text-piste-900 mb-4 text-center">{libelleNiveau(niveauNom)}</h2>

      <div className="bg-piste-50 rounded-xl p-4 mb-3 space-y-1.5">
        <p className="text-sm text-piste-800">Tour de 400m : {cfg.intenseM}m intense / {cfg.recupM}m récup, ×2 (en partant de la ligne)</p>
        <p className="text-sm text-piste-800">Allures : {cfg.pctIntense}% VMA en zone intense, {cfg.pctRecup}% VMA en récup</p>
        <p className="text-sm text-piste-800">Un bip à chaque plot, au rythme de la zone ; double bip sur la ligne, gong aux changements de zone</p>
        <p className="text-sm text-piste-800">Durée de course effective minimale : {Math.round(cfg.dureeMinS / 60)} min</p>
      </div>

      <div className="flex items-start gap-2 bg-[#eef4f1] rounded-xl px-4 py-3 mb-6">
        <MapPin size={16} className="text-piste-600 shrink-0 mt-0.5" />
        <p className="text-sm text-piste-800">
          Une zone de repos de 20m se trouve au niveau de la ligne de départ/arrivée : tu peux t'y
          arrêter (signale-le avec le bouton dédié). Un arrêt ailleurs sur la piste reste possible
          mais compte contre toi. Après une pause, repars de la ligne : les bips reprennent au début du tour.
          À la fin, tu calcules et saisis toi-même ta distance totale.
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

// reprise : snapshot sauvegardé si la course avait été interrompue (fermeture/mise en veille de
// l'appli). En cas de reprise, on relance toujours en pause zone repos (quel que soit l'état au
// moment de la coupure) : la durée de la coupure est ainsi comptée comme du temps de pause dès
// que l'élève tape "Reprendre la course", sans jamais être comptabilisée comme temps de course
// effectif ni continuer à accumuler un malus d'arrêt hors zone pendant que le téléphone était éteint.
function CourseFartlek({ niveauNom, vmaRef, reprise, onProgress, onTermine }) {
  const cfg = NIVEAUX_FARTLEK[niveauNom]
  // En cas de reprise, on réamorce le compteur GPS avec la distance déjà parcourue avant la
  // coupure (sauvegardée en continu, voir snapshot()) au lieu de repartir de 0 — sinon toute la
  // distance courue avant la fermeture de l'appli disparaissait du calcul de la note finale.
  const { gpsOk, distanceTotale, vitesseInstant } = useGpsSuivi(reprise?.distanceTotaleSauvegardee || 0)
  const distanceTotaleRef = useRef(reprise?.distanceTotaleSauvegardee || 0)
  useEffect(() => { distanceTotaleRef.current = distanceTotale }, [distanceTotale])

  // 'normal' | 'pauseRepos' | 'arretHorsZone'
  const [etat, setEtat] = useState(reprise ? 'pauseRepos' : 'normal')
  const [, forceRender] = useState(0)
  const [confirmationTerminer, setConfirmationTerminer] = useState(false)
  const confirmationTimeoutRef = useRef(null)
  const startRef = useRef(reprise ? reprise.startTs : Date.now())
  const pauseDebutRef = useRef(reprise ? Date.now() : null)
  const totalPauseReposMsRef = useRef(reprise ? reprise.totalPauseReposMs : 0)
  const arretDebutRef = useRef(null)
  const trancheCompteeRef = useRef(0)
  const malusRef = useRef(reprise ? reprise.malus : 0)
  const nbArretsReposRef = useRef(reprise ? reprise.nbArretsRepos : 0)
  const nbArretsHorsZoneRef = useRef(reprise ? reprise.nbArretsHorsZone : 0)
  // Ref toujours à jour de l'état, utilisable dans la closure figée de l'interval ci-dessous.
  const etatRef = useRef(etat)
  etatRef.current = etat
  // Bips : la séquence repart du début du tour (ligne de départ) à chaque reprise après une pause
  // en zone repos. ancreRef = temps effectif (s) au départ de la séquence en cours.
  const ancreRef = useRef(reprise ? null : 0)
  const dernierPlotRef = useRef(null)
  const [tours, setTours] = useState(reprise?.tours || 0)
  const toursRef = useRef(reprise?.tours || 0)
  toursRef.current = tours

  function snapshot(etatActuel) {
    return {
      startTs: startRef.current,
      totalPauseReposMs: totalPauseReposMsRef.current,
      malus: malusRef.current,
      nbArretsRepos: nbArretsReposRef.current,
      nbArretsHorsZone: nbArretsHorsZoneRef.current,
      etat: etatActuel,
      // Distance GPS cumulée au moment du snapshot, pour pouvoir la restaurer si l'appli se
      // ferme et que l'élève reprend le Fartlek plus tard (voir useGpsSuivi ci-dessus).
      distanceTotaleSauvegardee: distanceTotaleRef.current,
      tours: toursRef.current
    }
  }

  useEffect(() => {
    if (!reprise) beepDepart()
    annoncerVocal(reprise ? 'Reprise Fartlek' : 'Départ Fartlek !')
    onProgress?.(snapshot(etat))
    let tickCount = 0
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
      // Re-sauvegarde la session toutes les ~3s (en plus de chaque changement d'état) pour que
      // la distance GPS parcourue soit récupérable en cas de fermeture de l'appli en pleine
      // course, et pas seulement au moment d'une pause/arrêt.
      tickCount += 1
      if (tickCount % 12 === 0) onProgress?.(snapshot(etatRef.current))
      forceRender((v) => v + 1)
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => clearTimeout(confirmationTimeoutRef.current), [])

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
    onProgress?.(snapshot('pauseRepos'))
  }

  function debuterArretHorsZone() {
    if (etat !== 'normal') return
    arretDebutRef.current = Date.now()
    trancheCompteeRef.current = 0
    malusRef.current += 1 // pénalité immédiate
    nbArretsHorsZoneRef.current += 1
    setEtat('arretHorsZone')
    beep({ freq: 250, duration: 0.15, volume: 0.3 })
    onProgress?.(snapshot('arretHorsZone'))
  }

  function reprendre() {
    if (etat === 'pauseRepos' && pauseDebutRef.current) {
      totalPauseReposMsRef.current += Date.now() - pauseDebutRef.current
      pauseDebutRef.current = null
      // Repart de la ligne : la séquence de bips reprend au début du tour.
      ancreRef.current = null
      dernierPlotRef.current = null
    }
    if (etat === 'arretHorsZone') {
      arretDebutRef.current = null
    }
    setEtat('normal')
    beep({ freq: 700, duration: 0.1 })
    onProgress?.(snapshot('normal'))
  }

  const effectifS = effectifMsMaintenant() / 1000

  // Position théorique dans la séquence de bips en cours, et bips à chaque plot franchi.
  if (etat !== 'pauseRepos' && ancreRef.current == null) ancreRef.current = effectifS
  const tSequence = etat === 'pauseRepos' ? 0 : Math.max(0, effectifS - (ancreRef.current ?? effectifS))
  const dTheo = distanceTheoriqueFartlek(niveauNom, vmaRef, tSequence)
  const zoneCourante = zoneA(dTheo)
  const vZone = ((zoneCourante === 'intense' ? cfg.pctIntense : cfg.pctRecup) / 100) * (vmaRef || 0)
  useEffect(() => {
    if (etat === 'pauseRepos') return
    const plot = Math.floor((dTheo + 0.001) / 50)
    if (dernierPlotRef.current == null) {
      dernierPlotRef.current = plot
      return
    }
    if (plot > dernierPlotRef.current) {
      dernierPlotRef.current = plot
      const pos = (plot * 50) % 400
      if (pos === 0) bipLigne()
      else if (zoneA(plot * 50) !== zoneA(plot * 50 - 1)) gongTransition()
      else bipPlot()
    }
  })
  const dureeAtteinte = effectifS >= cfg.dureeMinS
  const peutTerminer = dureeAtteinte && etat === 'normal'

  function demanderTerminer() {
    setConfirmationTerminer(true)
    clearTimeout(confirmationTimeoutRef.current)
    confirmationTimeoutRef.current = setTimeout(() => setConfirmationTerminer(false), 3000)
  }

  function annulerConfirmationTerminer() {
    clearTimeout(confirmationTimeoutRef.current)
    setConfirmationTerminer(false)
  }

  function terminer() {
    clearTimeout(confirmationTimeoutRef.current)
    setConfirmationTerminer(false)
    beepFin()
    const distReelle = Math.round(distanceTotale)
    const distAttendue = Math.round(distanceAttendueM(niveauNom, vmaRef, effectifS))
    onTermine({
      niveauNom,
      dureeEffectiveS: Math.round(effectifS),
      dureeMinS: cfg.dureeMinS,
      distanceGpsM: gpsOk === true ? distReelle : null,
      distanceAttendueM: distAttendue,
      viaGps: gpsOk === true,
      tours: toursRef.current,
      nbArretsRepos: nbArretsReposRef.current,
      nbArretsHorsZone: nbArretsHorsZoneRef.current,
      malusTotal: malusRef.current
    })
  }

  return (
    <div className="max-w-md mx-auto px-6 py-6 text-center">
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">{libelleNiveau(niveauNom)} · Fartlek</p>

      <div className="font-display text-6xl text-piste-900 mb-1 tabular-nums">
        {formatDuree(Math.max(0, effectifS))}
      </div>
      <p className="text-xs text-piste-500 mb-6">
        course effective / {Math.round(cfg.dureeMinS / 60)} min mini

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

      <div className={`rounded-2xl border-2 p-4 mb-4 ${zoneCourante === 'intense' ? 'border-alerte/50 bg-[#fbeeea]' : 'border-piste-300 bg-piste-50'}`}>
        <p className="text-xs font-semibold text-piste-700 mb-1">
          {etat === 'pauseRepos' ? 'Repars de la ligne' : zoneCourante === 'intense' ? 'Zone intense' : 'Zone récup'}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Volume2 size={16} className="text-piste-600" />
          <span className="font-display text-2xl text-piste-900 tabular-nums">
            {temps50mS(vZone) ? `${temps50mS(vZone).toFixed(1).replace('.', ',')} s` : '—'}
          </span>
        </div>
        <p className="text-[11px] text-piste-500">au 50 m · sois au plot à chaque bip</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-2 border-piste-200 rounded-2xl px-3 py-2 mb-4">
        <button
          onClick={() => setTours((t) => Math.max(0, t - 1))}
          disabled={tours === 0}
          className="p-3 rounded-xl text-piste-500 disabled:opacity-30"
          aria-label="Annuler un tour"
        >
          <Minus size={18} />
        </button>
        <div className="text-center">
          <p className="font-display text-2xl text-piste-900 tabular-nums">{tours}</p>
          <p className="text-[11px] text-piste-500">tour{tours > 1 ? 's' : ''} complet{tours > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setTours((t) => t + 1)}
          className="flex items-center gap-1.5 bg-piste-800 text-white font-medium px-5 py-4 rounded-xl active:scale-[0.97]"
        >
          <Plus size={18} /> 1 tour
        </button>
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

      {!confirmationTerminer ? (
        <button
          onClick={demanderTerminer}
          disabled={!peutTerminer}
          className="w-full flex items-center justify-center gap-1.5 border-2 border-piste-800 disabled:opacity-30 text-piste-800 text-sm font-medium py-3 rounded-xl"
        >
          <Square size={15} /> Terminer {!dureeAtteinte && `(encore ${formatDuree(cfg.dureeMinS - effectifS)})`}
        </button>
      ) : (
        <div className="rounded-xl border-2 border-piste-300 bg-piste-50 p-4">
          <p className="text-xs text-piste-700 mb-3">Confirme pour terminer le Fartlek maintenant</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={terminer} className="flex items-center gap-2 bg-piste-800 text-white px-5 py-3 rounded-xl font-medium">
              <Square size={16} fill="white" /> Confirmer
            </button>
            <button onClick={annulerConfirmationTerminer} className="text-xs text-piste-500 underline px-2">Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FartlekEval({ eleve, vmaRef, onTermine, onActiviteEnCours }) {
  useWakeLock(true)
  const [repriseProposee, setRepriseProposee] = useState(() => storage.getSessionCours(eleve, TYPE_SESSION))
  const [phase, setPhase] = useState('niveau')
  const [niveauNom, setNiveauNom] = useState(null)
  const [donneesCourse, setDonneesCourse] = useState(null)
  const [borg, setBorg] = useState(null)

  // Signale au parent qu'un chrono est actif, pour désactiver la flèche retour de l'en-tête.
  useEffect(() => {
    onActiviteEnCours?.(phase === 'course')
    return () => onActiviteEnCours?.(false)
  }, [phase])

  function handleReprendre() {
    setNiveauNom(repriseProposee.niveauNom)
    setPhase('course')
  }

  function handleIgnorerReprise() {
    storage.effacerSessionCours(eleve, TYPE_SESSION)
    setRepriseProposee(null)
  }

  function handleProgressCourse(snapshot) {
    storage.sauvegarderSessionCours(eleve, TYPE_SESSION, { niveauNom, ...snapshot })
  }

  function handleFinCourse(donnees) {
    storage.effacerSessionCours(eleve, TYPE_SESSION)
    setDonneesCourse(donnees)
    setPhase('saisie')
  }

  // L'élève calcule et saisit sa distance totale ; elle fait foi sauf écart trop important avec
  // la mesure GPS (> 5 % et ≥ 50 m) : le GPS est alors retenu et le professeur alerté.
  function handleValideDistance(distanceDeclareeM) {
    const res = resoudreDistance(distanceDeclareeM, donneesCourse.distanceGpsM)
    setDonneesCourse((d) => ({
      ...d,
      distanceDeclareeM,
      distanceReelleM: res.distanceRealisee,
      sourceDistance: res.sourceDistance,
      alerteDistance: res.alerteDistance
    }))
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

  if (repriseProposee && phase === 'niveau') {
    return <ReprisePrompt titre="Ton Fartlek évaluatif" onReprendre={handleReprendre} onIgnorer={handleIgnorerReprise} />
  }

  if (phase === 'niveau') {
    return <ChoixNiveauFartlek onChoisir={(n) => { setNiveauNom(n); setPhase('apercu') }} />
  }
  if (phase === 'apercu') {
    return <ApercuFartlek niveauNom={niveauNom} onDemarrer={() => setPhase('course')} />
  }
  if (phase === 'course') {
    return (
      <CourseFartlek
        niveauNom={niveauNom}
        vmaRef={vmaRef}
        reprise={repriseProposee}
        onProgress={handleProgressCourse}
        onTermine={handleFinCourse}
      />
    )
  }
  if (phase === 'saisie') {
    return (
      <SaisieDistance
        titre="Fartlek terminé"
        dureeCourseS={donneesCourse.dureeEffectiveS}
        tours={donneesCourse.tours || 0}
        onValide={handleValideDistance}
      />
    )
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
        <p className="text-sm text-piste-600 mb-3">
          Durée effective : {formatDuree(donneesCourse.dureeEffectiveS)}
        </p>
        <div className="border-2 border-piste-200 rounded-xl px-4 py-3 text-left mb-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-piste-500">Ton calcul</p>
              <p className="font-display text-xl text-piste-900">{formatKmM(donneesCourse.distanceDeclareeM)}</p>
            </div>
            {donneesCourse.distanceGpsM != null && (
              <div className="text-right">
                <p className="text-[11px] text-piste-500">GPS</p>
                <p className="font-display text-xl text-piste-900">{formatKmM(donneesCourse.distanceGpsM)}</p>
              </div>
            )}
          </div>
          {donneesCourse.distanceGpsM ? (
            <p className="text-xs text-piste-600 mt-2">
              Écart : {donneesCourse.distanceDeclareeM - donneesCourse.distanceGpsM > 0 ? '+' : ''}{donneesCourse.distanceDeclareeM - donneesCourse.distanceGpsM} m · justesse de ton calcul{' '}
              {Math.max(0, Math.round(100 - (Math.abs(donneesCourse.distanceDeclareeM - donneesCourse.distanceGpsM) / donneesCourse.distanceGpsM) * 100))} %
            </p>
          ) : null}
        </div>
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
