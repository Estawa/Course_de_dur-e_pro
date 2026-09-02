const KEYS = {
  ELEVE: 'cdp_eleve_courant',
  ROSTER: 'cdp_roster',
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

export const storage = {
  getEleve: () => read(KEYS.ELEVE, null),
  setEleve: (eleve) => write(KEYS.ELEVE, eleve),
  clearEleve: () => localStorage.removeItem(KEYS.ELEVE),

  getRoster: () => read(KEYS.ROSTER, {}),
  ajouterEleveAuRoster: (eleve) => {
    const roster = read(KEYS.ROSTER, {})
    const classe = eleve.classe
    if (!roster[classe]) roster[classe] = []
    const existe = roster[classe].some(
      (e) => e.nom.toLowerCase() === eleve.nom.toLowerCase() && e.prenom.toLowerCase() === eleve.prenom.toLowerCase()
    )
    if (!existe) roster[classe].push({ nom: eleve.nom, prenom: eleve.prenom })
    write(KEYS.ROSTER, roster)
  },

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

  cleEleve: (eleve) => `${eleve.nom}__${eleve.prenom}__${eleve.classe}`.toLowerCase(),
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

export const PIN_ENSEIGNANT = '2024'
