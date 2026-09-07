import * as cloud from './cloud'

const KEYS = {
  ELEVE_ACTIF_ID: 'cdp_eleve_actif_id',
  ROSTER: 'cdp_roster_v2',
  ROSTER_LEGACY: 'cdp_roster',
  SEANCES: 'cdp_seances',
  REALISATIONS: 'cdp_realisations',
  PIN_OK: 'cdp_pin_ok',
  VMA: 'cdp_vma_eleves'
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

function idEleve() {
  return crypto.randomUUID ? crypto.randomUUID() : `e_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// --- Migration depuis l'ancien roster (sans id / sans pin) ---
function migrerRosterSiBesoin() {
  const dejaMigre = localStorage.getItem(KEYS.ROSTER)
  if (dejaMigre) return
  const legacy = read(KEYS.ROSTER_LEGACY, null)
  if (!legacy) {
    write(KEYS.ROSTER, {})
    return
  }
  const nouveau = {}
  Object.entries(legacy).forEach(([classe, eleves]) => {
    nouveau[classe] = eleves.map((e) => ({ id: idEleve(), nom: e.nom, prenom: e.prenom, pin: null }))
  })
  write(KEYS.ROSTER, nouveau)
}
migrerRosterSiBesoin()

// --- Migration de la VMA (ancien format : un simple nombre par élève) ---
function migrerVmaSiBesoin() {
  const all = read(KEYS.VMA, {})
  let modifie = false
  Object.keys(all).forEach((cle) => {
    if (typeof all[cle] === 'number') {
      all[cle] = { manuelle: null, manuelleDate: null, auto: all[cle], autoDate: null, autoTest: null, historique: [] }
      modifie = true
    }
  })
  if (modifie) write(KEYS.VMA, all)
}
migrerVmaSiBesoin()

function getRosterBrut() {
  return read(KEYS.ROSTER, {})
}

// --- Fusion des mises à jour reçues du cloud dans le stockage local ---

function fusionnerElevesDepuisCloud(elevesCloud) {
  const idsCloud = new Set(elevesCloud.map((e) => e.id))
  const roster = getRosterBrut()
  const classesVues = new Set()

  elevesCloud.forEach((e) => {
    if (!e.classe) return
    classesVues.add(e.classe)
    if (!roster[e.classe]) roster[e.classe] = []
    const { classe, ...donnees } = e
    const idx = roster[e.classe].findIndex((x) => x.id === e.id)
    if (idx === -1) roster[e.classe].push(donnees)
    else roster[e.classe][idx] = donnees
  })

  // Dans les classes suivies par le cloud, retire les élèves qui n'y existent plus
  // (suppression faite depuis un autre appareil).
  classesVues.forEach((classe) => {
    const idsClasseCloud = new Set(elevesCloud.filter((e) => e.classe === classe).map((e) => e.id))
    roster[classe] = (roster[classe] || []).filter((e) => idsClasseCloud.has(e.id))
    if (roster[classe].length === 0) delete roster[classe]
  })

  // Rattrapage : élèves connus localement (import fait avant l'activation de la synchro
  // sur cet appareil, ou écriture pas encore arrivée) mais absents du cloud → on les pousse,
  // sinon un élève qui ouvre le lien verrait une classe vide.
  Object.entries(roster).forEach(([classe, eleves]) => {
    eleves.forEach((e) => { if (!idsCloud.has(e.id)) cloud.cloudEcrireEleve(classe, e) })
  })

  write(KEYS.ROSTER, roster)
}

function fusionnerRealisationsDepuisCloud(realisationsCloud) {
  const local = read(KEYS.REALISATIONS, [])
  const idsCloud = new Set(realisationsCloud.map((r) => r.id))
  // Réalisations locales pas encore connues du cloud (ex : créées avant l'activation de la
  // synchro sur cet appareil, ou écriture pas encore arrivée) : on les pousse et on les garde.
  const localSeulement = local.filter((r) => !idsCloud.has(r.id))
  localSeulement.forEach((r) => cloud.cloudEcrireRealisation(r))
  write(KEYS.REALISATIONS, [...realisationsCloud, ...localSeulement])
}

function fusionnerVmaDepuisCloud(vmaCloud) {
  const local = read(KEYS.VMA, {})
  Object.entries(vmaCloud).forEach(([cle, detail]) => {
    local[cle] = detail
  })
  // Entrées locales inconnues du cloud (avant activation de la synchro) : on les pousse.
  Object.keys(local).forEach((cle) => {
    if (!(cle in vmaCloud)) cloud.cloudEcrireVma(cle, local[cle])
  })
  write(KEYS.VMA, local)
}

function fusionnerSeancesDepuisCloud(seancesCloud) {
  const local = read(KEYS.SEANCES, [])
  if (seancesCloud.length === 0 && local.length > 0) {
    // Le cloud ne connaît pas encore les séances de ce prof (première activation) : on les pousse.
    cloud.cloudEcrireSeances(local)
    return
  }
  write(KEYS.SEANCES, seancesCloud)
}

export const storage = {
  // --- Synchronisation cloud ---
  cloudDisponible: () => cloud.cloudDisponible(),
  getCodeSync: () => cloud.getCodeSync(),
  assurerCodeSync: () => cloud.assurerCodeSync(),
  appliquerCodeDepuisLien: (code) => cloud.appliquerCodeDepuisLien(code),

  // Démarre l'écoute temps réel (si un code de synchro est actif) : à chaque mise à jour
  // distante, fusionne dans le stockage local puis appelle callback(type) pour que l'UI
  // se rafraîchisse (type ∈ 'eleves' | 'realisations' | 'vma' | 'seances').
  demarrerSynchroCloud: (callback) => {
    return cloud.demarrerSynchro((type, data) => {
      if (type === 'eleves') fusionnerElevesDepuisCloud(data)
      else if (type === 'realisations') fusionnerRealisationsDepuisCloud(data)
      else if (type === 'vma') fusionnerVmaDepuisCloud(data)
      else if (type === 'seances') fusionnerSeancesDepuisCloud(data)
      callback(type)
    })
  },

  // --- Roster (classes + élèves) ---
  getRoster: () => getRosterBrut(),
  getClasses: () => Object.keys(getRosterBrut()).sort(),
  getElevesClasse: (classe) => (getRosterBrut()[classe] || []).slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),

  // Applique une liste plate d'élèves importés {nom, prenom, classe, sexe?} au roster.
  // mode "ajouter" : met à jour les élèves déjà présents (par nom/prénom) et ajoute les nouveaux, sans rien supprimer.
  // mode "remplacer" : pour chaque classe présente dans l'import, la liste de la classe est remplacée par
  // le contenu du fichier (les élèves reconnus gardent leur id/pin, ceux absents du fichier sont retirés).
  appliquerImportRoster: (listeEleves, mode = 'ajouter') => {
    const roster = getRosterBrut()
    const listeValide = listeEleves.filter((e) => e.classe)
    const touches = [] // { classe, eleve }

    if (mode === 'remplacer') {
      const classesConcernees = Array.from(new Set(listeValide.map((e) => e.classe)))
      classesConcernees.forEach((classe) => {
        const importesClasse = listeValide.filter((e) => e.classe === classe)
        const existants = roster[classe] || []
        roster[classe] = importesClasse.map((imp) => {
          const trouve = existants.find(
            (e) => e.nom.toLowerCase() === imp.nom.toLowerCase() && e.prenom.toLowerCase() === imp.prenom.toLowerCase()
          )
          const eleve = trouve ? { ...trouve, sexe: imp.sexe || trouve.sexe || null } : { id: idEleve(), nom: imp.nom, prenom: imp.prenom, pin: null, sexe: imp.sexe || null }
          touches.push({ classe, eleve })
          return eleve
        })
      })
    } else {
      listeValide.forEach(({ nom, prenom, classe, sexe }) => {
        if (!roster[classe]) roster[classe] = []
        const existant = roster[classe].find(
          (e) => e.nom.toLowerCase() === nom.toLowerCase() && e.prenom.toLowerCase() === prenom.toLowerCase()
        )
        if (existant) {
          if (sexe && !existant.sexe) existant.sexe = sexe
          touches.push({ classe, eleve: existant })
        } else {
          const eleve = { id: idEleve(), nom, prenom, pin: null, sexe: sexe || null }
          roster[classe].push(eleve)
          touches.push({ classe, eleve })
        }
      })
    }
    write(KEYS.ROSTER, roster)
    touches.forEach(({ classe, eleve }) => cloud.cloudEcrireEleve(classe, eleve))
  },

  ajouterEleveManuel: (classe, nom, prenom, sexe = null) => {
    const roster = getRosterBrut()
    if (!roster[classe]) roster[classe] = []
    const eleve = { id: idEleve(), nom: nom.trim(), prenom: prenom.trim(), pin: null, sexe: sexe || null }
    roster[classe].push(eleve)
    write(KEYS.ROSTER, roster)
    cloud.cloudEcrireEleve(classe, eleve)
    return eleve
  },

  ajouterClasse: (classe) => {
    const roster = getRosterBrut()
    const nom = classe.trim().toUpperCase()
    if (!roster[nom]) {
      roster[nom] = []
      write(KEYS.ROSTER, roster)
    }
    return nom
  },

  modifierEleve: (classe, eleveId, { nom, prenom, sexe }) => {
    const roster = getRosterBrut()
    const eleve = (roster[classe] || []).find((e) => e.id === eleveId)
    if (eleve) {
      eleve.nom = nom.trim()
      eleve.prenom = prenom.trim()
      if (sexe !== undefined) eleve.sexe = sexe || null
      write(KEYS.ROSTER, roster)
      cloud.cloudEcrireEleve(classe, eleve)
      return true
    }
    return false
  },

  supprimerEleve: (classe, eleveId) => {
    const roster = getRosterBrut()
    if (!roster[classe]) return
    roster[classe] = roster[classe].filter((e) => e.id !== eleveId)
    if (roster[classe].length === 0) delete roster[classe]
    write(KEYS.ROSTER, roster)
    cloud.cloudSupprimerEleve(eleveId)
  },

  supprimerClasse: (classe) => {
    const roster = getRosterBrut()
    const eleves = roster[classe] || []
    delete roster[classe]
    write(KEYS.ROSTER, roster)
    eleves.forEach((e) => cloud.cloudSupprimerEleve(e.id))
  },

  reinitialiserPin: (classe, eleveId) => {
    const roster = getRosterBrut()
    const eleve = (roster[classe] || []).find((e) => e.id === eleveId)
    if (eleve) {
      eleve.pin = null
      write(KEYS.ROSTER, roster)
      cloud.cloudEcrireEleve(classe, eleve)
    }
  },

  trouverEleve: (classe, eleveId) => {
    const roster = getRosterBrut()
    return (roster[classe] || []).find((e) => e.id === eleveId) || null
  },

  definirPin: (classe, eleveId, pin) => {
    const roster = getRosterBrut()
    const eleve = (roster[classe] || []).find((e) => e.id === eleveId)
    if (eleve) {
      eleve.pin = pin
      write(KEYS.ROSTER, roster)
      cloud.cloudEcrireEleve(classe, eleve)
      return true
    }
    return false
  },

  verifierPin: (classe, eleveId, pin) => {
    const eleve = storage.trouverEleve(classe, eleveId)
    return !!eleve && eleve.pin === pin
  },

  // --- Session élève active ---
  getEleveActifId: () => read(KEYS.ELEVE_ACTIF_ID, null),
  setEleveActifId: (id) => write(KEYS.ELEVE_ACTIF_ID, id),
  clearEleveActif: () => localStorage.removeItem(KEYS.ELEVE_ACTIF_ID),

  getEleveActif: () => {
    const id = read(KEYS.ELEVE_ACTIF_ID, null)
    if (!id) return null
    const roster = getRosterBrut()
    for (const classe of Object.keys(roster)) {
      const trouve = roster[classe].find((e) => e.id === id)
      if (trouve) return { id: trouve.id, nom: trouve.nom, prenom: trouve.prenom, classe }
    }
    return null
  },

  // --- Séances / réalisations ---
  getSeances: () => read(KEYS.SEANCES, []),
  setSeances: (seances) => {
    write(KEYS.SEANCES, seances)
    cloud.cloudEcrireSeances(seances)
  },

  getRealisations: () => read(KEYS.REALISATIONS, []),
  ajouterRealisation: (realisation) => {
    const all = read(KEYS.REALISATIONS, [])
    all.push(realisation)
    write(KEYS.REALISATIONS, all)
    cloud.cloudEcrireRealisation(realisation)
  },
  // Met à jour une réalisation déjà enregistrée (ex : ajustement comportement saisi a posteriori par le prof).
  modifierRealisation: (id, patch) => {
    const all = read(KEYS.REALISATIONS, [])
    const idx = all.findIndex((r) => r.id === id)
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...patch }
      write(KEYS.REALISATIONS, all)
      cloud.cloudEcrireRealisation(all[idx])
    }
    return all
  },
  // Supprime une séance réalisée précise (retour d'un élève sur un bloc/niveau donné).
  supprimerRealisation: (id) => {
    const all = read(KEYS.REALISATIONS, [])
    const nouvelles = all.filter((r) => r.id !== id)
    write(KEYS.REALISATIONS, nouvelles)
    cloud.cloudSupprimerRealisation(id)
    return nouvelles
  },
  // Supprime toutes les séances réalisées d'un élève précis (par id si connu, sinon par nom/prénom/classe
  // pour les entrées "orphelines" issues d'anciens formats sans id).
  supprimerRealisationsEleve: (eleveId, nom, prenom, classe) => {
    const all = read(KEYS.REALISATIONS, [])
    const aSupprimer = all.filter((r) =>
      eleveId ? r.eleve.id === eleveId : (r.eleve.nom === nom && r.eleve.prenom === prenom && r.eleve.classe === classe)
    )
    const nouvelles = all.filter((r) => !aSupprimer.includes(r))
    write(KEYS.REALISATIONS, nouvelles)
    aSupprimer.forEach((r) => cloud.cloudSupprimerRealisation(r.id))
    return nouvelles
  },
  // Supprime toutes les séances réalisées d'une classe entière.
  supprimerRealisationsClasse: (classe) => {
    const all = read(KEYS.REALISATIONS, [])
    const aSupprimer = all.filter((r) => r.eleve.classe === classe)
    const nouvelles = all.filter((r) => r.eleve.classe !== classe)
    write(KEYS.REALISATIONS, nouvelles)
    aSupprimer.forEach((r) => cloud.cloudSupprimerRealisation(r.id))
    return nouvelles
  },

  getPinOk: () => read(KEYS.PIN_OK, false),
  setPinOk: (val) => write(KEYS.PIN_OK, val),

  cleEleve: (eleve) => (eleve.id ? eleve.id : `${eleve.nom}__${eleve.prenom}__${eleve.classe}`.toLowerCase()),

  // --- VMA : deux sources possibles (résultat de test auto-enregistré, ou saisie manuelle du prof).
  // La VMA réellement utilisée dans les séances ("retenue") est choisie explicitement par le prof
  // (via activerSourceVma), et ne change jamais toute seule : un nouveau test enregistré met à jour
  // la valeur "auto" affichée, mais ne touche pas à la VMA retenue tant que le prof ne l'a pas validée.
  getVmaDetail: (eleve) => {
    const all = read(KEYS.VMA, {})
    return (
      all[storage.cleEleve(eleve)] || {
        manuelle: null,
        manuelleDate: null,
        auto: null,
        autoDate: null,
        autoTest: null,
        derniereCourse: null,
        historique: [],
        retenue: null,
        retenueSource: null,
        retenueDate: null
      }
    )
  },
  // VMA effectivement utilisée pour les séances. Si le prof n'a jamais fait de choix explicite,
  // on retombe sur l'ancien comportement par défaut (manuelle prioritaire sur auto).
  getVmaRetenue: (eleve) => {
    const d = storage.getVmaDetail(eleve)
    if (d.retenueSource === 'manuelle') return d.manuelle ?? null
    if (d.retenueSource === 'auto') return d.auto ?? null
    return d.manuelle ?? d.auto ?? null
  },
  // Enregistre automatiquement le résultat d'un test réalisé par l'élève (ne touche jamais à la valeur
  // manuelle du prof, ni à la VMA retenue : même si "VMA test" est la source active, il faut que le prof
  // revalide explicitement le nouveau résultat pour qu'il devienne la VMA retenue).
  // detailCourse (optionnel) : le détail brut du test (ex. les 4 distances du 4x3, la distance du Cooper,
  // le palier atteint au Gacon...), conservé pour que le prof puisse le consulter, pas seulement le chiffre final.
  enregistrerResultatTest: (eleve, vma, test, detailCourse = null) => {
    const all = read(KEYS.VMA, {})
    const cle = storage.cleEleve(eleve)
    const actuel = all[cle] || { manuelle: null, manuelleDate: null, auto: null, autoDate: null, autoTest: null, historique: [], retenue: null, retenueSource: null, retenueDate: null }
    actuel.auto = vma
    actuel.autoDate = Date.now()
    actuel.autoTest = test
    actuel.derniereCourse = detailCourse ? { test, detail: detailCourse, date: Date.now() } : actuel.derniereCourse
    actuel.historique = [...(actuel.historique || []), { valeur: vma, date: Date.now(), source: 'test', test }]
    all[cle] = actuel
    write(KEYS.VMA, all)
    cloud.cloudEcrireVma(cle, actuel)
  },
  // Saisie manuelle du prof : devient immédiatement la VMA retenue (action explicite du prof).
  definirVmaManuelle: (eleve, vma) => {
    const all = read(KEYS.VMA, {})
    const cle = storage.cleEleve(eleve)
    const actuel = all[cle] || { manuelle: null, manuelleDate: null, auto: null, autoDate: null, autoTest: null, historique: [], retenue: null, retenueSource: null, retenueDate: null }
    actuel.manuelle = vma
    actuel.manuelleDate = Date.now()
    actuel.retenue = vma
    actuel.retenueSource = 'manuelle'
    actuel.retenueDate = Date.now()
    actuel.historique = [...(actuel.historique || []), { valeur: vma, date: Date.now(), source: 'manuel' }]
    all[cle] = actuel
    write(KEYS.VMA, all)
    cloud.cloudEcrireVma(cle, actuel)
  },
  // Active explicitement une des deux sources ('manuelle' ou 'auto') comme VMA retenue pour les séances.
  // C'est le seul moyen de faire évoluer la VMA retenue vers un nouveau résultat de test.
  activerSourceVma: (eleve, source) => {
    const all = read(KEYS.VMA, {})
    const cle = storage.cleEleve(eleve)
    const actuel = all[cle]
    if (!actuel) return
    const valeur = source === 'manuelle' ? actuel.manuelle : actuel.auto
    if (valeur == null) return
    actuel.retenue = valeur
    actuel.retenueSource = source
    actuel.retenueDate = Date.now()
    all[cle] = actuel
    write(KEYS.VMA, all)
    cloud.cloudEcrireVma(cle, actuel)
  },
  // Efface la valeur manuelle : si elle était la source retenue, la VMA retenue revient au dernier
  // résultat de test enregistré (sinon reste vide).
  effacerVmaManuelle: (eleve) => {
    const all = read(KEYS.VMA, {})
    const cle = storage.cleEleve(eleve)
    if (all[cle]) {
      all[cle].manuelle = null
      all[cle].manuelleDate = null
      if (all[cle].retenueSource === 'manuelle') {
        all[cle].retenue = all[cle].auto ?? null
        all[cle].retenueSource = all[cle].auto != null ? 'auto' : null
        all[cle].retenueDate = Date.now()
      }
      write(KEYS.VMA, all)
      cloud.cloudEcrireVma(cle, all[cle])
    }
  }
}

export const PIN_ENSEIGNANT = '8484'
