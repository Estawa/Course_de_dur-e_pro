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
    persisterRoster(rosterOps.appliquerImportRoster(cache.roster, listeEleves, mode))
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

  trouverEleve: (classe, eleveId) => rosterOps.trouverEleve(cache.roster, classe, eleveId),
  trouverEleveParId: (eleveId) => rosterOps.trouverEleveParId(cache.roster, eleveId),

  definirPin: (classe, eleveId, pin) => {
    persisterRoster(rosterOps.definirPin(cache.roster, classe, eleveId, pin))
    return true
  },

  verifierPin: (classe, eleveId, pin) => rosterOps.verifierPin(cache.roster, classe, eleveId, pin),

  // --- Migration depuis l'ancienne version (un seul professeur, "code de synchro") : recopie
  // l'espace lu sous l'ancien code dans l'espace actuellement actif (fusion avec ce qui y existe
  // déjà — les classes/élèves de même nom+prénom sont mis à jour plutôt que dupliqués, les
  // réalisations et VMA s'ajoutent par id sans écraser ce qui ne vient pas de l'ancien espace).
  // IMPORTANT : chaque écriture est attendue avant de continuer — l'appelant recharge l'espace
  // juste après (pour rafraîchir l'écran), et un rechargement lancé avant la fin réelle des
  // écritures verrait une donnée encore absente sur le serveur, l'effaçant du cache local.
  // Retourne un résumé { nbClasses, nbEleves, nbRealisations, nbVma } pour confirmation à l'écran.
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

    // Roster : fusionne classe par classe (même logique que l'import CSV en mode "ajouter"),
    // pour ne pas dupliquer un élève déjà recréé manuellement dans l'espace cible entretemps.
    const listeAncienneAPlat = []
    Object.entries(ancien.roster).forEach(([classe, eleves]) => {
      eleves.forEach((e) => listeAncienneAPlat.push({ ...e, classe }))
    })
    const rosterFusionne = rosterOps.appliquerImportRoster(cache.roster, listeAncienneAPlat, 'ajouter')
    cache.roster = rosterFusionne
    await cloud.saveRosterTeacher(cache.teacherId, rosterFusionne)

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

    // Réalisations et VMA : ajoutées par id (jamais de perte, jamais de doublon si la migration
    // est relancée).
    const idsRealisationsExistantes = new Set(cache.realisations.map((r) => r.id))
    const realisationsAAjouter = ancien.realisations.filter((r) => !idsRealisationsExistantes.has(r.id))
    cache.realisations = [...cache.realisations, ...realisationsAAjouter]
    await Promise.all(realisationsAAjouter.map((r) => cloud.cloudEcrireRealisation(cache.teacherId, r)))

    const clesVmaExistantes = new Set(Object.keys(cache.vma))
    const clesVmaAAjouter = Object.keys(ancien.vma).filter((cle) => !clesVmaExistantes.has(cle))
    cache.vma = { ...ancien.vma, ...cache.vma }
    await Promise.all(clesVmaAAjouter.map((cle) => cloud.cloudEcrireVma(cache.teacherId, cle, ancien.vma[cle])))

    return {
      nbClasses: ancien.nbClasses,
      nbEleves: ancien.nbEleves,
      nbRealisations: realisationsAAjouter.length,
      nbVma: clesVmaAAjouter.length
    }
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

    return { total, detail, nbCodesTraites: anciensCodes.length }
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
