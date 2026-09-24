import { useEffect, useRef, useState } from 'react'
import { Square, TrendingDown, TrendingUp, CheckCircle2, LogOut, Pause, Play, Plus, Minus, Volume2 } from 'lucide-react'
import { beepDepart, beepFin, planifierBipRegulation, gongTransition, annoncerVocal, bipPlot, bipLigne } from '../utils/audio'
import { distanceTheorique, temps50mS, PLOT_M, TOUR_M } from '../utils/guidage'
import { formatDuree, vitesseVersAllure, vitesseVersTemps50m } from '../utils/calc'
import { libellePhase } from '../utils/fullpower'
import IndicateurGps from './IndicateurGps'

const TOLERANCE_GPS = 0.09 // ±9%, même tolérance que Fractionné GPS Pro

// resumeStartTs : si fourni (reprise après mise en veille/fermeture de l'appli), le bloc démarre
// directement en course avec ce timestamp de départ, sans repasser par le décompte de latence —
// le chrono reprend exactement là où il en était, comme si rien ne s'était passé.
// onDemarre : appelé une seule fois avec le timestamp réel de départ du bloc (latence normale ou
// reprise), pour que le parent puisse le sauvegarder en vue d'une éventuelle prochaine reprise.
// Le GPS est toujours tenté automatiquement (recherche dès le montage, comme pour les tests VMA) :
// s'il répond, l'écran d'allure GPS s'affiche ; sinon, repli invisible sur l'affichage minuteur.
// resumeDistance : distance GPS (m) déjà parcourue sur ce bloc avant une éventuelle coupure
// (fermeture/mise en veille de l'appli), à restaurer au lieu de repartir de 0 — voir
// onDistanceProgress plus bas, qui remonte régulièrement la distance en cours au parent pour
// qu'il puisse la sauvegarder.
// modeGuidage : 'gps' (vitesse GPS, encart de couleur), 'bips' (bip à chaque plot de 50 m au
// rythme de l'allure cible, sans GPS) ou 'mixte' (bips + GPS mesurant la distance en
// arrière-plan). La distance GPS n'est JAMAIS affichée pendant la course : l'élève calcule et
// saisit lui-même sa distance à la fin (voir SaisieDistance). En mode 'gps', un bouton permet à
// l'élève de passer en mixte (onChangerMode) si son GPS est imprécis ou décroche.
// Chaque départ se fait sur la ligne : les bips sont calés sur la distance théorique parcourue
// depuis le départ, donc sur les plots fixes de la piste (signal distinct tous les 400 m).
export default function CourseRun({ phases, distanceCible, dureeCible, labelBloc, labelTerminer = 'Terminer le bloc', modeGuidage = 'gps', onChangerMode, onTermineBloc, onAbandon, resumeStartTs, onDemarre, resumeDistance, onDistanceProgress, resumeTours = 0 }) {
  const avecBips = modeGuidage !== 'gps'
  const avecGps = modeGuidage !== 'bips'
  const [tours, setTours] = useState(resumeTours)
  const toursRef = useRef(resumeTours)
  useEffect(() => { toursRef.current = tours }, [tours])
  const dernierPlotRef = useRef(null)
  const [etat, setEtat] = useState(resumeStartTs ? 'course' : 'latence') // latence | course | fin
  const [compteALatence, setCompteALatence] = useState(4)
  const [elapsed, setElapsed] = useState(0)
  const [distance, setDistance] = useState(resumeDistance || 0)
  const distanceRef = useRef(resumeDistance || 0)
  useEffect(() => { distanceRef.current = distance }, [distance])

  // Remonte la distance en cours au parent toutes les ~3s pendant la course, pour qu'elle
  // puisse être sauvegardée et restaurée en cas de fermeture de l'appli (resumeDistance ci-dessus).
  useEffect(() => {
    if (etat !== 'course') return
    const iv = setInterval(() => onDistanceProgress?.(distanceRef.current, toursRef.current), 3000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat])
  const [vitesseInstant, setVitesseInstant] = useState(0)
  // null = recherche en cours, true = GPS actif et exploité, false = indisponible/refusé →
  // repli automatique sur l'affichage minuteur.
  const [gpsOk, setGpsOk] = useState(null)
  const [annonce, setAnnonce] = useState(null)
  // Empêche d'arrêter le bloc par un appui accidentel (téléphone tenu/rangé en courant) : un
  // premier appui affiche une confirmation qui disparaît d'elle-même après 3s si elle n'est pas
  // validée. null | 'terminer' | 'abandonner' | 'pause'.
  const [confirmation, setConfirmation] = useState(null)

  // Pause manuelle (générique, séances classiques uniquement) : chrono et distance GPS figés
  // pendant la pause, comptée par phase + au total sur le bloc.
  const [enPause, setEnPause] = useState(false)
  const [pausesParPhase, setPausesParPhase] = useState({})
  const [dureePauseTotaleS, setDureePauseTotaleS] = useState(0)
  const pauseStartRef = useRef(null)
  const enPauseRef = useRef(false)
  useEffect(() => { enPauseRef.current = enPause }, [enPause])

  const startRef = useRef(resumeStartTs || null)
  const watchIdRef = useRef(null)
  const lastPosRef = useRef(null)
  const bipTimeoutRef = useRef(null)
  const intervalRef = useRef(null)
  const vitessesTravailRef = useRef([])
  // Échantillons de vitesse groupés par index de phase (travail ET récup), pour permettre un
  // calcul de réussite fin par phase (allure, récup, régularité) et non plus seulement un
  // agrégat unique sur tout le bloc. indexPhaseRef est tenu à jour à chaque render (voir plus
  // bas) car le callback GPS est enregistré une seule fois (effet dépendant seulement de
  // `etat`) : lire `indexPhase` directement dans ce callback donnerait une valeur figée à
  // l'index du tout premier render ('travail' quasi toujours), jamais mise à jour ensuite.
  const phaseSamplesRef = useRef({})
  const indexPhaseRef = useRef(0)
  const dernierIndexPhaseRef = useRef(-1)
  const termineAutoRef = useRef(false)
  const annonceTimeoutRef = useRef(null)
  const confirmationTimeoutRef = useRef(null)

  const cumul = phases.reduce((acc, p, i) => {
    acc.push((acc[i - 1] || 0) + p.duree_s)
    return acc
  }, [])
  const dureeTotalePhases = cumul[cumul.length - 1] || 0

  let indexPhase = phases.findIndex((_, i) => elapsed < cumul[i])
  if (indexPhase === -1) indexPhase = phases.length - 1
  const phaseCourante = phases[indexPhase] || phases[0]
  const debutPhase = indexPhase > 0 ? cumul[indexPhase - 1] : 0
  const phaseElapsed = Math.max(0, elapsed - debutPhase)
  const vitesseCible = phaseCourante?.vitesse_kmh || 0

  // Regroupe les phases consécutives partageant la même série (tour) ou la même répétition,
  // pour permettre à l'élève de se situer à plusieurs niveaux : dans le bloc entier, dans la
  // série en cours, et dans la répétition en cours — plutôt qu'un seul décompte global.
  const serieIndex = phaseCourante?.serieIndex ?? null
  const serieTotal = phaseCourante?.serieTotal ?? null
  const repIndex = phaseCourante?.repIndex ?? null
  const repTotal = phaseCourante?.repTotal ?? null

  useEffect(() => {
    indexPhaseRef.current = indexPhase
  }, [indexPhase])

  function finDuGroupe(cle) {
    const valeur = phaseCourante?.[cle]
    if (valeur === undefined || valeur === null) return indexPhase
    let j = indexPhase
    while (j + 1 < phases.length && phases[j + 1][cle] === valeur) j++
    return j
  }
  const finIndexSerie = finDuGroupe('serieIndex')
  const finIndexRep = finDuGroupe('repIndex')
  const serieRestante = Math.max(0, (cumul[finIndexSerie] ?? dureeTotalePhases) - elapsed)
  const repetitionRestante = Math.max(0, (cumul[finIndexRep] ?? dureeTotalePhases) - elapsed)

  useEffect(() => {
    if (etat !== 'latence') return
    if (compteALatence <= 0) {
      beepDepart()
      setEtat('course')
      startRef.current = Date.now()
      onDemarre?.(startRef.current)
      return
    }
    const t = setTimeout(() => setCompteALatence((c) => c - 1), 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat, compteALatence])

  // Cas d'une reprise après mise en veille/fermeture de l'appli : le composant démarre déjà en
  // 'course' (voir useState plus haut), on signale juste le départ au parent pour qu'il sache
  // que ce timestamp est désormais "consommé" et ne doit plus être réutilisé pour le bloc suivant.
  useEffect(() => {
    if (resumeStartTs) onDemarre?.(resumeStartTs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (etat !== 'course' || enPause) return
    intervalRef.current = setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000)
    }, avecBips ? 100 : 250)
    return () => clearInterval(intervalRef.current)
  }, [etat, enPause, avecBips])

  // Bips 50 m : un bip chaque fois que la distance théorique (allures cibles suivies exactement
  // depuis la ligne de départ) franchit un plot ; signal distinct à chaque passage de ligne.
  useEffect(() => {
    if (!avecBips || etat !== 'course' || enPause) return
    const plot = Math.floor((distanceTheorique(phases, elapsed) + 0.001) / PLOT_M)
    if (dernierPlotRef.current == null) {
      dernierPlotRef.current = plot
      return
    }
    if (plot > dernierPlotRef.current) {
      dernierPlotRef.current = plot
      if ((plot * PLOT_M) % TOUR_M === 0) bipLigne()
      else bipPlot()
    }
  }, [elapsed, etat, enPause, avecBips, phases])

  // Annonce (visuelle + vocale) et gong à chaque changement de phase : "Départ !", "Récupération
  // type Répétition/Série", etc. Le gong ne joue pas sur la toute première phase (départ du bloc).
  useEffect(() => {
    if (etat !== 'course') return
    if (dernierIndexPhaseRef.current !== indexPhase) {
      if (dernierIndexPhaseRef.current !== -1) gongTransition()
      const texte = libellePhase(phases[indexPhase])
      setAnnonce(texte)
      annoncerVocal(texte)
      clearTimeout(annonceTimeoutRef.current)
      annonceTimeoutRef.current = setTimeout(() => setAnnonce(null), 1800)
      dernierIndexPhaseRef.current = indexPhase
    }
    return () => clearTimeout(annonceTimeoutRef.current)
  }, [indexPhase, etat, phases])

  // Fin automatique quand toutes les phases sont écoulées
  useEffect(() => {
    if (etat !== 'course' || termineAutoRef.current) return
    if (elapsed >= dureeTotalePhases) {
      termineAutoRef.current = true
      arreter(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, etat])

  // Guidage GPS : toujours tenté automatiquement, dès le montage (recherche déjà en cours pendant
  // le décompte de latence, comme pour les tests VMA), pour être fixé au plus tôt une fois la
  // course lancée. En cas d'échec (refus, indisponible, timeout), gpsOk passe à false et l'écran
  // bascule sur l'affichage minuteur (voir rendu plus bas) — jamais de blocage de la séance.
  useEffect(() => {
    if (etat === 'fin') return
    if (!avecGps) {
      setGpsOk(false)
      return
    }
    if (!('geolocation' in navigator)) {
      setGpsOk(false)
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsOk(true)
        if (etat !== 'course' || enPauseRef.current) return
        const { latitude, longitude, speed } = pos.coords
        const now = Date.now()
        if (lastPosRef.current) {
          const dt = (now - lastPosRef.current.time) / 1000
          if (dt > 0) {
            const d = haversine(lastPosRef.current, { latitude, longitude })
            const vInstant = speed != null && speed >= 0 ? speed : d / dt
            const vKmh = vInstant * 3.6
            // Sous 0,5 km/h, bruit GPS normal à l'arrêt plutôt qu'un déplacement réel.
            const vAffichee = vKmh < 0.5 ? 0 : vKmh
            setDistance((prev) => prev + d)
            setVitesseInstant(vAffichee)
            const iPhase = indexPhaseRef.current
            const pCourante = phases[iPhase]
            if (pCourante?.phase === 'travail') {
              vitessesTravailRef.current.push(vAffichee)
            }
            if (pCourante) {
              if (!phaseSamplesRef.current[iPhase]) phaseSamplesRef.current[iPhase] = []
              phaseSamplesRef.current[iPhase].push(vAffichee)
            }
          }
        }
        lastPosRef.current = { latitude, longitude, time: now }
      },
      // Ne repasse jamais gpsOk à false une fois qu'un point valide a été reçu (évite un
      // aller-retour intempestif sur une seule mesure ratée) ; sinon, GPS considéré indisponible.
      () => setGpsOk((prev) => (prev === true ? prev : false)),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    )
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat, avecGps])

  // Bips de régulation d'allure (dès que le GPS répond)
  useEffect(() => {
    if (etat !== 'course' || gpsOk !== true || !vitesseCible || modeGuidage !== 'gps') return
    const ecart = (vitesseInstant - vitesseCible) / vitesseCible
    bipTimeoutRef.current = planifierBipRegulation(ecart, () => {})
    return () => clearTimeout(bipTimeoutRef.current)
  }, [vitesseInstant, etat, gpsOk, vitesseCible, modeGuidage])

  function demanderConfirmation(action) {
    setConfirmation(action)
    clearTimeout(confirmationTimeoutRef.current)
    confirmationTimeoutRef.current = setTimeout(() => setConfirmation(null), 3000)
  }

  function annulerConfirmation() {
    clearTimeout(confirmationTimeoutRef.current)
    setConfirmation(null)
  }

  function confirmerAction() {
    clearTimeout(confirmationTimeoutRef.current)
    const action = confirmation
    setConfirmation(null)
    if (action === 'terminer') arreter(false)
    else if (action === 'abandonner') onAbandon()
    else if (action === 'pause') demarrerPause()
  }

  function demarrerPause() {
    clearTimeout(bipTimeoutRef.current)
    // Évite qu'un bond de distance factice soit compté au retour du GPS après la pause (le
    // premier point reçu à la reprise redémarre le calcul de distance depuis zéro, sans delta).
    lastPosRef.current = null
    pauseStartRef.current = Date.now()
    setPausesParPhase((p) => ({ ...p, [indexPhase]: (p[indexPhase] || 0) + 1 }))
    setEnPause(true)
  }

  function reprendreCourse() {
    const dureePauseMs = Date.now() - (pauseStartRef.current || Date.now())
    // Décale le départ du chrono du temps passé en pause, pour que le temps de course reprenne
    // exactement où il en était (la pause ne compte pas comme du temps de course effectif).
    startRef.current += dureePauseMs
    setDureePauseTotaleS((s) => s + dureePauseMs / 1000)
    setEnPause(false)
  }

  useEffect(() => () => clearTimeout(confirmationTimeoutRef.current), [])

  function arreter(automatique = false) {
    beepFin()
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    clearInterval(intervalRef.current)
    setEtat('fin')

    const dureeReelle = elapsed
    let termine, respectAllure
    // Le calcul GPS ne s'applique que si le GPS a effectivement fonctionné pendant le bloc ;
    // sinon (indisponible/refusé), repli sur le même calcul que le guidage minuteur.
    const gpsExploitable = gpsOk === true

    // Réussite du bloc sur 4 critères indépendants (Distance / Allure / Récupération /
    // Régularité), chacun exprimé en % — voir utils/calc.js pour la pondération finale.
    // Allure et Régularité se basent sur la moyenne de vitesse RÉELLEMENT échantillonnée par
    // phase de travail (pas l'agrégat global sur tout le bloc) ; Récupération sur les phases de
    // récup de la structure Full Power (si la séance en a). Une phase sans échantillon (perte
    // GPS ponctuelle) est simplement exclue du calcul plutôt que comptée comme un échec.
    function calculerCriteres4() {
      function ratioPhase(i, cible) {
        const s = phaseSamplesRef.current[i]
        if (!s || !s.length || !cible) return null
        const moyenne = s.reduce((a, b) => a + b, 0) / s.length
        return moyenne / cible
      }
      const ratiosTravail = phases
        .map((p, i) => (p.phase === 'travail' ? ratioPhase(i, p.vitesse_kmh) : null))
        .filter((r) => r != null)
      const ratiosRecup = phases
        .map((p, i) => (p.phase === 'recup' ? ratioPhase(i, p.vitesse_kmh) : null))
        .filter((r) => r != null)

      // Score d'un ratio individuel : 100% pile dans la cible, décroît linéairement jusqu'à 0
      // à ±25% d'écart (travail) ou ±35% (récup, plus tolérant car l'allure de récup est
      // naturellement moins précise à tenir qu'un effort).
      const scoreRatio = (r, tolerance) => Math.max(0, 1 - Math.min(1, Math.abs(r - 1) / tolerance)) * 100

      const pctAllure = ratiosTravail.length
        ? Math.round(ratiosTravail.reduce((acc, r) => acc + scoreRatio(r, 0.25), 0) / ratiosTravail.length)
        : null
      const pctRecup = ratiosRecup.length
        ? Math.round(ratiosRecup.reduce((acc, r) => acc + scoreRatio(r, 0.35), 0) / ratiosRecup.length)
        : null
      let pctRegularite = null
      if (ratiosTravail.length >= 2) {
        const moyR = ratiosTravail.reduce((a, b) => a + b, 0) / ratiosTravail.length
        const variance = ratiosTravail.reduce((acc, r) => acc + (r - moyR) ** 2, 0) / ratiosTravail.length
        pctRegularite = Math.round(Math.max(0, 100 - Math.sqrt(variance) * 400))
      } else if (ratiosTravail.length === 1) {
        pctRegularite = 100
      }
      const pctDistance = distanceCible ? Math.round(Math.min(100, (distance / distanceCible) * 100)) : null
      return { pctDistance, pctAllure, pctRecup, pctRegularite }
    }

    const statsPause = {
      nbPauses: Object.values(pausesParPhase).reduce((a, b) => a + b, 0),
      pausesParPhase,
      dureePauseS: Math.round(dureePauseTotaleS)
    }

    if (gpsExploitable) {
      termine = automatique || distance >= distanceCible * 0.95
      const vs = vitessesTravailRef.current
      const vitesseMoyenne = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0
      const vitesseCibleMoyenneTravail =
        phases.filter((p) => p.phase === 'travail').reduce((a, p) => a + p.vitesse_kmh, 0) /
        (phases.filter((p) => p.phase === 'travail').length || 1)
      respectAllure = vitesseCibleMoyenneTravail
        ? Math.abs(vitesseMoyenne - vitesseCibleMoyenneTravail) / vitesseCibleMoyenneTravail <= TOLERANCE_GPS
        : false
      onTermineBloc({
        viaGPS: true,
        termine,
        respectAllure,
        distanceRealisee: Math.round(distance),
        distanceCible: Math.round(distanceCible || 0),
        dureeRealisee: dureeReelle,
        vitesseMoyenne: Math.round(vitesseMoyenne * 10) / 10,
        vitesseCible: Math.round(vitesseCibleMoyenneTravail * 10) / 10,
        ...calculerCriteres4(),
        // Vitesse moyenne mesurée par phase (même ordre que `phases`) et fin par chrono : permettent
        // de réévaluer ce bloc contre d'autres objectifs (mode binôme, voir utils/binome.js).
        vitessesPhases: phases.map((_, i) => {
          const s = phaseSamplesRef.current[i]
          return s && s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100) / 100 : null
        }),
        finAutomatique: !!automatique,
        distanceGPS: Math.round(distance),
        tours,
        modeGuidage,
        ...statsPause
      })
    } else {
      termine = automatique || dureeReelle >= dureeCible * 0.9
      respectAllure = Math.abs(dureeReelle - dureeCible) / dureeCible <= 0.1
      onTermineBloc({
        viaGPS: false,
        termine,
        respectAllure,
        distanceRealisee: distanceCible,
        distanceCible,
        dureeRealisee: dureeReelle,
        dureeCible,
        vitesseMoyenne: null,
        vitesseCible: null,
        // Sans GPS, seuls Distance et Allure sont mesurables (comme avant) ; Récupération et
        // Régularité ne peuvent pas être évalués sans échantillons de vitesse.
        pctDistance: termine ? 100 : Math.round(Math.min(100, (dureeReelle / dureeCible) * 100)),
        pctAllure: respectAllure ? 100 : 40,
        pctRecup: null,
        pctRegularite: null,
        finAutomatique: !!automatique,
        distanceGPS: null,
        tours,
        modeGuidage,
        ...statsPause
      })
    }
  }

  if (etat === 'latence') {
    return (
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        <p className="text-piste-600 mb-4">Prépare-toi...</p>
        <div className="font-display text-7xl text-piste-900 mb-6">{compteALatence}</div>
        {avecGps && <IndicateurGps gpsOk={gpsOk} className="flex justify-center" />}
        {avecBips && <p className="text-xs text-piste-500 mt-3">Place-toi sur la ligne de départ : un bip à chaque plot.</p>}
      </div>
    )
  }

  const ecartPct = vitesseCible ? ((vitesseInstant - vitesseCible) / vitesseCible) * 100 : 0
  const dansLaZone = Math.abs(ecartPct) < 5

  // En récupération, le gros chrono central décompte vers 0 (au lieu de monter) pour bien
  // distinguer visuellement du travail — la récup reste chronométrée en interne de la même façon.
  const enRecup = phaseCourante?.phase === 'recup'
  const tempsAfficheGrandChrono = enRecup
    ? Math.max(0, (phaseCourante?.duree_s || 0) - phaseElapsed)
    : phaseElapsed

  return (
    <div className="max-w-md mx-auto px-6 py-8 text-center">
      {annonce && (
        <div className="fixed inset-x-0 top-4 z-40 flex justify-center px-6 pointer-events-none">
          <div className="bg-piste-800 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg text-center">
            {annonce}
          </div>
        </div>
      )}
      <p className="text-xs uppercase tracking-wide text-piste-500 mb-1">
        {labelBloc} {phases.length > 1 && `· Phase ${indexPhase + 1}/${phases.length}`}
      </p>
      {serieTotal > 1 && (
        <p className="text-xs font-semibold text-piste-700 mb-1">
          Série {serieIndex + 1}/{serieTotal}
          {repTotal ? ` · Répétition ${repIndex}/${repTotal}` : ''}
        </p>
      )}
      <p className="text-[11px] uppercase tracking-wide font-medium text-piste-600 mb-3">
        {phaseCourante?.phase === 'recup' ? 'Récupération' : 'Travail'}{phaseCourante?.typeLettre ? ` · Type ${phaseCourante.typeLettre}` : ''}
      </p>
      <div className="font-display text-6xl text-piste-900 mb-2 tabular-nums">
        {enRecup && '-'}{formatDuree(tempsAfficheGrandChrono)}
      </div>
      <p className="text-sm text-piste-500 mb-1">Objectif phase {formatDuree(phaseCourante?.duree_s || 0)} · {vitesseVersAllure(vitesseCible)} · {vitesseVersTemps50m(vitesseCible)}</p>
      {repTotal > 0 && finIndexRep > indexPhase && (
        <p className="text-xs text-piste-400 mb-8">Reste {formatDuree(repetitionRestante)} pour finir cette répétition (travail + récup)</p>
      )}
      {!(repTotal > 0 && finIndexRep > indexPhase) && <div className="mb-8" />}

      {modeGuidage === 'gps' && gpsOk !== true && (
        <IndicateurGps gpsOk={gpsOk} className="mb-4 flex justify-center" />
      )}

      {modeGuidage === 'gps' && gpsOk === true ? (
        <div className={`rounded-2xl border-2 p-6 mb-4 transition-colors ${dansLaZone ? 'border-piste-400 bg-piste-50' : 'border-alerte/50 bg-[#fbeeea]'}`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            {ecartPct > 5 && <TrendingUp className="text-alerte" size={20} />}
            {ecartPct < -5 && <TrendingDown className="text-alerte" size={20} />}
            {dansLaZone && <CheckCircle2 className="text-piste-600" size={20} />}
            <span className="font-display text-3xl text-piste-900 tabular-nums">{vitesseInstant.toFixed(1)} km/h</span>
          </div>
          {serieTotal > 1 && (
            <p className="text-[11px] text-piste-400 mt-2 pt-2 border-t border-piste-200">
              Série {serieIndex + 1}/{serieTotal} · reste {formatDuree(serieRestante)}
            </p>
          )}
        </div>
      ) : avecBips ? (
        <div className="rounded-2xl border-2 border-piste-400 bg-piste-50 p-5 mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Volume2 size={18} className="text-piste-600" />
            <span className="font-display text-3xl text-piste-900 tabular-nums">
              {temps50mS(vitesseCible) ? `${temps50mS(vitesseCible).toFixed(1).replace('.', ',')} s` : '—'}
            </span>
          </div>
          <p className="text-xs text-piste-600">au 50 m · sois au plot à chaque bip</p>
          <p className="text-[11px] text-piste-400 mt-1">Double bip = passage sur la ligne</p>
          {serieTotal > 1 && (
            <p className="text-[11px] text-piste-400 mt-2 pt-2 border-t border-piste-200">
              Série {serieIndex + 1}/{serieTotal} · reste {formatDuree(serieRestante)}
            </p>
          )}
          {modeGuidage === 'mixte' && (
            <IndicateurGps gpsOk={gpsOk} className="mt-2 flex justify-center" />
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-piste-300 bg-piste-50 p-6 mb-4">
          <p className="font-display text-3xl text-piste-900 mb-1">
            {formatDuree(serieTotal > 1 ? serieRestante : dureeTotalePhases - elapsed)}
          </p>
          <p className="text-xs text-piste-600">
            {serieTotal > 1 ? `temps restant sur la série ${serieIndex + 1}/${serieTotal}` : 'temps restant'}
          </p>
        </div>
      )}

      {modeGuidage === 'gps' && onChangerMode && (
        <button
          onClick={() => onChangerMode('mixte')}
          className={`w-full text-xs font-medium rounded-xl py-2.5 mb-4 border ${gpsOk === false ? 'border-alerte/50 text-alerte bg-[#fbeeea]' : 'border-piste-200 text-piste-600'}`}
        >
          {gpsOk === false ? 'GPS indisponible : passer aux bips 50 m' : 'GPS imprécis ? Passer aux bips 50 m'}
        </button>
      )}

      <div className="flex items-center justify-between gap-3 border-2 border-piste-200 rounded-2xl px-3 py-2 mb-6">
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

      {enPause ? (
        <div className="rounded-xl border-2 border-piste-300 bg-piste-50 p-5 text-center">
          <p className="text-sm font-medium text-piste-800 mb-1">Pause en cours</p>
          <p className="text-xs text-piste-500 mb-4">Le chrono et la distance sont figés tant que tu n'as pas repris.</p>
          <button
            onClick={reprendreCourse}
            className="w-full flex items-center justify-center gap-2 bg-piste-800 hover:bg-piste-700 text-white font-medium py-4 rounded-xl transition active:scale-[0.98]"
          >
            <Play size={16} fill="white" /> Reprendre la course
          </button>
        </div>
      ) : confirmation === null ? (
        <>
          <button
            onClick={() => demanderConfirmation('terminer')}
            className="w-full flex items-center justify-center gap-2 bg-alerte hover:bg-alerte/90 text-white font-medium py-4 rounded-xl transition active:scale-[0.98]"
          >
            <Square size={16} fill="white" /> {labelTerminer}
          </button>
          <button
            onClick={() => demanderConfirmation('pause')}
            className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-piste-300 text-piste-700 font-medium py-3 rounded-xl transition active:scale-[0.98]"
          >
            <Pause size={16} /> Pause
          </button>
          <button onClick={() => demanderConfirmation('abandonner')} className="mt-3 text-xs text-piste-400 underline">
            Abandonner sans enregistrer
          </button>
        </>
      ) : confirmation === 'terminer' ? (
        <div className="rounded-xl border-2 border-alerte/40 bg-[#fbeeea] p-4">
          <p className="text-xs text-piste-700 mb-3">Confirme pour terminer maintenant</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={confirmerAction} className="flex items-center gap-2 bg-alerte text-white px-5 py-3 rounded-xl font-medium">
              <Square size={16} fill="white" /> Confirmer
            </button>
            <button onClick={annulerConfirmation} className="text-xs text-piste-500 underline px-2">Annuler</button>
          </div>
        </div>
      ) : confirmation === 'pause' ? (
        <div className="rounded-xl border-2 border-piste-300 bg-piste-50 p-4">
          <p className="text-xs text-piste-700 mb-3">Confirme pour mettre la course en pause</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={confirmerAction} className="flex items-center gap-2 bg-piste-800 text-white px-5 py-3 rounded-xl font-medium">
              <Pause size={16} /> Confirmer la pause
            </button>
            <button onClick={annulerConfirmation} className="text-xs text-piste-500 underline px-2">Annuler</button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-alerte/40 bg-[#fbeeea] p-4">
          <p className="text-xs text-piste-700 mb-3">Confirme pour abandonner ce bloc sans l'enregistrer</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={confirmerAction} className="flex items-center gap-2 bg-alerte text-white px-5 py-3 rounded-xl font-medium">
              <LogOut size={16} /> Confirmer l'abandon
            </button>
            <button onClick={annulerConfirmation} className="text-xs text-piste-500 underline px-2">Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

function haversine(a, b) {
  const R = 6371000
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
