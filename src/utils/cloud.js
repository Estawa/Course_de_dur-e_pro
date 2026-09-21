// Synchronisation cloud (Firestore), multi-professeurs.
//
// Chaque enseignant autorisé (l'administrateur = Christophe, ou un collègue ajouté depuis
// l'espace "Accès") a son propre espace de données, isolé des autres, identifié par un
// teacherId stable : 'admin' pour Christophe, ou l'id du collègue (généré une fois à sa
// création et jamais réutilisé, même si son code PIN est réinitialisé ensuite). Un élève
// choisit son professeur dans une liste au moment de se connecter ; ses données rejoignent
// alors l'espace de ce professeur.
//
// Contrairement à l'ancienne version (un seul professeur, code de synchro généré et embarqué
// dans un lien/QR), il n'y a plus aucune valeur à mémoriser sur l'appareil pour choisir le bon
// espace : la sélection se fait à chaque connexion, dans une liste toujours à jour. Ça élimine
// la classe de bugs où un appareil restait bloqué sur un espace périmé.
//
// Pas d'authentification Firebase : les codes PIN (admin + collègues) font office de clé
// partagée, comme pour la synchro des autres applis de Christophe.

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBkvREh1dwRmMZOriWka5rCK9WdER2oJOQ',
  authDomain: 'course-duree-pro.firebaseapp.com',
  projectId: 'course-duree-pro',
  storageBucket: 'course-duree-pro.firebasestorage.app',
  messagingSenderId: '165570802992',
  appId: '1:165570802992:web:5ea14d50283abdbca284f5'
}

let db = null
try {
  const app = initializeApp(firebaseConfig)
  db = getFirestore(app)
} catch (e) {
  console.warn('Firestore indisponible, mode local uniquement.', e)
  db = null
}

export const cloudDisponible = () => !!db

// Nettoie une valeur avant écriture Firestore : passer par JSON retire tous les champs
// `undefined` (Firestore refuse d'écrire un document qui en contient, et échoue alors
// entièrement et silencieusement avec l'ancien code) sans changer le reste de la structure.
// C'est la cause la plus probable des enregistrements qui semblaient réussir (l'écran se
// fermait normalement) mais disparaissaient après une actualisation : l'écriture Firestore
// avait échoué en silence, faute de ce nettoyage.
function nettoyer(valeur) {
  return JSON.parse(JSON.stringify(valeur))
}

// --- Accès (administrateur + collègues) : config unique, partagée par tous les appareils,
// indépendante de tout teacherId puisqu'elle sert justement à définir la liste des teacherId
// valides. ---

export function accesParDefaut(pinAdminParDefaut) {
  return { pinAdmin: pinAdminParDefaut || '8484', nomAdmin: 'Mr Guilhem', collegues: [] }
}

export async function loadAccesConfig(pinAdminParDefaut) {
  if (!db) return accesParDefaut(pinAdminParDefaut)
  try {
    const snap = await getDoc(doc(db, 'cdp_acces', 'config'))
    if (snap.exists()) {
      const d = snap.data()
      return {
        pinAdmin: d.pinAdmin || pinAdminParDefaut || '8484',
        nomAdmin: d.nomAdmin || 'Mr Guilhem',
        collegues: Array.isArray(d.collegues) ? d.collegues : []
      }
    }
  } catch (e) {
    console.warn('Chargement accès impossible', e)
  }
  return accesParDefaut(pinAdminParDefaut)
}

export async function saveAccesConfig(config) {
  if (!db) return false
  return setDoc(doc(db, 'cdp_acces', 'config'), nettoyer(config))
    .then(() => true)
    .catch((e) => { console.warn('Écriture accès impossible', e); return false })
}

// --- Roster (classes + élèves) d'un enseignant : un seul document par teacherId. ---

export async function loadRosterTeacher(teacherId) {
  if (!db) return {}
  try {
    const snap = await getDoc(doc(db, 'profs', teacherId, 'meta', 'roster'))
    return snap.exists() && snap.data().classes ? snap.data().classes : {}
  } catch (e) {
    console.warn('Chargement roster impossible', e)
    return {}
  }
}

export async function saveRosterTeacher(teacherId, roster) {
  if (!db) return false
  return setDoc(doc(db, 'profs', teacherId, 'meta', 'roster'), { classes: nettoyer(roster) })
    .then(() => true)
    .catch((e) => { console.warn('Écriture roster impossible', e); return false })
}

// --- Réalisations (séances/tests réalisés) d'un enseignant : une collection, un document par
// réalisation. ---

function colRealisations(teacherId) {
  return collection(db, 'profs', teacherId, 'realisations')
}

export async function loadRealisationsTeacher(teacherId) {
  if (!db) return []
  try {
    const snap = await getDocs(colRealisations(teacherId))
    return snap.docs.map((d) => d.data())
  } catch (e) {
    console.warn('Chargement réalisations impossible', e)
    return []
  }
}

export function cloudEcrireRealisation(teacherId, realisation) {
  if (!db) return Promise.resolve(false)
  return setDoc(doc(colRealisations(teacherId), realisation.id), nettoyer(realisation))
    .then(() => true)
    .catch((e) => { console.warn('Écriture réalisation impossible', e); return false })
}

export function cloudSupprimerRealisation(teacherId, id) {
  if (!db) return Promise.resolve(false)
  return deleteDoc(doc(colRealisations(teacherId), id))
    .then(() => true)
    .catch((e) => { console.warn('Suppression réalisation impossible', e); return false })
}

// --- VMA (par élève) d'un enseignant : une collection, un document par élève (clé = cleEleve). ---

function colVma(teacherId) {
  return collection(db, 'profs', teacherId, 'vma')
}

export async function loadVmaTeacher(teacherId) {
  if (!db) return {}
  try {
    const snap = await getDocs(colVma(teacherId))
    const all = {}
    snap.docs.forEach((d) => { all[d.id] = d.data() })
    return all
  } catch (e) {
    console.warn('Chargement VMA impossible', e)
    return {}
  }
}

export function cloudEcrireVma(teacherId, cle, detail) {
  if (!db) return Promise.resolve(false)
  return setDoc(doc(colVma(teacherId), cle), nettoyer(detail))
    .then(() => true)
    .catch((e) => { console.warn('Écriture VMA impossible', e); return false })
}

// --- Bibliothèque de séances d'un enseignant : un seul document. ---

export async function loadSeancesTeacher(teacherId) {
  if (!db) return []
  try {
    const snap = await getDoc(doc(db, 'profs', teacherId, 'meta', 'seances'))
    return snap.exists() ? snap.data().liste || [] : []
  } catch (e) {
    console.warn('Chargement séances impossible', e)
    return []
  }
}

export function cloudEcrireSeances(teacherId, seances) {
  if (!db) return Promise.resolve(false)
  return setDoc(doc(db, 'profs', teacherId, 'meta', 'seances'), { liste: nettoyer(seances) })
    .then(() => true)
    .catch((e) => { console.warn('Écriture séances impossible', e); return false })
}

// --- Visibilité des tests VMA/Fartlek d'un enseignant : un seul document. ---

export async function loadTestsVisibiliteTeacher(teacherId) {
  if (!db) return {}
  try {
    const snap = await getDoc(doc(db, 'profs', teacherId, 'meta', 'testsVisibilite'))
    return snap.exists() ? snap.data().data || {} : {}
  } catch (e) {
    console.warn('Chargement visibilité tests impossible', e)
    return {}
  }
}

export function cloudEcrireTestsVisibilite(teacherId, visibilite) {
  if (!db) return Promise.resolve(false)
  return setDoc(doc(db, 'profs', teacherId, 'meta', 'testsVisibilite'), { data: nettoyer(visibilite) })
    .then(() => true)
    .catch((e) => { console.warn('Écriture visibilité tests impossible', e); return false })
}

// --- Barème de la note réelle (pondérations + pénalités, réglables côté enseignant) : un seul
// document, comme testsVisibilite ci-dessus. ---

export async function loadBaremeTeacher(teacherId) {
  if (!db) return null
  try {
    const snap = await getDoc(doc(db, 'profs', teacherId, 'meta', 'bareme'))
    return snap.exists() ? snap.data().data || null : null
  } catch (e) {
    console.warn('Chargement barème impossible', e)
    return null
  }
}

export function cloudEcrireBareme(teacherId, bareme) {
  if (!db) return Promise.resolve(false)
  return setDoc(doc(db, 'profs', teacherId, 'meta', 'bareme'), { data: nettoyer(bareme) })
    .then(() => true)
    .catch((e) => { console.warn('Écriture barème impossible', e); return false })
}

// --- Migration depuis l'ancienne version (un seul professeur, "code de synchro" au lieu d'un
// teacherId) : lit l'espace tel qu'il existait sous profs/{ancienCode}/... et le renvoie dans
// le même format que loadRosterTeacher/loadRealisationsTeacher/etc., pour qu'il puisse être
// réécrit tel quel sous le nouveau teacherId (voir storage.migrerAncienEspace). Purement une
// lecture : ne touche à rien sous l'ancien code. ---
export async function chargerAncienEspace(ancienCode) {
  if (!db || !ancienCode) return null
  const [elevesSnap, realisationsSnap, vmaSnap, seancesSnap, testsSnap] = await Promise.all([
    getDocs(collection(db, 'profs', ancienCode, 'eleves')),
    getDocs(collection(db, 'profs', ancienCode, 'realisations')),
    getDocs(collection(db, 'profs', ancienCode, 'vma')),
    getDoc(doc(db, 'profs', ancienCode, 'meta', 'seances')),
    getDoc(doc(db, 'profs', ancienCode, 'meta', 'testsVisibilite'))
  ])

  // Les anciens documents élève portaient leur classe en propriété ("classe") ; le nouveau
  // roster les regroupe par classe (comme storage.getElevesClasse le lit déjà).
  const roster = {}
  elevesSnap.docs.forEach((d) => {
    const { classe, ...eleve } = d.data()
    if (!classe) return
    if (!roster[classe]) roster[classe] = []
    roster[classe].push(eleve)
  })

  const vma = {}
  vmaSnap.docs.forEach((d) => { vma[d.id] = d.data() })

  return {
    roster,
    realisations: realisationsSnap.docs.map((d) => d.data()),
    vma,
    seances: seancesSnap.exists() ? seancesSnap.data().liste || [] : [],
    testsVisibilite: testsSnap.exists() ? testsSnap.data().data || {} : {},
    nbEleves: elevesSnap.docs.length,
    nbClasses: Object.keys(roster).length
  }
}

// Liste tous les identifiants de documents présents sous la collection racine "profs" — mélange
// des teacherId actuels (admin, collègues) et d'éventuels anciens codes de synchro périmés
// (appareils qui ont générés leur propre espace isolé avant la migration). Sert uniquement à
// l'outil "Tout migrer d'un coup" : le tri (lequel est un ancien code, lequel est un teacherId
// actuel) est fait côté storage.js à partir de la config d'accès.
export async function listerDocumentsProfs() {
  if (!db) return []
  try {
    const snap = await getDocs(collection(db, 'profs'))
    return snap.docs.map((d) => d.id)
  } catch (e) {
    console.warn('Listage des espaces profs impossible', e)
    return []
  }
}
