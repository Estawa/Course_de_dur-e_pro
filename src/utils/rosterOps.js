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
  // roster. mode "ajouter" : met à jour les élèves déjà présents (par nom/prénom) et ajoute les
  // nouveaux, sans rien supprimer. mode "remplacer" : pour chaque classe présente dans l'import,
  // la liste de la classe est remplacée par le contenu du fichier (les élèves reconnus gardent
  // leur id/pin, ceux absents du fichier sont retirés).
  appliquerImportRoster: (roster, listeEleves, mode = 'ajouter') => {
    const next = { ...(roster || {}) }
    const listeValide = listeEleves.filter((e) => e.classe)

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
        if (!next[classe]) next[classe] = []
        else next[classe] = next[classe].slice()
        const idx = next[classe].findIndex(
          (e) => e.nom.toLowerCase() === nom.toLowerCase() && e.prenom.toLowerCase() === prenom.toLowerCase()
        )
        if (idx !== -1) {
          const existant = next[classe][idx]
          next[classe][idx] = {
            ...existant,
            sexe: sexe || existant.sexe || null,
            classeOrigine: classeOrigine || existant.classeOrigine || null
          }
        } else {
          next[classe].push({ id: idEleve(), nom, prenom, pin: null, sexe: sexe || null, classeOrigine: classeOrigine || null })
        }
      })
    }
    return next
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

  trouverEleve: (roster, classe, eleveId) => ((roster || {})[classe] || []).find((e) => e.id === eleveId) || null,

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
