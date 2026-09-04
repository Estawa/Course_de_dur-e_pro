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

const ALIAS_NOM = ['nom', 'nom de famille', 'lastname', 'last name']
const ALIAS_PRENOM = ['prenom', 'prénom', 'firstname', 'first name']
const ALIAS_CLASSE = ['classe', 'class', 'groupe']

function detecterColonnes(headerRow) {
  const idx = { nom: -1, prenom: -1, classe: -1 }
  headerRow.forEach((cell, i) => {
    const c = normaliser(cell)
    if (idx.nom === -1 && ALIAS_NOM.includes(c)) idx.nom = i
    else if (idx.prenom === -1 && ALIAS_PRENOM.includes(c)) idx.prenom = i
    else if (idx.classe === -1 && ALIAS_CLASSE.includes(c)) idx.classe = i
  })
  return idx
}

// Transforme un tableau de lignes brutes (tableau de tableaux) en liste d'élèves {nom, prenom, classe}
function lignesVersEleves(rows, classeParDefaut) {
  const rowsUtiles = rows.filter((r) => r.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''))
  if (rowsUtiles.length === 0) return []

  let idx = detecterColonnes(rowsUtiles[0])
  let dataRows = rowsUtiles
  const enTeteDetectee = idx.nom !== -1 || idx.prenom !== -1 || idx.classe !== -1
  if (enTeteDetectee) {
    dataRows = rowsUtiles.slice(1)
  } else {
    // Pas d'en-tête reconnue : on suppose l'ordre Nom, Prénom, [Classe]
    idx = { nom: 0, prenom: 1, classe: rowsUtiles[0].length > 2 ? 2 : -1 }
  }

  const eleves = []
  dataRows.forEach((row) => {
    const nom = idx.nom !== -1 ? String(row[idx.nom] || '').trim() : ''
    const prenom = idx.prenom !== -1 ? String(row[idx.prenom] || '').trim() : ''
    const classe = idx.classe !== -1 ? String(row[idx.classe] || '').trim().toUpperCase() : classeParDefaut
    if (nom && prenom) {
      eleves.push({ nom, prenom, classe: (classe || classeParDefaut || 'CLASSE').toUpperCase() })
    }
  })
  return eleves
}

// Parse un fichier (CSV, XLSX, ODS) et retourne une liste d'élèves {nom, prenom, classe}
export async function parserFichierEleves(file, classeParDefaut) {
  const nomFichier = file.name.toLowerCase()
  if (nomFichier.endsWith('.csv') || file.type === 'text/csv') {
    const texte = await file.text()
    const resultat = Papa.parse(texte.trim(), { skipEmptyLines: true })
    return lignesVersEleves(resultat.data, classeParDefaut)
  }

  // xlsx / ods / xls
  const buffer = await file.arrayBuffer()
  const classeur = XLSX.read(buffer, { type: 'array' })
  let toutesLignes = []
  classeur.SheetNames.forEach((nomFeuille) => {
    const feuille = classeur.Sheets[nomFeuille]
    const lignes = XLSX.utils.sheet_to_json(feuille, { header: 1, defval: '' })
    toutesLignes = toutesLignes.concat(lignes)
  })
  return lignesVersEleves(toutesLignes, classeParDefaut)
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
