// Arrêt d'une séance par le professeur (conditions météo, blessure, fin du cours…).
//
// Côté élève : useArretProf() signale la course en cours au professeur (présence "en direct") et
// écoute les ordres d'arrêt de sa classe. Dès qu'un ordre le concerne, il renvoie cet ordre : le
// composant de course s'arrête alors proprement et la séance est notée UNIQUEMENT sur ce qui a
// été réalisé (voir SeanceRunner : parties terminées + partie en cours au prorata du temps couru ;
// les parties non courues ne comptent pas). Un test VMA interrompu est annulé (aucune VMA
// enregistrée), le Fartlek est noté sur la durée effective réellement courue.
//
// Côté professeur : envoyerArret() écrit l'ordre (un ou plusieurs élèves, ou toute la classe),
// après confirmation dans le panneau "En direct".

import { useEffect, useRef, useState } from 'react'
import { cloudEcrireEnCours, cloudMajEnCours, cloudSupprimerEnCours, ecouterArretsClasse, cloudEcrireArret } from './cloud'

export const MOTIFS_ARRET = [
  { id: 'meteo', label: 'Conditions météo' },
  { id: 'blessure', label: 'Blessure / malaise' },
  { id: 'temps', label: 'Fin du temps de cours' },
  { id: 'autre', label: 'Autre raison' }
]

export function libelleMotif(arret) {
  if (!arret) return ''
  const m = MOTIFS_ARRET.find((x) => x.id === arret.motif)
  const base = m ? m.label : 'Arrêt du professeur'
  return arret.precision ? `${base} — ${arret.precision}` : base
}

// Rafraîchissement de la présence et seuils d'affichage côté professeur.
export const HEARTBEAT_MS = 60 * 1000
export const PRESENCE_HORS_LIGNE_MS = 3 * 60 * 1000
export const PRESENCE_EXPIREE_MS = 3 * 60 * 60 * 1000
// Un ordre plus ancien que ça n'est jamais appliqué (sécurité contre les vieux documents).
const ARRET_EXPIRE_MS = 6 * 60 * 60 * 1000

// En dessous de cette durée courue, la partie interrompue n'est pas prise en compte (le prof a
// arrêté juste au départ : il n'y a rien d'évaluable, ce serait pénaliser l'élève).
export const DUREE_MIN_PARTIE_INTERROMPUE_S = 20

// Un ordre concerne une course si elle a démarré avant l'ordre (ou si l'ordre vise exactement
// cette course, identifiée par son heure de départ : protège contre un léger décalage d'horloge
// entre le téléphone du professeur et celui de l'élève).
export function arretConcerne(arret, ids, debutTs) {
  if (!arret || !debutTs) return false
  if (Date.now() - arret.ts > ARRET_EXPIRE_MS) return false
  const vise = arret.cible === 'classe' || (arret.eleveIds || []).some((id) => ids.includes(id))
  if (!vise) return false
  const sessions = arret.sessions || {}
  if (ids.some((id) => sessions[id] != null && sessions[id] === debutTs)) return true
  return arret.ts > debutTs
}

// Hook élève. actif : la course est en cours (présence écrite + écoute). debutTs : heure de
// départ de la course (conservée en cas de reprise). infos : ce qui s'affiche chez le prof.
// idsSupplementaires : autres élèves couverts par cette course (binôme sans téléphone).
export function useArretProf({ eleve, actif, debutTs, infos, idsSupplementaires = [] }) {
  const [arret, setArret] = useState(null)
  const teacherId = eleve?.teacherId
  const eleveId = eleve?.id
  const classe = eleve?.classe
  const infosRef = useRef(infos)
  infosRef.current = infos
  const idsKey = [eleveId, ...idsSupplementaires].filter(Boolean).join('|')

  // Nouvelle course (nouveau départ) : l'ordre éventuellement reçu pour la précédente est oublié.
  useEffect(() => { setArret(null) }, [debutTs])

  // Présence "en direct" + battement de cœur.
  useEffect(() => {
    if (!actif || !teacherId || !eleveId || !debutTs) return
    const base = () => ({
      eleveId,
      nom: eleve.nom,
      prenom: eleve.prenom,
      classe,
      debutTs,
      maj: Date.now(),
      ...(infosRef.current || {})
    })
    cloudEcrireEnCours(teacherId, eleveId, { ...base(), arretRecuTs: null })
    const id = setInterval(() => cloudEcrireEnCours(teacherId, eleveId, base()), HEARTBEAT_MS)
    return () => {
      clearInterval(id)
      cloudSupprimerEnCours(teacherId, eleveId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, teacherId, eleveId, classe, debutTs])

  // Écoute des ordres d'arrêt de la classe.
  useEffect(() => {
    if (!actif || !teacherId || !eleveId || !debutTs) return
    const ids = idsKey.split('|')
    const unsub = ecouterArretsClasse(teacherId, classe, (arrets) => {
      const concernes = arrets.filter((a) => arretConcerne(a, ids, debutTs)).sort((a, b) => a.ts - b.ts)
      if (concernes.length) {
        const a = concernes[0]
        setArret((prev) => prev || a)
        cloudMajEnCours(teacherId, eleveId, { arretRecuTs: Date.now(), arretId: a.id })
      }
    })
    return () => unsub()
  }, [actif, teacherId, eleveId, classe, debutTs, idsKey])

  return arret
}

// Côté professeur. cible 'classe' (toute la classe, y compris les élèves momentanément hors
// réseau, qui le recevront à leur reconnexion) ou 'eleves' (liste d'élèves précis).
// presences : entrées "en direct" connues au moment de l'envoi (pour identifier exactement les
// courses visées).
export async function envoyerArret({ teacherId, classe, cible, eleveIds = [], motif, precision, presences = [], par }) {
  const sessions = {}
  presences.forEach((p) => {
    if (cible === 'classe' || eleveIds.includes(p.eleveId)) sessions[p.eleveId] = p.debutTs
  })
  const arret = {
    id: crypto.randomUUID ? crypto.randomUUID() : `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    classe,
    cible,
    eleveIds: cible === 'classe' ? [] : eleveIds,
    sessions,
    motif,
    precision: precision?.trim() || '',
    par: par || '',
    ts: Date.now()
  }
  const ok = await cloudEcrireArret(teacherId, arret)
  return ok ? arret : null
}

// Trace de l'arrêt enregistrée dans la réalisation (fiche de suivi, export).
export function traceArret(arret) {
  if (!arret) return null
  return { motif: arret.motif, precision: arret.precision || '', ts: arret.ts, par: arret.par || '', cible: arret.cible }
}

// Tronque une liste de phases (travail/récup) aux t premières secondes courues : la dernière
// phase entamée est raccourcie, les suivantes disparaissent. Les objectifs (distance, durée) de
// la partie interrompue sont ainsi ramenés à ce qui a réellement pu être couru.
export function tronquerPhases(phases, t) {
  const res = []
  let reste = Math.max(0, t)
  for (const p of phases) {
    if (reste <= 0) break
    const d = Math.min(reste, p.duree_s || 0)
    if (d > 0) res.push(d < (p.duree_s || 0) ? { ...p, duree_s: Math.max(1, Math.round(d)), tronquee: true } : p)
    reste -= p.duree_s || 0
  }
  return res
}
