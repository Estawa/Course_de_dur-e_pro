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

function getRosterBrut() {
  return read(KEYS.ROSTER, {})
}

export const storage = {
  // --- Roster (classes + élèves) ---
  getRoster: () => getRosterBrut(),
  getClasses: () => Object.keys(getRosterBrut()).sort(),
  getElevesClasse: (classe) => (getRosterBrut()[classe] || []).slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),

  // Fusionne une liste plate {nom, prenom, classe} dans le roster, en conservant id/pin existants
  fusionnerRoster: (listeEleves) => {
    const roster = getRosterBrut()
    listeEleves.forEach(({ nom, prenom, classe }) => {
      if (!roster[classe]) roster[classe] = []
      const existe = roster[classe].some(
        (e) => e.nom.toLowerCase() === nom.toLowerCase() && e.prenom.toLowerCase() === prenom.toLowerCase()
      )
      if (!existe) roster[classe].push({ id: idEleve(), nom, prenom, pin: null })
    })
    write(KEYS.ROSTER, roster)
    return roster
  },

  ajouterEleveManuel: (classe, nom, prenom) => {
    const roster = getRosterBrut()
    if (!roster[classe]) roster[classe] = []
    const eleve = { id: idEleve(), nom: nom.trim(), prenom: prenom.trim(), pin: null }
    roster[classe].push(eleve)
    write(KEYS.ROSTER, roster)
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

  modifierEleve: (classe, eleveId, { nom, prenom }) => {
    const roster = getRosterBrut()
    const eleve = (roster[classe] || []).find((e) => e.id === eleveId)
    if (eleve) {
      eleve.nom = nom.trim()
      eleve.prenom = prenom.trim()
      write(KEYS.ROSTER, roster)
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
  },

  supprimerClasse: (classe) => {
    const roster = getRosterBrut()
    delete roster[classe]
    write(KEYS.ROSTER, roster)
  },

  reinitialiserPin: (classe, eleveId) => {
    const roster = getRosterBrut()
    const eleve = (roster[classe] || []).find((e) => e.id === eleveId)
    if (eleve) {
      eleve.pin = null
      write(KEYS.ROSTER, roster)
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
  setSeances: (seances) => write(KEYS.SEANCES, seances),

  getRealisations: () => read(KEYS.REALISATIONS, []),
  ajouterRealisation: (realisation) => {
    const all = read(KEYS.REALISATIONS, [])
    all.push(realisation)
    write(KEYS.REALISATIONS, all)
  },

  getPinOk: () => read(KEYS.PIN_OK, false),
  setPinOk: (val) => write(KEYS.PIN_OK, val),

  cleEleve: (eleve) => (eleve.id ? eleve.id : `${eleve.nom}__${eleve.prenom}__${eleve.classe}`.toLowerCase()),
  getVma: (eleve) => {
    const all = read(KEYS.VMA, {})
    return all[storage.cleEleve(eleve)] || null
  },
  setVma: (eleve, vma) => {
    const all = read(KEYS.VMA, {})
    all[storage.cleEleve(eleve)] = vma
    write(KEYS.VMA, all)
  }
}

export const PIN_ENSEIGNANT = '8484'
