import * as cloud from './cloud'
import { rosterOps } from './rosterOps'

const KEYS = {
  ELEVE_ACTIF: 'cdp_eleve_actif_v2', // { teacherId, id }
  PIN_OK: 'cdp_pin_ok',
  ROLE_ENSEIGNANT: 'cdp_role_enseignant', // 'admin' | 'collegue'
  NOM_COLLEGUE: 'cdp_nom_collegue',
  TEACHER_ID_ENSEIGNANT: 'cdp_teacher_id_enseignant',
  SESSION_COURS: 'cdp_session_cours'
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// --- Espace actif : les données (roster, séances, réalisations, VMA, visibilité des tests)
// d'UN SEUL enseignant à la fois — le professeur choisi par l'élève en train de se connecter,
// ou l'enseignant/collègue actuellement connecté côté espace enseignant. Chargées une fois
// depuis Firestore via storage.chargerEspace(teacherId), puis tenues à jour en mémoire au fil
// des actions (avec écriture "best effort" vers Firestore à chaque changement). Changer
// d'espace (autre professeur, "Vue globale"...) recharge entièrement ce cache.
let cache = { teacherId: null, roster: {}, seances: [], realisations: [], vma: {}, testsVisibilite: {} }

function idEleve() {
  return crypto.randomUUID ? crypto.randomUUID() : `e_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function persisterRoster(next) {
  cache.roster = next
  cloud.saveRosterTeacher(cache.teacherId, next)
}

// Fusionne deux fiches VMA d'un même élève (par ex. une déjà connue + une retrouvée sous un
// ancien code lors d'une migration) sans jamais perdre d'historique : les deux historiques de
// tests sont concaténés, la VMA "auto" recalculée comme la meilleure valeur sur l'ensemble, la
// VMA manuelle (imposée par le prof) de l'une des deux conservée si l'autre n'en a pas. `a` peut
// être null (rien à fusionner, on renvoie `b` tel quel).
function fusionnerDetailVma(a, b) {
  if (!a) return b
  if (!b) return a
  const historique = [...(a.historique || []), ...(b.historique || [])]
  const meilleurTest = historique
    .filter((h) => h.source === 'test')
    .reduce((max, h) => (max == null || h.valeur > max.valeur ? h : max), null)
  const manuelle = a.manuelle ?? b.manuelle
  const manuelleDate = a.manuelle != null ? a.manuelleDate : b.manuelleDate
  const derniereCourse =
    (b.derniereCourse?.date || 0) > (a.derniereCourse?.date || 0) ? b.derniereCourse : a.derniereCourse
  return {
    manuelle,
    manuelleDate,
    auto: meilleurTest ? meilleurTest.valeur : a.auto ?? b.auto,
    autoDate: meilleurTest ? meilleurTest.date : a.autoDate ?? b.autoDate,
    autoTest: meilleurTest ? meilleurTest.test : a.autoTest ?? b.autoTest,
    derniereCourse: derniereCourse || null,
    historique,
    fartlek: [...(a.fartlek || []), ...(b.fartlek || [])]
  }
}

export const storage = {
  cloudDisponible: () => cloud.cloudDisponible(),

  // --- Accès (admin + collègues) ---
  chargerAcces: (pinAdminParDefaut) => cloud.loadAccesConfig(pinAdminParDefaut),
  sauvegarderAcces: (config) => cloud.saveAccesConfig(config),

  // --- Chargement / état de l'espace actif ---
  espaceCharge: () => cache.teacherId,
  chargerEspace: async (teacherId) => {
    const [roster, seances, realisations, vma, testsVisibilite] = await Promise.all([
      cloud.loadRosterTeacher(teacherId),
      cloud.loadSeancesTeacher(teacherId),
      cloud.loadRealisationsTeacher(teacherId),
      cloud.loadVmaTeacher(teacherId),
      cloud.loadTestsVisibiliteTeacher(teacherId)
    ])
    cache = { teacherId, roster, seances, realisations, vma, testsVisibilite }
    return cache
  },

  // --- Roster (classes + élèves) de l'espace actif ---
  getRoster: () => cache.roster,
  getClasses: () => rosterOps.getClasses(cache.roster),
  getElevesClasse: (classe) => rosterOps.getElevesClasse(cache.roster, classe),

  appliquerImportRoster: (listeEleves, mode = 'ajouter') => {
    const { roster: next, conflits } = rosterOps.appliquerImportRoster(cache.roster, listeEleves, mode)
    persisterRoster(next)
    return conflits
  },

  ajouterEleveManuel: (classe, nom, prenom, sexe = null) => {
    const { roster: next, eleve } = rosterOps.ajouterEleveManuel(cache.roster, classe, nom, prenom, sexe)
    persisterRoster(next)
    return eleve
  },

  ajouterClasse: (classe) => {
    const { roster: next, nom } = rosterOps.ajouterClasse(cache.roster, classe)
    persisterRoster(next)
    return nom
  },

  modifierEleve: (classe, eleveId, patch) => {
    persisterRoster(rosterOps.modifierEleve(cache.roster, classe, eleveId, patch))
    return true
  },

  supprimerEleve: (classe, eleveId) => {
    persisterRoster(rosterOps.supprimerEleve(cache.roster, classe, eleveId))
  },

  supprimerClasse: (classe) => {
    persisterRoster(rosterOps.supprimerClasse(cache.roster, classe))
  },

  reinitialiserPin: (classe, eleveId) => {
    persisterRoster(rosterOps.reinitialiserPin(cache.roster, classe, eleveId))
  },

  deplacerEleve: (classeActuelle, eleveId, nouvelleClasse) => {
    persisterRoster(rosterOps.deplacerEleve(cache.roster, classeActuelle, eleveId, nouvelleClasse))
  },

  trouverEleve: (classe, eleveId) => rosterOps.trouverEleve(cache.roster, classe, eleveId),
  trouverEleveParNom: (nom, prenom) => rosterOps.trouverEleveParNomPartout(cache.roster, nom, prenom),
  trouverEleveParId: (eleveId) => rosterOps.trouverEleveParId(cache.roster, eleveId),

  definirPin: (classe, eleveId, pin) => {
    persisterRoster(rosterOps.definirPin(cache.roster, classe, eleveId, pin))
    return true
  },

  verifierPin: (classe, eleveId, pin) => rosterOps.verifierPin(cache.roster, classe, eleveId, pin),

  // --- Migration depuis l'ancienne version (un seul professeur, "code de synchro") : recopie
  // l'espace lu sous l'ancien code dans l'espace actuellement actif. Un même élève réel a pu
  // exister sous PLUSIEURS anciens codes avec un identifiant différent à chaque fois (typiquement
  // : une fois via saisie libre sur son propre espace isolé, une fois via l'import de classe du
  // prof) — la fusion du roster garde un seul identifiant final par élève (nom+prénom), et
  // retient la correspondance ancien id → id final pour rapatrier SOUS LE BON ÉLÈVE la VMA et les
  // réalisations qui, sinon, resteraient associées à un identifiant abandonné et invisibles nulle
  // part. La VMA est FUSIONNÉE (jamais simplement ignorée si une entrée existe déjà pour cet
  // élève) : tout l'historique de tous les anciens codes est conservé, la meilleure valeur
  // recalculée dessus.
  // IMPORTANT : chaque écriture est attendue avant de continuer — l'appelant recharge l'espace
  // juste après (pour rafraîchir l'écran), et un rechargement lancé avant la fin réelle des
  // écritures verrait une donnée encore absente sur le serveur, l'effaçant du cache local.
  // Retourne un résumé { nbClasses, nbEleves, nbRealisations, nbVma, ... } pour l'écran.
  migrerAncienEspace: async (ancienCode) => {
    const ancien = await cloud.chargerAncienEspace(ancienCode)
    if (!ancien) throw new Error('Connexion à la sauvegarde impossible.')
    if (
      ancien.nbEleves === 0 &&
      ancien.realisations.length === 0 &&
      ancien.seances.length === 0 &&
      Object.keys(ancien.vma).length === 0 &&
      Object.keys(ancien.testsVisibilite).length === 0
    ) {
      throw new Error("Aucune donnée trouvée sous ce code. Vérifie qu'il est correct.")
    }

    // Roster : fusionne par nom+prénom recherché dans TOUTES les classes déjà connues (pas
    // seulement celle indiquée par l'ancien code), pour ne jamais dupliquer un élève déjà placé
    // dans un groupe classe alors que cet ancien code le connaît sous sa classe d'origine. En cas
    // de classe différente, l'élève reste dans sa classe actuelle (jamais déplacé
    // automatiquement) — le conflit est remonté pour vérification.
    const mappingIds = new Map()
    const conflitsClasse = []
    const nextRoster = { ...cache.roster }
    Object.entries(ancien.roster).forEach(([classe, eleves]) => {
      eleves.forEach((e) => {
        const trouve = rosterOps.trouverEleveParNomPartout(nextRoster, e.nom, e.prenom)
        if (trouve) {
          mappingIds.set(e.id, trouve.eleve.id)
          let maj = trouve.eleve
          if (e.sexe && !maj.sexe) maj = { ...maj, sexe: e.sexe }
          if (e.classeOrigine && !maj.classeOrigine) maj = { ...maj, classeOrigine: e.classeOrigine }
          nextRoster[trouve.classe] = nextRoster[trouve.classe].slice()
          nextRoster[trouve.classe][trouve.index] = maj
          if (trouve.classe !== classe) {
            conflitsClasse.push({ nom: e.nom, prenom: e.prenom, classeExistante: trouve.classe, classeAncienCode: classe })
          }
        } else {
          nextRoster[classe] = nextRoster[classe] ? nextRoster[classe].slice() : []
          nextRoster[classe].push(e)
          mappingIds.set(e.id, e.id)
        }
      })
    })
    cache.roster = nextRoster
    await cloud.saveRosterTeacher(cache.teacherId, nextRoster)

    // Séances de bibliothèque et visibilité des tests : n'écrase que si l'espace cible est vide,
    // pour ne pas effacer des séances déjà (re)créées après le passage à la nouvelle version.
    if (cache.seances.length === 0 && ancien.seances.length > 0) {
      cache.seances = ancien.seances
      await cloud.cloudEcrireSeances(cache.teacherId, ancien.seances)
    }
    if (Object.keys(cache.testsVisibilite).length === 0 && Object.keys(ancien.testsVisibilite).length > 0) {
      cache.testsVisibilite = ancien.testsVisibilite
      await cloud.cloudEcrireTestsVisibilite(cache.teacherId, ancien.testsVisibilite)
    }

    // Réalisations : l'élève de chaque réalisation est remappé vers l'id final, puis ajoutées par
    // id de réalisation (jamais de perte, jamais de doublon si la migration est relancée).
    const idsRealisationsExistantes = new Set(cache.realisations.map((r) => r.id))
    const realisationsRemappees = ancien.realisations.map((r) => {
      const idFinal = mappingIds.get(r.eleve.id) || r.eleve.id
      return idFinal === r.eleve.id ? r : { ...r, eleve: { ...r.eleve, id: idFinal } }
    })
    const realisationsAAjouter = realisationsRemappees.filter((r) => !idsRealisationsExistantes.has(r.id))
    cache.realisations = [...cache.realisations, ...realisationsAAjouter]
    await Promise.all(realisationsAAjouter.map((r) => cloud.cloudEcrireRealisation(cache.teacherId, r)))

    // VMA : remappée vers l'id final puis FUSIONNÉE avec ce qui existe déjà pour cet élève
    // (jamais simplement ignorée) — voir fusionnerDetailVma.
    const vmaSuivant = { ...cache.vma }
    Object.entries(ancien.vma).forEach(([cleAncienne, detail]) => {
      const cleFinale = mappingIds.get(cleAncienne) || cleAncienne
      vmaSuivant[cleFinale] = fusionnerDetailVma(vmaSuivant[cleFinale] || null, detail)
    })
    cache.vma = vmaSuivant
    const clesFinalesTouchees = Array.from(new Set(Object.keys(ancien.vma).map((c) => mappingIds.get(c) || c)))
    await Promise.all(clesFinalesTouchees.map((cle) => cloud.cloudEcrireVma(cache.teacherId, cle, vmaSuivant[cle])))

    return {
      nbClasses: ancien.nbClasses,
      nbEleves: ancien.nbEleves,
      nbRealisations: realisationsAAjouter.length,
      nbVma: clesFinalesTouchees.length,
      nbRealisationsTrouvees: ancien.realisations.length,
      nbVmaTrouvees: Object.keys(ancien.vma).length,
      conflitsClasse
    }
  },

  // --- Migration en masse à partir d'une liste explicite de codes (donnée par l'utilisateur,
  // par exemple copiée depuis la console Firebase) — utilisée quand la détection automatique
  // (migrerTousAnciensCodes) ne peut pas lister la collection "profs" elle-même, ce qui arrive si
  // les règles Firestore n'autorisent que la lecture À L'INTÉRIEUR de chaque code, pas le listage
  // de la collection racine. Ignore silencieusement les codes qui sont en fait des teacherId
  // actuels (admin ou un collègue), au cas où ils auraient été collés par erreur.
  migrerPlusieursCodes: async (codes, teacherIdsActuels) => {
    const actuels = new Set(teacherIdsActuels)
    const detail = []
    for (const code of codes) {
      if (actuels.has(code)) continue
      try {
        const res = await storage.migrerAncienEspace(code)
        detail.push({ code, ok: true, ...res })
      } catch (e) {
        detail.push({ code, ok: false, erreur: e.message })
      }
    }
    const total = detail.reduce(
      (acc, d) => (d.ok ? {
        nbClasses: acc.nbClasses + d.nbClasses,
        nbEleves: acc.nbEleves + d.nbEleves,
        nbRealisations: acc.nbRealisations + d.nbRealisations,
        nbVma: acc.nbVma + d.nbVma
      } : acc),
      { nbClasses: 0, nbEleves: 0, nbRealisations: 0, nbVma: 0 }
    )
    const conflits = detail.filter((d) => d.ok).flatMap((d) => d.conflitsClasse || [])
    return { total, detail, nbCodesTraites: detail.length, conflits }
  },

  // --- Migration en masse : liste tous les documents sous "profs" et migre automatiquement
  // ceux qui ne sont pas un teacherId actuel (admin ou l'un des collègues) — c'est-à-dire les
  // anciens codes de synchro périmés, un par appareil qui a fini par générer le sien (typiquement
  // un élève ayant ouvert l'appli sans passer par le flashcode/lien à jour). teacherIdsActuels
  // doit inclure 'admin' et l'id de chaque collègue (accesConfig.collegues). Retourne un résumé
  // global ainsi que le détail par code, pour pouvoir signaler ceux qui ont échoué.
  migrerTousAnciensCodes: async (teacherIdsActuels) => {
    const tousLesCodes = await cloud.listerDocumentsProfs()
    const actuels = new Set(teacherIdsActuels)
    const anciensCodes = tousLesCodes.filter((id) => !actuels.has(id))

    const detail = []
    for (const code of anciensCodes) {
      try {
        const res = await storage.migrerAncienEspace(code)
        detail.push({ code, ok: true, ...res })
      } catch (e) {
        detail.push({ code, ok: false, erreur: e.message })
      }
    }

    const total = detail.reduce(
      (acc, d) => (d.ok ? {
        nbClasses: acc.nbClasses + d.nbClasses,
        nbEleves: acc.nbEleves + d.nbEleves,
        nbRealisations: acc.nbRealisations + d.nbRealisations,
        nbVma: acc.nbVma + d.nbVma
      } : acc),
      { nbClasses: 0, nbEleves: 0, nbRealisations: 0, nbVma: 0 }
    )
    const conflits = detail.filter((d) => d.ok).flatMap((d) => d.conflitsClasse || [])

    return { total, detail, nbCodesTraites: anciensCodes.length, conflits }
  },

  // --- Session élève active (pointeur local : quel prof + quel id, le reste est rechargé
  // depuis le roster de ce prof) ---
  getEleveActifPointeur: () => read(KEYS.ELEVE_ACTIF, null),
  setEleveActifPointeur: (teacherId, id) => write(KEYS.ELEVE_ACTIF, { teacherId, id }),
  clearEleveActif: () => localStorage.removeItem(KEYS.ELEVE_ACTIF),

  // --- Session enseignant active (locale à l'appareil : rôle + identité, pas les données) ---
  getPinOk: () => read(KEYS.PIN_OK, false),
  setPinOk: (val) => write(KEYS.PIN_OK, val),
  getRoleEnseignant: () => read(KEYS.ROLE_ENSEIGNANT, null),
  setRoleEnseignant: (role) => write(KEYS.ROLE_ENSEIGNANT, role),
  getNomCollegue: () => read(KEYS.NOM_COLLEGUE, null),
  setNomCollegue: (nom) => write(KEYS.NOM_COLLEGUE, nom),
  getTeacherIdEnseignant: () => read(KEYS.TEACHER_ID_ENSEIGNANT, null),
  setTeacherIdEnseignant: (id) => write(KEYS.TEACHER_ID_ENSEIGNANT, id),
  clearSessionEnseignant: () => {
    localStorage.removeItem(KEYS.PIN_OK)
    localStorage.removeItem(KEYS.ROLE_ENSEIGNANT)
    localStorage.removeItem(KEYS.NOM_COLLEGUE)
    localStorage.removeItem(KEYS.TEACHER_ID_ENSEIGNANT)
  },

  // --- Séances / réalisations de l'espace actif ---
  getSeances: () => cache.seances,
  setSeances: (seances) => {
    cache.seances = seances
    cloud.cloudEcrireSeances(cache.teacherId, seances)
  },

  getRealisations: () => cache.realisations,
  ajouterRealisation: (realisation) => {
    cache.realisations = [...cache.realisations, realisation]
    cloud.cloudEcrireRealisation(cache.teacherId, realisation)
  },
  modifierRealisation: (id, patch) => {
    cache.realisations = cache.realisations.map((r) => (r.id === id ? { ...r, ...patch } : r))
    const maj = cache.realisations.find((r) => r.id === id)
    if (maj) cloud.cloudEcrireRealisation(cache.teacherId, maj)
    return cache.realisations
  },
  supprimerRealisation: (id) => {
    cache.realisations = cache.realisations.filter((r) => r.id !== id)
    cloud.cloudSupprimerRealisation(cache.teacherId, id)
    return cache.realisations
  },
  supprimerRealisationsEleve: (eleveId, nom, prenom, classe) => {
    const aSupprimer = cache.realisations.filter((r) =>
      eleveId ? r.eleve.id === eleveId : (r.eleve.nom === nom && r.eleve.prenom === prenom && r.eleve.classe === classe)
    )
    cache.realisations = cache.realisations.filter((r) => !aSupprimer.includes(r))
    aSupprimer.forEach((r) => cloud.cloudSupprimerRealisation(cache.teacherId, r.id))
    return cache.realisations
  },
  supprimerRealisationsClasse: (classe) => {
    const aSupprimer = cache.realisations.filter((r) => r.eleve.classe === classe)
    cache.realisations = cache.realisations.filter((r) => r.eleve.classe !== classe)
    aSupprimer.forEach((r) => cloud.cloudSupprimerRealisation(cache.teacherId, r.id))
    return cache.realisations
  },

  cleEleve: (eleve) => (eleve.id ? eleve.id : `${eleve.nom}__${eleve.prenom}__${eleve.classe}`.toLowerCase()),

  // --- VMA de l'espace actif ---
  getVmaDetail: (eleve) => {
    return (
      cache.vma[storage.cleEleve(eleve)] || {
        manuelle: null,
        manuelleDate: null,
        auto: null,
        autoDate: null,
        autoTest: null,
        derniereCourse: null,
        historique: [],
        fartlek: [],
        retenue: null,
        retenueSource: null,
        retenueDate: null
      }
    )
  },
  getVmaRetenue: (eleve) => {
    const d = storage.getVmaDetail(eleve)
    return d.manuelle ?? d.auto ?? null
  },
  getHistoriqueTests: (eleve) => {
    const d = storage.getVmaDetail(eleve)
    return (d.historique || []).filter((h) => h.source === 'test').slice().reverse()
  },
  enregistrerResultatTest: (eleve, vma, test, detailCourse = null) => {
    const cle = storage.cleEleve(eleve)
    const actuel = cache.vma[cle] || { manuelle: null, manuelleDate: null, auto: null, autoDate: null, autoTest: null, historique: [] }
    const date = Date.now()
    actuel.historique = [...(actuel.historique || []), { valeur: vma, date, source: 'test', test, detail: detailCourse }]
    actuel.derniereCourse = detailCourse ? { test, detail: detailCourse, date } : actuel.derniereCourse

    const meilleur = actuel.historique
      .filter((h) => h.source === 'test')
      .reduce((max, h) => (max == null || h.valeur > max.valeur ? h : max), null)
    actuel.auto = meilleur.valeur
    actuel.autoDate = meilleur.date
    actuel.autoTest = meilleur.test

    cache.vma = { ...cache.vma, [cle]: actuel }
    cloud.cloudEcrireVma(cache.teacherId, cle, actuel)
  },
  definirVmaManuelle: (eleve, vma) => {
    const cle = storage.cleEleve(eleve)
    const actuel = cache.vma[cle] || { manuelle: null, manuelleDate: null, auto: null, autoDate: null, autoTest: null, historique: [] }
    actuel.manuelle = vma
    actuel.manuelleDate = Date.now()
    actuel.historique = [...(actuel.historique || []), { valeur: vma, date: Date.now(), source: 'manuel' }]
    cache.vma = { ...cache.vma, [cle]: actuel }
    cloud.cloudEcrireVma(cache.teacherId, cle, actuel)
  },
  effacerVmaManuelle: (eleve) => {
    const cle = storage.cleEleve(eleve)
    if (cache.vma[cle]) {
      const actuel = { ...cache.vma[cle], manuelle: null, manuelleDate: null }
      cache.vma = { ...cache.vma, [cle]: actuel }
      cloud.cloudEcrireVma(cache.teacherId, cle, actuel)
    }
  },

  enregistrerResultatFartlek: (eleve, resultat) => {
    const cle = storage.cleEleve(eleve)
    const actuel = cache.vma[cle] || { manuelle: null, manuelleDate: null, auto: null, autoDate: null, autoTest: null, historique: [], fartlek: [] }
    actuel.fartlek = [...(actuel.fartlek || []), { ...resultat, id: crypto.randomUUID(), date: Date.now() }]
    cache.vma = { ...cache.vma, [cle]: actuel }
    cloud.cloudEcrireVma(cache.teacherId, cle, actuel)
  },
  getHistoriqueFartlek: (eleve) => {
    const d = storage.getVmaDetail(eleve)
    return (d.fartlek || []).slice().reverse()
  },

  // --- Bibliothèque "Tests" (visibilité par classe) de l'espace actif ---
  getTestsVisibilite: () => cache.testsVisibilite,
  setTestVisibilite: (testId, classesVisibles) => {
    cache.testsVisibilite = { ...cache.testsVisibilite, [testId]: { classesVisibles } }
    cloud.cloudEcrireTestsVisibilite(cache.teacherId, cache.testsVisibilite)
  },

  // --- Reprise d'activité en cours : purement locale à l'appareil, jamais synchronisée. ---
  sauvegarderSessionCours: (eleve, type, data) => {
    const all = read(KEYS.SESSION_COURS, {})
    const cle = storage.cleEleve(eleve)
    all[cle] = { ...(all[cle] || {}), [type]: { ...data, savedAt: Date.now() } }
    write(KEYS.SESSION_COURS, all)
  },
  getSessionCours: (eleve, type) => {
    const all = read(KEYS.SESSION_COURS, {})
    return all[storage.cleEleve(eleve)]?.[type] || null
  },
  effacerSessionCours: (eleve, type) => {
    const all = read(KEYS.SESSION_COURS, {})
    const cle = storage.cleEleve(eleve)
    if (all[cle]) {
      delete all[cle][type]
      write(KEYS.SESSION_COURS, all)
    }
  }
}
