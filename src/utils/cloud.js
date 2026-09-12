// Synchronisation cloud (Firestore) entre les appareils des élèves et celui du prof.
//
// Contexte : chaque élève ouvre l'appli sur son PROPRE téléphone (via le flashcode/lien).
// Sans backend partagé, ses données (PIN, séances réalisées, VMA) resteraient enfermées
// sur son appareil et ne remonteraient jamais chez le prof. Ce module ajoute une couche
// de synchronisation par-dessus le stockage local existant (voir storage.js) :
//   - chaque écriture locale est aussi envoyée vers Firestore (best effort, non bloquant)
//   - un "code de synchro" identifie l'espace partagé (équivalent d'une salle de classe
//     virtuelle) ; le prof le génère une fois, et il est embarqué dans le lien/flashcode
//     de partage pour que chaque élève rejoigne automatiquement le même espace
//   - des écouteurs temps réel (onSnapshot) tiennent le stockage local à jour dès qu'un
//     autre appareil écrit quelque chose (nouvel élève, PIN, séance, VMA...)
//
// Pas d'authentification Firebase : le "code" fait office de clé partagée, comme pour
// la synchro d'EPS Pro. Voir les règles Firestore fournies séparément.

import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc, setDoc, getDoc, deleteDoc, getDocs, collection, onSnapshot
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBkvREh1dwRmMZOriWka5rCK9WdER2oJOQ',
  authDomain: 'course-duree-pro.firebaseapp.com',
  projectId: 'course-duree-pro',
  storageBucket: 'course-duree-pro.firebasestorage.app',
  messagingSenderId: '165570802992',
  appId: '1:165570802992:web:5ea14d50283abdbca284f5'
}

// NB : pas de cache persistant (IndexedDB) pour l'instant — souvent restreint en
// navigation privée sur mobile, ce qui peut faire échouer Firestore silencieusement.
// On reviendra sur le mode hors-ligne une fois la synchro de base bien fiable.
let db = null
try {
  const app = initializeApp(firebaseConfig)
  db = getFirestore(app)
} catch (e) {
  // Pas bloquant : l'appli continue de fonctionner en local uniquement.
  console.warn('Firestore indisponible, mode local uniquement.', e)
  db = null
}

export const cloudDisponible = () => !!db

const KEY_CODE = 'cdp_code_sync'

export function getCodeSync() {
  try {
    return localStorage.getItem(KEY_CODE) || ''
  } catch {
    return ''
  }
}

export function definirCodeSync(code) {
  try {
    localStorage.setItem(KEY_CODE, code)
  } catch {
    /* ignore */
  }
}

// Génère (une seule fois) un code de synchro pour ce prof, s'il n'en a pas déjà un.
export function assurerCodeSync() {
  let code = getCodeSync()
  if (!code) {
    code = genererCode()
    definirCodeSync(code)
  }
  return code
}

export function genererCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Appelé au démarrage côté élève si un code est présent dans le lien (?c=XXXXX).
// N'écrase jamais un code déjà enregistré sur l'appareil (pour ne pas déconnecter
// un élève déjà synchronisé sur un autre espace par erreur de lien).
export function appliquerCodeDepuisLien(code) {
  if (code && !getCodeSync()) definirCodeSync(code)
}

function actif() {
  return !!(db && getCodeSync())
}

function colEleves() {
  return collection(db, 'profs', getCodeSync(), 'eleves')
}
function colRealisations() {
  return collection(db, 'profs', getCodeSync(), 'realisations')
}
function colVma() {
  return collection(db, 'profs', getCodeSync(), 'vma')
}
function docSeances() {
  return doc(db, 'profs', getCodeSync(), 'meta', 'seances')
}
function docTestsVisibilite() {
  return doc(db, 'profs', getCodeSync(), 'meta', 'testsVisibilite')
}

// --- Écritures (best effort : jamais bloquantes, jamais d'exception remontée à l'appelant) ---

export function cloudEcrireEleve(classe, eleve) {
  if (!actif()) return
  setDoc(doc(colEleves(), eleve.id), { ...eleve, classe }).catch(() => {})
}

export function cloudSupprimerEleve(eleveId) {
  if (!actif()) return
  deleteDoc(doc(colEleves(), eleveId)).catch(() => {})
}

export function cloudEcrireRealisation(realisation) {
  if (!actif()) return
  setDoc(doc(colRealisations(), realisation.id), realisation).catch(() => {})
}

export function cloudSupprimerRealisation(id) {
  if (!actif()) return
  deleteDoc(doc(colRealisations(), id)).catch(() => {})
}

export function cloudEcrireVma(cle, detail) {
  if (!actif()) return
  setDoc(doc(colVma(), cle), detail).catch(() => {})
}

export function cloudEcrireSeances(seances) {
  if (!actif()) return
  setDoc(docSeances(), { liste: seances }).catch(() => {})
}

export function cloudEcrireTestsVisibilite(visibilite) {
  if (!actif()) return
  setDoc(docTestsVisibilite(), { data: visibilite }).catch(() => {})
}

// --- Lecture initiale (une fois, au démarrage) + écoute temps réel ---
// callback(type, data) est appelé à chaque mise à jour, avec type ∈ 'eleves' | 'realisations' | 'vma' | 'seances'

export function demarrerSynchro(callback) {
  if (!actif()) return () => {}
  const arrets = []

  arrets.push(onSnapshot(colEleves(), (snap) => {
    callback('eleves', snap.docs.map((d) => d.data()))
  }, (err) => console.warn('Synchro élèves indisponible', err)))

  arrets.push(onSnapshot(colRealisations(), (snap) => {
    callback('realisations', snap.docs.map((d) => d.data()))
  }, (err) => console.warn('Synchro séances indisponible', err)))

  arrets.push(onSnapshot(colVma(), (snap) => {
    const all = {}
    snap.docs.forEach((d) => { all[d.id] = d.data() })
    callback('vma', all)
  }, (err) => console.warn('Synchro VMA indisponible', err)))

  arrets.push(onSnapshot(docSeances(), (snap) => {
    callback('seances', snap.exists() ? snap.data().liste || [] : [])
  }, (err) => console.warn('Synchro bibliothèque indisponible', err)))

  arrets.push(onSnapshot(docTestsVisibilite(), (snap) => {
    callback('testsVisibilite', snap.exists() ? snap.data().data || {} : {})
  }, (err) => console.warn('Synchro tests indisponible', err)))

  return () => arrets.forEach((arret) => arret())
}

// --- Accès enseignant (admin + collègues) ---
// Document séparé, non scopé par code de synchro : contient le PIN et le nom de
// l'administrateur, ainsi que la liste des collègues (chacun avec son propre code de
// synchro, qui pointe vers SON espace isolé sous profs/{code}/... — même mécanisme que
// pour l'administrateur, juste un code différent par collègue).
const ACCES_COLLECTION = 'cdp_acces'
const ACCES_DOC_ID = 'config'

function docAcces() {
  return doc(db, ACCES_COLLECTION, ACCES_DOC_ID)
}

// Ne crée jamais le document tout seul (une lecture passive par n'importe quel appareil,
// y compris celui d'un élève, ne doit jamais écrire de valeurs par défaut potentiellement
// fausses) : si le document n'existe pas encore, on renvoie simplement des valeurs par
// défaut en mémoire. Seule une sauvegarde explicite (saveAccesConfig) persiste quoi que ce
// soit, ce qui n'arrive qu'après une authentification réussie côté enseignant.
export async function loadAccesConfig(codeAdminParDefaut) {
  if (!db) {
    return { pinAdmin: '8484', nomAdmin: 'Mr Guilhem', adminCode: codeAdminParDefaut || '', collegues: [] }
  }
  try {
    const snap = await getDoc(docAcces())
    if (snap.exists()) {
      const d = snap.data()
      return {
        pinAdmin: d.pinAdmin || '8484',
        nomAdmin: d.nomAdmin || 'Mr Guilhem',
        adminCode: d.adminCode || codeAdminParDefaut || '',
        collegues: Array.isArray(d.collegues) ? d.collegues : []
      }
    }
  } catch (e) {
    console.warn('Config Accès indisponible, valeurs par défaut utilisées.', e)
  }
  return { pinAdmin: '8484', nomAdmin: 'Mr Guilhem', adminCode: codeAdminParDefaut || '', collegues: [] }
}

export async function saveAccesConfig(config) {
  if (!db) return
  await setDoc(docAcces(), config).catch(() => {})
}
export async function recupererTout() {
  if (!actif()) return null
  const [eleves, realisations, vma] = await Promise.all([
    getDocs(colEleves()),
    getDocs(colRealisations()),
    getDocs(colVma())
  ])
  const vmaMap = {}
  vma.docs.forEach((d) => { vmaMap[d.id] = d.data() })
  return {
    eleves: eleves.docs.map((d) => d.data()),
    realisations: realisations.docs.map((d) => d.data()),
    vma: vmaMap
  }
}
