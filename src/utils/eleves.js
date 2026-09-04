import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// Normalise une chaîne pour la comparaison (accents, casse, espaces)
export function normaliser(str) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function retirerBOM(texte) {
  if (texte.charCodeAt(0) === 0xfeff) return texte.slice(1)
  return texte
}

// Parse n'importe quel fichier (CSV/XLSX/ODS/XLS) et retourne un tableau BRUT de lignes
// (tableaux de cellules texte), sans aucune interprétation des colonnes.
// Gère le BOM UTF-8 et les délimiteurs `;` / `,` / tabulation (exports Pronote notamment).
export async function parserLignesBrutes(file) {
  const nomFichier = file.name.toLowerCase()
  if (nomFichier.endsWith('.csv') || nomFichier.endsWith('.txt') || file.type === 'text/csv') {
    let texte = await file.text()
    texte = retirerBOM(texte).trim()
    const resultat = Papa.parse(texte, { skipEmptyLines: true })
    return resultat.data
      .map((row) => row.map((cell) => (cell ?? '').toString().trim()))
      .filter((row) => row.some((c) => c !== ''))
  }
  const buffer = await file.arrayBuffer()
  const classeur = XLSX.read(buffer, { type: 'array' })
  let toutesLignes = []
  classeur.SheetNames.forEach((nomFeuille) => {
    const feuille = classeur.Sheets[nomFeuille]
    const lignes = XLSX.utils.sheet_to_json(feuille, { header: 1, defval: '' })
    toutesLignes = toutesLignes.concat(lignes.map((row) => row.map((cell) => (cell ?? '').toString().trim())))
  })
  return toutesLignes.filter((row) => row.some((c) => c !== ''))
}

const ALIAS_NOM = ['nom', 'nom de famille', 'lastname', 'last name']
const ALIAS_PRENOM = ['prenom', 'prénom', 'firstname', 'first name']
const ALIAS_CLASSE = ['classe', 'class', 'groupe']
const ALIAS_SEXE = ['sexe', 'genre', 'sex', 'gender']
const ALIAS_NOM_COMPLET = ['eleve', 'eleves', 'élève', 'élèves', 'nom complet', 'nom et prenom', 'nom prenom', 'nom prénom', 'etudiant', 'élèves de la classe']

// Devine un rôle de colonne par défaut à partir de son en-tête (simple suggestion, toujours modifiable)
export function deviverRole(enTete) {
  const c = normaliser(enTete)
  if (ALIAS_NOM.includes(c)) return 'nom'
  if (ALIAS_PRENOM.includes(c)) return 'prenom'
  if (ALIAS_CLASSE.includes(c)) return 'classe'
  if (ALIAS_SEXE.includes(c)) return 'sexe'
  if (ALIAS_NOM_COMPLET.includes(c)) return 'nomComplet'
  return 'ignorer'
}

// Normalise une valeur de sexe en 'F' / 'M', ou renvoie la valeur brute si non reconnue
export function normaliserSexe(valeur) {
  const v = normaliser(valeur)
  if (['f', 'fille', 'femme', 'girl', 'feminin', 'féminin'].includes(v)) return 'F'
  if (['m', 'garcon', 'garçon', 'homme', 'boy', 'masculin'].includes(v)) return 'M'
  return valeur ? valeur.trim() : ''
}

// Sépare "NOM Prénom" (format Pronote : nom de famille en MAJUSCULES) en {nom, prenom}.
// Si aucun motif de majuscules n'est détecté, se rabat sur l'ordre indiqué.
export function separerNomComplet(valeur, ordre = 'nomPrenom') {
  const mots = (valeur || '').trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return { nom: '', prenom: '' }
  if (mots.length === 1) return ordre === 'nomPrenom' ? { nom: mots[0], prenom: '' } : { nom: '', prenom: mots[0] }

  const estMajuscule = (m) => m === m.toLocaleUpperCase('fr-FR') && m !== m.toLocaleLowerCase('fr-FR')
  let i = 0
  while (i < mots.length - 1 && estMajuscule(mots[i])) i++

  if (i > 0) {
    return { nom: mots.slice(0, i).join(' '), prenom: mots.slice(i).join(' ') }
  }
  if (ordre === 'nomPrenom') {
    return { nom: mots[0], prenom: mots.slice(1).join(' ') }
  }
  return { nom: mots.slice(1).join(' '), prenom: mots[0] }
}

// Regroupe une liste plate d'élèves {nom, prenom, classe} par classe
export function regrouperParClasse(listeEleves) {
  const groupes = {}
  listeEleves.forEach((e) => {
    if (!groupes[e.classe]) groupes[e.classe] = []
    groupes[e.classe].push(e)
  })
  return groupes
}
