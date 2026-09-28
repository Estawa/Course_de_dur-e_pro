import { useEffect, useRef, useState } from 'react'
import CourseRun from './CourseRun'
import BilanBloc from './BilanBloc'
import BorgScale from './BorgScale'
import ObservationFinale from './ObservationFinale'
import Echauffement from './Echauffement'
import Recuperation from './Recuperation'
import FinSeanceAnnonce from './FinSeanceAnnonce'
import SaisieDistance from './SaisieDistance'
import PriseDePouls from './PriseDePouls'
import ChoixEchauffement from './ChoixEchauffement'
import SaisieFinTravail from './SaisieFinTravail'
import BinomeBloc from './BinomeBloc'
import RecupInterSeries from './RecupInterSeries'
import { reevaluerBloc } from '../utils/binome'
import { decouperSegments, distancePhases, dureePhases, fusionnerSegments, SEUIL_RETOUR_DEPART_S } from '../utils/guidage'
import { calculerNoteSeance } from '../utils/calc'
import { expanserStructure, dureeTotaleStructure, distanceTotaleStructure, dureeRecuperationFinale, dureeRecupApresSerie, pctVmaRecupApresSerie } from '../utils/fullpower'
import { RECUPERATION_FIXE } from '../utils/phasesFixes'
import { useWakeLock } from '../utils/wakeLock'
import { libelleNiveau } from '../utils/niveauLabels'
import ArretProfAnnonce from './ArretProfAnnonce'
import { useArretProf, tronquerPhases, traceArret, DUREE_MIN_PARTIE_INTERROMPUE_S } from '../utils/arretProf'

export function preparerBloc(bloc, niveau, vmaRef) {
  if (bloc.mode === 'fullpower' && bloc.structure) {
    // La "récupération après la série" n'est jamais jouée dans le déroulé de la série : pour une
    // série intermédiaire, elle a son écran dédié (RecupInterSeries, pendant lequel l'élève saisit
    // sa distance et fait son bilan) ; pour la dernière, elle règle la durée de la récupération de
    // fin de séance (Recuperation). Les objectifs de distance/allure ne portent donc que sur la
    // série courue elle-même.
    const opts = { inclureRecupFinale: false }
    return {
      phases: expanserStructure(bloc.structure, vmaRef, opts),
      distanceCible: distanceTotaleStructure(bloc.structure, vmaRef, opts),
      dureeCible: dureeTotaleStructure(bloc.structure, opts)
    }
  }
  return {
    phases: [{ phase: 'travail', duree_s: bloc.duree_s, vitesse_kmh: bloc.allure_kmh }],
    distanceCible: bloc.distance_m,
    dureeCible: bloc.duree_s
  }
}

// Objectifs du bloc tels qu'ils sont réellement courus : sans les récupérations de retour au
// départ (marchées/trottinées librement, hors distance et hors allure).
export function cibleCourue(bloc, niveau, vmaRef) {
  const prep = preparerBloc(bloc, niveau, vmaRef)
  const { segments } = decouperSegments(prep.phases, niveau.retourDepart || 'auto')
  const phases = segments.flatMap((sg) => sg.phases)
  return { phases, distanceCible: distancePhases(phases), dureeCible: dureePhases(phases) }
}

// Déroulement complet d'une séance : Pouls de repos → (choix Échauffement, si activé pour ce
// niveau → Échauffement → Borg) → Pouls avant travail → blocs de Travail (boucle course/bilan
// inchangée) → à la dernière répétition, saisie groupée Pouls/Distance-Temps/Observation/Borg
// (2min30, voir SaisieFinTravail) qui enchaîne directement sur la Récupération de fin de séance
// (une seule phase continue : le temps de cette saisie fait partie de la récupération, ne s'y
// ajoute pas — voir Recuperation/dejaEcouleS) → Borg récup (sauf récup sautée, avec retour arrière
// possible tant que le bilan final n'est pas validé) → Pouls final → annonce de fin → observation
// générale → fiche récapitulative.
// Mode binôme (prop `binome` = { eleve, vma, vmaPorteur, vmaGuidage }) : le guidage se fait sur
// la VMA moyenne des deux élèves ; chaque bloc est ensuite réévalué contre les objectifs
// personnels de chacun (utils/binome.js), le porteur indique après chaque bloc si son binôme est
// resté avec lui, les pouls sont saisis pour les deux à chaque prise, et le binôme renseigne son
// propre Borg et son observation en toute fin de séance.
// modeGuidage : 'gps' | 'bips' | 'mixte' (voir utils/guidage.js). L'élève peut passer en mixte
// en cours de séance (GPS imprécis ou perdu). Chaque bloc est découpé en segments séparés par les
// récupérations de retour au départ ; après chaque segment, l'élève saisit sa distance.
// Réussite déduite des deux critères mesurés, pour une partie interrompue par le professeur (pas
// de bilan déclaratif demandé à l'élève à ce moment-là).
function reussiteMesuree(r) {
  if (r.termine && r.respectAllure) return 'reussi'
  if (r.termine || r.respectAllure) return 'partiel'
  return 'non_reussi'
}

// Arrêt par le professeur (voir utils/arretProf.js) : dès réception de l'ordre, la partie en
// cours s'arrête (objectifs ramenés au temps réellement couru), l'élève saisit sa distance, puis
// un écran annonce l'arrêt avant l'échelle de Borg et l'observation. Seules les parties
// réalisées (terminées, ou interrompue au prorata) entrent dans la note ; les parties non
// courues n'y figurent pas et ne pénalisent pas l'élève.
export default function SeanceRunner({ niveau, vmaRef, binome = null, modeGuidage = 'gps', eleve = null, seanceTitre = '', reprise, onProgress, onFinSeance, onArretSansRealisation, onAbandon }) {
  useWakeLock(true)

  const echauffementActif = !!niveau.echauffement?.active
  const vmaGuidage = binome ? binome.vmaGuidage : vmaRef
  const prenomBinome = binome?.eleve?.prenom

  const [indexBloc, setIndexBloc] = useState(() => reprise?.indexBloc ?? 0)
  const [phase, setPhase] = useState(() => reprise?.phase ?? 'poulsRepos')
  const [resultatsCourseBloc, setResultatsCourseBloc] = useState(() => reprise?.resultatsCourseBloc ?? null)
  const [blocsResultats, setBlocsResultats] = useState(() => reprise?.blocsResultats ?? [])
  const [echauffementChoisi, setEchauffementChoisi] = useState(() => reprise?.echauffementChoisi ?? null)
  const [echauffementResultat, setEchauffementResultat] = useState(() => reprise?.echauffementResultat ?? null)
  const [recuperationResultat, setRecuperationResultat] = useState(() => reprise?.recuperationResultat ?? null)
  const [recuperationSautee, setRecuperationSautee] = useState(() => reprise?.recuperationSautee ?? false)
  const [borgParPhase, setBorgParPhase] = useState(() => reprise?.borgParPhase ?? { echauffement: null, travail: null, recuperation: null })
  const [poulsParPhase, setPoulsParPhase] = useState(() => reprise?.poulsParPhase ?? { repos: null, avantTravail: null, apresTravail: null, final: null })
  const [observationTravail, setObservationTravail] = useState(() => reprise?.observationTravail ?? '')
  const [dejaEcouleRecupS, setDejaEcouleRecupS] = useState(() => reprise?.dejaEcouleRecupS ?? 0)
  // --- Mode binôme ---
  const [blocsResultatsBinome, setBlocsResultatsBinome] = useState(() => reprise?.blocsResultatsBinome ?? [])
  const [poulsBinome, setPoulsBinome] = useState(() => reprise?.poulsBinome ?? { repos: null, avantTravail: null, apresTravail: null, final: null })
  const [bilanBlocEnAttente, setBilanBlocEnAttente] = useState(() => reprise?.bilanBlocEnAttente ?? null)
  const [observationGeneraleEnAttente, setObservationGeneraleEnAttente] = useState(() => reprise?.observationGeneraleEnAttente ?? null)
  const [borgBinome, setBorgBinome] = useState(() => reprise?.borgBinome ?? null)
  // --- Guidage et segments de course ---
  const [modeEffectif, setModeEffectif] = useState(() => reprise?.modeEffectif ?? modeGuidage)
  const [indexSegment, setIndexSegment] = useState(() => reprise?.indexSegment ?? 0)
  const [segmentsResultats, setSegmentsResultats] = useState(() => reprise?.segmentsResultats ?? [])
  const [resultatSegment, setResultatSegment] = useState(() => reprise?.resultatSegment ?? null)
  const [retourFinTs, setRetourFinTs] = useState(() => reprise?.retourFinTs ?? null)
  // Fin (timestamp) de la récupération entre les séries en cours : démarre à la fin de la
  // dernière répétition de la série, avant la saisie de distance et le bilan.
  const [recupInterFinTs, setRecupInterFinTs] = useState(() => reprise?.recupInterFinTs ?? null)
  // --- Arrêt par le professeur ---
  const [debutSeanceTs] = useState(() => reprise?.debutSeanceTs ?? Date.now())
  const [arret, setArret] = useState(() => reprise?.arret ?? null)
  const arretRecu = useArretProf({
    eleve,
    actif: !!eleve,
    debutTs: debutSeanceTs,
    infos: {
      type: 'seance',
      titre: seanceTitre || 'Séance',
      niveauNom: niveau?.nom || '',
      binome: binome?.eleve ? `${binome.eleve.prenom} ${binome.eleve.nom}` : null
    },
    idsSupplementaires: binome?.eleve?.id ? [binome.eleve.id] : []
  })
  const toursEnCoursRef = useRef(reprise?.courseEtat === 'course' ? reprise.toursEnCours || 0 : 0)
  const courseStartTsRef = useRef(reprise?.courseEtat === 'course' ? reprise.courseStartTs : null)
  const [repriseConsommee, setRepriseConsommee] = useState(false)
  // Distance GPS du bloc de course en cours, remontée en continu par CourseRun (voir
  // handleDistanceProgress), pour pouvoir la restaurer si l'appli se ferme en pleine course.
  const distanceBlocEnCoursRef = useRef(
    reprise?.courseEtat === 'course' ? reprise.distanceBlocEnCours || 0 : 0
  )

  function snapshotProgress() {
    return {
      indexBloc,
      phase,
      blocsResultats,
      echauffementChoisi,
      echauffementResultat,
      recuperationResultat,
      recuperationSautee,
      borgParPhase,
      poulsParPhase,
      observationTravail,
      dejaEcouleRecupS,
      resultatsCourseBloc,
      blocsResultatsBinome,
      poulsBinome,
      bilanBlocEnAttente,
      observationGeneraleEnAttente,
      borgBinome,
      modeEffectif,
      indexSegment,
      segmentsResultats,
      resultatSegment,
      retourFinTs,
      recupInterFinTs,
      debutSeanceTs,
      arret,
      toursEnCours: phase === 'course' ? toursEnCoursRef.current : 0,
      courseStartTs: courseStartTsRef.current,
      courseEtat: phase === 'course' ? 'course' : null,
      distanceBlocEnCours: phase === 'course' ? distanceBlocEnCoursRef.current : 0
    }
  }

  useEffect(() => {
    onProgress?.(snapshotProgress())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexBloc, phase, blocsResultats, echauffementChoisi, echauffementResultat, recuperationResultat, recuperationSautee, borgParPhase, poulsParPhase, observationTravail, dejaEcouleRecupS, resultatsCourseBloc, blocsResultatsBinome, poulsBinome, bilanBlocEnAttente, observationGeneraleEnAttente, borgBinome, modeEffectif, indexSegment, segmentsResultats, resultatSegment, retourFinTs, recupInterFinTs, arret])

  function handleCourseDemarre(ts) {
    courseStartTsRef.current = ts
    setRepriseConsommee(true)
  }

  // Remontée régulière (toutes les ~3s, via CourseRun) de la distance du bloc en cours, pour
  // que la sauvegarde de session reste à jour même sans changement de phase entre-temps.
  function handleDistanceProgress(distance, tours) {
    distanceBlocEnCoursRef.current = distance
    toursEnCoursRef.current = tours || 0
    onProgress?.(snapshotProgress())
  }

  const repriseCourseValide =
    !repriseConsommee && phase === 'course' && reprise?.courseEtat === 'course' && reprise.indexBloc === indexBloc &&
    (reprise.indexSegment ?? 0) === indexSegment
  const resumeStartTs = repriseCourseValide ? reprise.courseStartTs : null
  const resumeDistance = repriseCourseValide ? reprise.distanceBlocEnCours || 0 : 0
  const resumeTours = repriseCourseValide ? reprise.toursEnCours || 0 : 0

  const bloc = niveau.blocs[indexBloc]
  const dernierBloc = indexBloc === niveau.blocs.length - 1
  const labelBloc = bloc ? `Partie ${indexBloc + 1}/${niveau.blocs.length} · ${libelleNiveau(niveau.nom)}` : libelleNiveau(niveau.nom)
  const dureeRecupInter = bloc && !dernierBloc ? dureeRecupApresSerie(bloc) : 0
  const optionRetour = niveau.retourDepart || 'auto'
  const retourAvantSerieSuivante =
    dureeRecupInter > 0 && optionRetour !== 'jamais' && (optionRetour === 'toujours' || dureeRecupInter >= SEUIL_RETOUR_DEPART_S)
  const preparation = bloc ? preparerBloc(bloc, niveau, vmaGuidage) : null
  const decoupage = preparation ? decouperSegments(preparation.phases, niveau.retourDepart || 'auto') : { segments: [], retours: [] }
  const nbSegments = decoupage.segments.length
  const segment = decoupage.segments[indexSegment] || decoupage.segments[0]
  const dernierSegment = indexSegment >= nbSegments - 1
  const labelSegment = nbSegments > 1 ? ` · Tronçon ${indexSegment + 1}/${nbSegments}` : ''

  function poulsBinomeSur(cle, valeurBinome) {
    if (binome) setPoulsBinome((p) => ({ ...p, [cle]: valeurBinome ?? null }))
  }

  function handlePoulsRepos(valeur, valeurBinome) {
    setPoulsParPhase((p) => ({ ...p, repos: valeur }))
    poulsBinomeSur('repos', valeurBinome)
    setPhase(echauffementActif ? 'choixEchauffement' : 'poulsAvantTravail')
  }

  function handleChoixEchauffement(choix) {
    setEchauffementChoisi(choix)
    setPhase(choix ? 'echauffement' : 'poulsAvantTravail')
  }

  function handleTermineEchauffement(resultat) {
    setEchauffementResultat(resultat)
    setPhase('borgEchauffement')
  }

  function handleValideBorgEchauffement(valeur) {
    setBorgParPhase((p) => ({ ...p, echauffement: valeur }))
    setPhase('poulsAvantTravail')
  }

  function handlePoulsAvantTravail(valeur, valeurBinome) {
    setPoulsParPhase((p) => ({ ...p, avantTravail: valeur }))
    poulsBinomeSur('avantTravail', valeurBinome)
    setPhase('course')
  }

  function handleTermineBloc(resultatCourse) {
    // Fin d'un segment de course : l'élève saisit sa distance (et, s'il reste une partie à
    // courir, retourne au départ pendant la récupération).
    setResultatSegment(resultatCourse)
    if (arret || resultatCourse?.arretProf) {
      // Partie coupée par le professeur : l'élève saisit la distance courue jusqu'à l'arrêt —
      // sauf s'il venait à peine de partir (rien d'évaluable sur ce tronçon, pas de saisie).
      setRetourFinTs(null)
      setRecupInterFinTs(null)
      if (resultatCourse?.arretProf && (resultatCourse.tronqueS ?? 0) < DUREE_MIN_PARTIE_INTERROMPUE_S) {
        cloturerPartieInterrompue([...segmentsResultats, { ...resultatCourse, distanceDeclaree: 0 }])
        return
      }
      setPhase('saisieDistance')
      return
    }
    if (!dernierSegment) {
      setRetourFinTs(Date.now() + (decoupage.retours[indexSegment]?.duree_s || 0) * 1000)
    } else {
      setRetourFinTs(null)
      // Dernière répétition de la série terminée : la récupération entre les séries démarre
      // maintenant (la récupération de cette dernière répétition n'est pas jouée).
      setRecupInterFinTs(dureeRecupInter > 0 ? Date.now() + dureeRecupInter * 1000 : null)
    }
    setPhase('saisieDistance')
  }

  function handleValideDistance(distanceDeclaree) {
    const complet = { ...resultatSegment, distanceDeclaree }
    const tous = [...segmentsResultats, complet]
    setSegmentsResultats(tous)
    if (arret || complet.arretProf) {
      cloturerPartieInterrompue(tous)
      return
    }
    if (dernierSegment) {
      // Fusion des segments puis réévaluation sur les objectifs réellement courus.
      const fusion = fusionnerSegments(tous, decoupage.segments)
      const cible = cibleCourue(bloc, niveau, vmaGuidage)
      setResultatsCourseBloc(reevaluerBloc(fusion, cible))
      setSegmentsResultats([])
      setResultatSegment(null)
      setIndexSegment(0)
      setPhase('bilanBloc')
    }
  }

  // Objectifs de la portion de partie réellement courue, pour une VMA donnée : tronçons déjà
  // terminés + tronçon interrompu ramené au temps couru (tronqueS).
  function ciblePortionCourue(tous, vma) {
    const prep = preparerBloc(bloc, niveau, vma)
    const { segments } = decouperSegments(prep.phases, niveau.retourDepart || 'auto')
    const segs = segments.slice(0, tous.length).map((sg, i) => {
      const r = tous[i]
      return r?.tronqueS != null ? { phases: tronquerPhases(sg.phases, r.tronqueS) } : sg
    })
    const phases = segs.flatMap((sg) => sg.phases)
    return { segs, cible: { phases, distanceCible: distancePhases(phases), dureeCible: dureePhases(phases) } }
  }

  // Clôture de la partie en cours au moment de l'arrêt : elle est gardée (notée sur la portion
  // courue) si l'élève a couru au moins DUREE_MIN_PARTIE_INTERROMPUE_S, sinon écartée.
  function cloturerPartieInterrompue(tousSegments) {
    let tous = tousSegments
    const dernier = tous[tous.length - 1]
    if (dernier?.tronqueS != null && dernier.tronqueS < DUREE_MIN_PARTIE_INTERROMPUE_S) tous = tous.slice(0, -1)
    setSegmentsResultats([])
    setResultatSegment(null)
    setIndexSegment(0)
    if (!tous.length) {
      setPhase('arretAnnonce')
      return
    }
    const { segs } = ciblePortionCourue(tous, vmaGuidage)
    const fusion = fusionnerSegments(tous, segs)
    const complet = tous.every((r) => r.tronqueS == null) && tous.length === nbSegments
    const extra = { interrompue: !complet, note: complet ? '' : 'Partie interrompue par le professeur' }
    if (binome) {
      const rP = reevaluerBloc(fusion, ciblePortionCourue(tous, binome.vmaPorteur).cible)
      const rB = reevaluerBloc(fusion, ciblePortionCourue(tous, binome.vma).cible)
      setBlocsResultats((prev) => [...prev, { blocId: bloc.id, ...rP, reussite: reussiteMesuree(rP), ...extra }])
      setBlocsResultatsBinome((prev) => [...prev, { blocId: bloc.id, ...rB, binomePresent: true, reussite: reussiteMesuree(rB), ...extra }])
    } else {
      const r = reevaluerBloc(fusion, ciblePortionCourue(tous, vmaGuidage).cible)
      setBlocsResultats((prev) => [...prev, { blocId: bloc.id, ...r, reussite: reussiteMesuree(r), ...extra }])
    }
    setPhase('arretAnnonce')
  }

  // Réception de l'ordre d'arrêt : selon l'étape en cours, on coupe tout de suite ou on laisse
  // finir la saisie en cours (distance, bilan de partie) avant d'annoncer l'arrêt.
  useEffect(() => {
    if (!arretRecu || arret) return
    setArret(arretRecu)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arretRecu])

  useEffect(() => {
    if (!arret) return
    const avantTravail = ['poulsRepos', 'choixEchauffement', 'echauffement', 'borgEchauffement', 'poulsAvantTravail']
    const immediat = ['recupInterSeries', 'finTravail', 'recuperation', 'borgRecuperation', 'poulsFinal', 'finAnnonce']
    if (avantTravail.includes(phase) || immediat.includes(phase)) {
      setRecupInterFinTs(null)
      setPhase('arretAnnonce')
    } else if (phase === 'saisieDistance' && segmentsResultats.length > indexSegment) {
      // Distance du tronçon déjà validée, l'élève attendait de repartir : on clôt la partie.
      cloturerPartieInterrompue(segmentsResultats)
    }
    // 'course' : CourseRun reçoit arretForce et s'arrête de lui-même → saisie de distance.
    // 'saisieDistance' (en cours), 'bilanBloc', 'binomeBloc' : on laisse finir, la suite est
    // interceptée (handleValideDistance / passerAuBlocSuivant).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arret])

  function handleContinuerApresArret() {
    if (!blocsResultats.length) {
      onArretSansRealisation?.(traceArret(arret))
      return
    }
    setPhase('arretBorg')
  }

  function handleValideBorgArret(valeur) {
    setBorgParPhase((p) => ({ ...p, travail: p.travail ?? valeur, recuperation: valeur }))
    setPhase('observation')
  }

  function handleRepartir() {
    setResultatSegment(null)
    setRetourFinTs(null)
    setIndexSegment((i) => i + 1)
    setPhase('course')
  }

  function handleValideBilanBloc({ reussite, note }) {
    if (binome) {
      setBilanBlocEnAttente({ reussite, note })
      setPhase('binomeBloc')
      return
    }
    const blocResultat = { blocId: bloc.id, ...resultatsCourseBloc, reussite, note }
    setBlocsResultats([...blocsResultats, blocResultat])
    passerAuBlocSuivant()
  }

  // Mode binôme : le même résultat mesuré est réévalué contre les objectifs personnels du porteur
  // et du binôme. Si le binôme a décroché, son bloc est non réussi (binomePresent: false).
  function handleValideBinomeBloc({ present, note: noteBinome }) {
    const { reussite, note } = bilanBlocEnAttente || {}
    const pourPorteur = reevaluerBloc(resultatsCourseBloc, cibleCourue(bloc, niveau, binome.vmaPorteur))
    const pourBinome = reevaluerBloc(resultatsCourseBloc, cibleCourue(bloc, niveau, binome.vma))
    setBlocsResultats([...blocsResultats, { blocId: bloc.id, ...pourPorteur, reussite, note }])
    setBlocsResultatsBinome([
      ...blocsResultatsBinome,
      {
        blocId: bloc.id,
        ...pourBinome,
        binomePresent: present,
        reussite: present ? reussite : 'non_reussi',
        note: present ? note : `A décroché du binôme${noteBinome ? ` : ${noteBinome}` : ''}`
      }
    ])
    setBilanBlocEnAttente(null)
    passerAuBlocSuivant()
  }

  function passerAuBlocSuivant() {
    if (arret) {
      setPhase('arretAnnonce')
    } else if (dernierBloc) {
      setPhase('finTravail')
    } else if (recupInterFinTs && recupInterFinTs > Date.now()) {
      setPhase('recupInterSeries')
    } else {
      demarrerSerieSuivante()
    }
  }

  function demarrerSerieSuivante() {
    setRecupInterFinTs(null)
    setIndexBloc((i) => i + 1)
    setPhase('course')
    setResultatsCourseBloc(null)
  }

  // Saisie groupée juste après la dernière répétition de travail (pouls, récap distance/temps
  // déjà mesurés, observation, Borg) — voir SaisieFinTravail. Enchaîne directement sur la
  // récupération de fin de séance, en lui transmettant le temps déjà passé sur cette saisie
  // (dureeEcouleeS) pour qu'elle en fasse partie plutôt que de s'y ajouter.
  function handleValideFinTravail({ pouls, poulsBinome: valeurBinome, observation, borg, dureeEcouleeS }) {
    setPoulsParPhase((p) => ({ ...p, apresTravail: pouls }))
    poulsBinomeSur('apresTravail', valeurBinome)
    setObservationTravail(observation)
    setBorgParPhase((p) => ({ ...p, travail: borg }))
    setDejaEcouleRecupS(dureeEcouleeS)
    setPhase('recuperation')
  }

  function handleTermineRecuperation(resultat) {
    setRecuperationResultat(resultat)
    setRecuperationSautee(false)
    setPhase('borgRecuperation')
  }

  function handlePasserRecuperation() {
    setRecuperationSautee(true)
    setPhase('poulsFinal')
  }

  function handleValideBorgRecuperation(valeur) {
    setBorgParPhase((p) => ({ ...p, recuperation: valeur }))
    setPhase('poulsFinal')
  }

  function handleReprendreRecuperation() {
    setRecuperationSautee(false)
    setRecuperationResultat(null)
    setDejaEcouleRecupS(0)
    setPhase('recuperation')
  }

  function handlePoulsFinal(valeur, valeurBinome) {
    setPoulsParPhase((p) => ({ ...p, final: valeur }))
    poulsBinomeSur('final', valeurBinome)
    setPhase('finAnnonce')
  }

  function handleFinAnnonceTerminee() {
    setPhase('observation')
  }

  function handleValideObservation(observationGenerale) {
    if (binome) {
      setObservationGeneraleEnAttente(observationGenerale)
      setPhase('binomeBorg')
      return
    }
    terminerSeance(observationGenerale, null)
  }

  function handleValideBorgBinome(valeur) {
    setBorgBinome(valeur)
    setPhase('binomeObservation')
  }

  function handleValideObservationBinome(observationBinome) {
    terminerSeance(observationGeneraleEnAttente ?? '', {
      eleve: binome.eleve,
      blocsResultats: blocsResultatsBinome,
      poulsParPhase: poulsBinome,
      borgParPhase: { echauffement: null, travail: null, recuperation: borgBinome },
      borg: borgBinome,
      observationGenerale: observationBinome,
      note: calculerNoteSeance(blocsResultatsBinome)
    })
  }

  function terminerSeance(observationGenerale, resultatBinome) {
    const note = calculerNoteSeance(blocsResultats)
    const infosArret = arret
      ? { arretProf: traceArret(arret), partiesPrevues: niveau.blocs.length, partiesRealisees: blocsResultats.length }
      : {}
    if (resultatBinome && arret) Object.assign(resultatBinome, infosArret)
    onFinSeance({
      ...infosArret,
      blocsResultats,
      echauffementChoisi,
      echauffementResultat,
      recuperationResultat,
      recuperationSautee,
      borgParPhase,
      poulsParPhase,
      observationTravail,
      borg: borgParPhase.recuperation ?? borgParPhase.travail ?? borgParPhase.echauffement ?? null,
      observationGenerale,
      note,
      ...(resultatBinome ? { resultatBinome } : {})
    })
  }

  if (phase === 'poulsRepos') {
    return (
      <PriseDePouls
        titre="Pouls de repos"
        binomeNom={prenomBinome}
        sousTitre="Avant de commencer la séance."
        onValide={handlePoulsRepos}
      />
    )
  }

  if (phase === 'choixEchauffement') {
    return <ChoixEchauffement onChoix={handleChoixEchauffement} />
  }

  if (phase === 'echauffement') {
    return <Echauffement onTermine={handleTermineEchauffement} dureeS={niveau.echauffement?.duree_s} />
  }

  if (phase === 'borgEchauffement') {
    return <BorgScale titre="Ton ressenti après l'échauffement" onValide={handleValideBorgEchauffement} />
  }

  if (phase === 'poulsAvantTravail') {
    return (
      <PriseDePouls
        titre="Pouls avant le travail"
        binomeNom={prenomBinome}
        sousTitre="Juste avant de démarrer la phase de travail."
        onValide={handlePoulsAvantTravail}
      />
    )
  }

  if (phase === 'course') {
    return (
      <CourseRun
        key={`${indexBloc}-${indexSegment}`}
        phases={segment.phases}
        distanceCible={distancePhases(segment.phases)}
        dureeCible={dureePhases(segment.phases)}
        labelBloc={labelBloc + labelSegment}
        labelTerminer={nbSegments > 1 ? 'Terminer ce tronçon' : 'Terminer la partie'}
        modeGuidage={modeEffectif}
        onChangerMode={setModeEffectif}
        resumeTours={resumeTours}
        onTermineBloc={handleTermineBloc}
        onAbandon={onAbandon}
        resumeStartTs={resumeStartTs}
        onDemarre={handleCourseDemarre}
        resumeDistance={resumeDistance}
        onDistanceProgress={handleDistanceProgress}
        arretForce={!!arret}
      />
    )
  }

  if (phase === 'binomeBloc') {
    return <BinomeBloc labelBloc={labelBloc} prenomBinome={prenomBinome} onValide={handleValideBinomeBloc} />
  }

  if (phase === 'binomeBorg') {
    return <BorgScale titre={`Ressenti de ${prenomBinome} sur la séance`} onValide={handleValideBorgBinome} />
  }

  if (phase === 'binomeObservation') {
    return (
      <ObservationFinale
        titre={`Un mot de ${prenomBinome} sur sa séance ?`}
        onValide={handleValideObservationBinome}
      />
    )
  }

  if (phase === 'bilanBloc') {
    return <BilanBloc labelBloc={labelBloc} annonceRetour={!dernierBloc && (dureeRecupInter === 0 || retourAvantSerieSuivante)} recupFinTs={dernierBloc ? null : recupInterFinTs} onValide={handleValideBilanBloc} />
  }

  if (phase === 'recupInterSeries') {
    return (
      <RecupInterSeries
        key={`recup-inter-${indexBloc}`}
        finTs={recupInterFinTs || Date.now()}
        labelSuivante={`Partie ${indexBloc + 2}/${niveau.blocs.length}`}
        vitesseKmh={Math.round((pctVmaRecupApresSerie(bloc) / 100) * (vmaGuidage || 15) * 100) / 100}
        retourDepart={retourAvantSerieSuivante}
        onTermine={demarrerSerieSuivante}
      />
    )
  }

  if (phase === 'arretAnnonce') {
    return (
      <ArretProfAnnonce
        arret={arret}
        nbParties={blocsResultats.length}
        nbPartiesPrevues={niveau.blocs.length}
        onContinuer={handleContinuerApresArret}
      />
    )
  }

  if (phase === 'arretBorg') {
    return <BorgScale titre="Ton ressenti sur ce que tu as couru" onValide={handleValideBorgArret} />
  }

  if (phase === 'saisieDistance') {
    const coupe = !!(arret || resultatSegment?.arretProf)
    return (
      <SaisieDistance
        key={`saisie-${indexBloc}-${indexSegment}`}
        titre={coupe ? 'Séance arrêtée par ton professeur · distance courue' : `${labelBloc}${labelSegment} ${nbSegments > 1 ? 'terminé' : 'terminée'}`}
        dureeCourseS={resultatSegment?.dureeRealisee}
        tours={resultatSegment?.tours || 0}
        retourFinTs={dernierSegment || coupe ? null : retourFinTs}
        libelleSuite="la prochaine répétition"
        distanceInitiale={segmentsResultats.length > indexSegment ? segmentsResultats[indexSegment].distanceDeclaree : null}
        onValide={handleValideDistance}
        onPret={handleRepartir}
      />
    )
  }

  if (phase === 'finTravail') {
    return (
      <SaisieFinTravail
        distanceRealisee={resultatsCourseBloc?.distanceDeclaree ?? resultatsCourseBloc?.distanceRealisee ?? 0}
        dureeRealisee={resultatsCourseBloc?.dureeRealisee ?? 0}
        binomeNom={prenomBinome}
        onValide={handleValideFinTravail}
      />
    )
  }

  if (phase === 'recuperation') {
    return <Recuperation onTermine={handleTermineRecuperation} onPasser={handlePasserRecuperation} dejaEcouleS={dejaEcouleRecupS} dureeS={dureeRecuperationFinale(niveau, RECUPERATION_FIXE.duree_s)} />
  }

  if (phase === 'borgRecuperation') {
    return <BorgScale titre="Ton ressenti après la récupération" onValide={handleValideBorgRecuperation} />
  }

  if (phase === 'poulsFinal') {
    return (
      <PriseDePouls
        titre="Pouls final"
        binomeNom={prenomBinome}
        sousTitre="Pour clore la séance."
        onValide={handlePoulsFinal}
      />
    )
  }

  if (phase === 'finAnnonce') {
    return <FinSeanceAnnonce onTermine={handleFinAnnonceTerminee} />
  }

  return (
    <div>
      {recuperationSautee && (
        <div className="max-w-md mx-auto px-6 pt-6 -mb-2">
          <button onClick={handleReprendreRecuperation} className="text-xs text-piste-500 underline">
            ← Récupération passée par erreur ? Revenir la faire
          </button>
        </div>
      )}
      <ObservationFinale
        onValide={handleValideObservation}
        libelleBouton={binome ? `Continuer : fiche de ${prenomBinome}` : 'Terminer la séance'}
      />
    </div>
  )
}
