// Fonctions pures de manipulation d'un roster { classe: [eleves] }. Un roster appartient
// toujours à un seul enseignant (teacherId) : chargé/sauvegardé via loadRosterTeacher /
// saveRosterTeacher (cloud.js). Chaque fonction reçoit le roster courant et renvoie le
// nouveau roster (ou une valeur dérivée), sans jamais modifier l'objet reçu en argument.

function idEleve() {
  return crypto.randomUUID ? crypto.randomUUID() : `e_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export const rosterOps = {
  getClasses: (roster) => Object.keys(roster || {}).sort(),
  getElevesClasse: (roster, classe) => ((roster || {})[classe] || []).slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),

  // Applique une liste plate d'élèves importés {nom, prenom, classe, sexe?, classeOrigine?} au
  // roster. mode "ajouter" : met à jour les élèves déjà présents (recherchés par nom/prénom dans
  // TOUTES les classes, pas seulement celle du fichier — pour ne jamais dupliquer un élève déjà
  // placé dans un groupe classe alors que le fichier le indique sous sa classe d'origine) et
  // ajoute les nouveaux, sans rien supprimer. mode "remplacer" : pour chaque classe présente dans
  // l'import, la liste de la classe est remplacée par le contenu du fichier (les élèves reconnus
  // gardent leur id/pin, ceux absents du fichier sont retirés).
  // Renvoie { roster, conflits } : conflits liste les élèves retrouvés sous une classe différente
  // de celle du fichier (ils restent dans leur classe actuelle, jamais déplacés automatiquement —
  // seulement sexe/classeOrigine complétés si absents), à corriger manuellement si besoin.
  appliquerImportRoster: (roster, listeEleves, mode = 'ajouter') => {
    const next = { ...(roster || {}) }
    const listeValide = listeEleves.filter((e) => e.classe)
    const conflits = []

    if (mode === 'remplacer') {
      const classesConcernees = Array.from(new Set(listeValide.map((e) => e.classe)))
      classesConcernees.forEach((classe) => {
        const importesClasse = listeValide.filter((e) => e.classe === classe)
        const existants = next[classe] || []
        next[classe] = importesClasse.map((imp) => {
          const trouve = existants.find(
            (e) => e.nom.toLowerCase() === imp.nom.toLowerCase() && e.prenom.toLowerCase() === imp.prenom.toLowerCase()
          )
          if (trouve) {
            return {
              ...trouve,
              sexe: imp.sexe || trouve.sexe || null,
              classeOrigine: imp.classeOrigine || trouve.classeOrigine || null
            }
          }
          return { id: idEleve(), nom: imp.nom, prenom: imp.prenom, pin: null, sexe: imp.sexe || null, classeOrigine: imp.classeOrigine || null }
        })
      })
    } else {
      listeValide.forEach(({ nom, prenom, classe, sexe, classeOrigine }) => {
        const trouve = rosterOps.trouverEleveParNomPartout(next, nom, prenom)
        if (trouve) {
          let maj = trouve.eleve
          if (sexe && !maj.sexe) maj = { ...maj, sexe }
          if (classeOrigine && !maj.classeOrigine) maj = { ...maj, classeOrigine }
          next[trouve.classe] = next[trouve.classe].slice()
          next[trouve.classe][trouve.index] = maj
          if (trouve.classe !== classe) {
            conflits.push({ nom, prenom, classeExistante: trouve.classe, classeFichier: classe })
          }
        } else {
          if (!next[classe]) next[classe] = []
          else next[classe] = next[classe].slice()
          next[classe].push({ id: idEleve(), nom, prenom, pin: null, sexe: sexe || null, classeOrigine: classeOrigine || null })
        }
      })
    }
    return { roster: next, conflits }
  },

  ajouterEleveManuel: (roster, classe, nom, prenom, sexe = null) => {
    const eleve = { id: idEleve(), nom: nom.trim(), prenom: prenom.trim(), pin: null, sexe: sexe || null, classeOrigine: null }
    const next = { ...(roster || {}) }
    next[classe] = [...(next[classe] || []), eleve]
    return { roster: next, eleve }
  },

  ajouterClasse: (roster, classe) => {
    const nom = classe.trim().toUpperCase()
    const next = { ...(roster || {}) }
    if (!next[nom]) next[nom] = []
    return { roster: next, nom }
  },

  modifierEleve: (roster, classe, eleveId, { nom, prenom, sexe }) => {
    const next = { ...(roster || {}) }
    next[classe] = (next[classe] || []).map((e) => {
      if (e.id !== eleveId) return e
      return { ...e, nom: nom.trim(), prenom: prenom.trim(), sexe: sexe !== undefined ? sexe || null : e.sexe }
    })
    return next
  },

  supprimerEleve: (roster, classe, eleveId) => {
    const next = { ...(roster || {}) }
    if (!next[classe]) return next
    next[classe] = next[classe].filter((e) => e.id !== eleveId)
    if (next[classe].length === 0) delete next[classe]
    return next
  },

  supprimerClasse: (roster, classe) => {
    const next = { ...(roster || {}) }
    delete next[classe]
    return next
  },

  reinitialiserPin: (roster, classe, eleveId) => {
    const next = { ...(roster || {}) }
    next[classe] = (next[classe] || []).map((e) => (e.id === eleveId ? { ...e, pin: null } : e))
    return next
  },

  // Déplace un élève d'une classe vers une autre en conservant son identifiant (donc son PIN,
  // sa VMA et ses séances réalisées, qui sont indexées par id, pas par classe) — c'est le seul
  // moyen sûr de corriger un élève placé au mauvais endroit ; le supprimer puis le recréer
  // casserait le lien avec son historique.
  deplacerEleve: (roster, classeActuelle, eleveId, nouvelleClasse) => {
    const next = { ...(roster || {}) }
    const eleve = (next[classeActuelle] || []).find((e) => e.id === eleveId)
    if (!eleve) return next
    next[classeActuelle] = next[classeActuelle].filter((e) => e.id !== eleveId)
    if (next[classeActuelle].length === 0) delete next[classeActuelle]
    const nom = nouvelleClasse.trim().toUpperCase()
    next[nom] = [...(next[nom] || []), eleve]
    return next
  },

  trouverEleve: (roster, classe, eleveId) => ((roster || {})[classe] || []).find((e) => e.id === eleveId) || null,

  // Cherche un élève par nom+prénom dans TOUTES les classes du roster (pas seulement une classe
  // précise) — sert à ne jamais créer de doublon quand le même élève est repéré sous un nom de
  // classe différent d'un import/ancien code à l'autre (ex. classe d'origine vs groupe classe).
  // Renvoie { classe, index, eleve } ou null.
  trouverEleveParNomPartout: (roster, nom, prenom) => {
    const n = nom.trim().toLowerCase()
    const p = prenom.trim().toLowerCase()
    for (const classe of Object.keys(roster || {})) {
      const index = (roster[classe] || []).findIndex((e) => e.nom.toLowerCase() === n && e.prenom.toLowerCase() === p)
      if (index !== -1) return { classe, index, eleve: roster[classe][index] }
    }
    return null
  },

  // Cherche un élève par son id dans tout le roster (toutes classes), sans connaître sa classe
  // à l'avance — utilisé pour retrouver la fiche d'un élève déjà connecté sur l'appareil.
  trouverEleveParId: (roster, eleveId) => {
    for (const classe of Object.keys(roster || {})) {
      const trouve = (roster[classe] || []).find((e) => e.id === eleveId)
      if (trouve) return { ...trouve, classe }
    }
    return null
  },

  definirPin: (roster, classe, eleveId, pin) => {
    const next = { ...(roster || {}) }
    next[classe] = (next[classe] || []).map((e) => (e.id === eleveId ? { ...e, pin } : e))
    return next
  },

  verifierPin: (roster, classe, eleveId, pin) => {
    const eleve = rosterOps.trouverEleve(roster, classe, eleveId)
    return !!eleve && eleve.pin === pin
  }
}
