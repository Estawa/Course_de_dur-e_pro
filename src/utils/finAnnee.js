import * as cloud from './cloud'

export const CLASSE_INCONNUE = '__sans_classe__'

// Classe d'un élève, de la façon la plus fiable possible : liste de classes (roster) d'abord, puis
// la classe notée dans ses séances, puis celle encodée dans une ancienne clé "nom__prenom__classe".
function indexer({ roster, realisations }) {
  const classeParId = new Map()
  Object.entries(roster || {}).forEach(([classe, eleves]) => eleves.forEach((e) => classeParId.set(e.id, classe)))
  realisations.forEach((r) => {
    if (r.eleve?.id && !classeParId.has(r.eleve.id) && r.eleve.classe != null) classeParId.set(r.eleve.id, r.eleve.classe)
  })
  const classeRealisation = (r) => (r.eleve?.id && classeParId.has(r.eleve.id) ? classeParId.get(r.eleve.id) : r.eleve?.classe ?? CLASSE_INCONNUE)
  const classeVma = (cle) => {
    if (classeParId.has(cle)) return classeParId.get(cle)
    const morceaux = cle.split('__')
    return morceaux.length === 3 ? morceaux[2].toUpperCase() : CLASSE_INCONNUE
  }
  return { classeRealisation, classeVma }
}

// Résumé par classe d'un espace : élèves, séances réalisées, fiches VMA (tests + Fartlek).
export function analyserEspace(data) {
  const { classeRealisation, classeVma } = indexer(data)
  const parClasse = {}
  const ligne = (c) => (parClasse[c] = parClasse[c] || { nom: c, nbEleves: 0, nbSeances: 0, nbFichesVma: 0 })
  Object.entries(data.roster || {}).forEach(([c, eleves]) => { ligne(c).nbEleves = eleves.length })
  data.realisations.forEach((r) => { ligne(classeRealisation(r)).nbSeances++ })
  Object.keys(data.vma).forEach((cle) => { ligne(classeVma(cle)).nbFichesVma++ })
  return Object.values(parClasse).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

// Efface les données élèves des classes choisies dans UN espace. Ne touche jamais à la
// bibliothèque de séances, au barème, à la visibilité des tests ni aux accès.
export async function effacerClasses(teacherId, data, classes) {
  const cibles = new Set(classes)
  const { classeRealisation, classeVma } = indexer(data)
  const realisationsASupprimer = data.realisations.filter((r) => cibles.has(classeRealisation(r)))
  const vmaASupprimer = Object.keys(data.vma).filter((cle) => cibles.has(classeVma(cle)))
  const roster = { ...(data.roster || {}) }
  let nbEleves = 0
  Object.keys(roster).forEach((c) => {
    if (cibles.has(c)) {
      nbEleves += roster[c].length
      delete roster[c]
    }
  })
  const resultats = await Promise.all([
    ...realisationsASupprimer.map((r) => cloud.cloudSupprimerRealisation(teacherId, r.id)),
    ...vmaASupprimer.map((cle) => cloud.cloudSupprimerVma(teacherId, cle)),
    nbEleves > 0 ? cloud.saveRosterTeacher(teacherId, roster) : Promise.resolve(true)
  ])
  return {
    nbEleves,
    nbSeances: realisationsASupprimer.length,
    nbFichesVma: vmaASupprimer.length,
    nbEchecs: resultats.filter((ok) => ok === false).length
  }
}
