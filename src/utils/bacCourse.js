// Note du bac en course de durée (v1.64.0), selon les protocoles du lycée Georges-Brassens
// (référentiels établissement, session 2021). Calcul à part : la note de cycle /20 (moyenne
// des séances) reste calculée comme avant ; les deux sont affichées côte à côte et l'enseignant
// choisit celle qu'il retient.
//
// Épreuve : 3 thèmes du protocole (en plus des thèmes d'entraînement de l'appli), 10 min
// d'échauffement, un coup de sifflet par minute, aller-retour à partir d'une balise, zone de
// passage de 3 à 5 m. Passages hors zone : plus de 12 -> degré 1 ; 9 à 12 -> 2 ; 3 à 8 -> 3 ;
// moins de 3 -> 4 (8 compté au degré 3, la grille donnant « 8 à 12 » et « 3 à 8 »).
//
// BAC GT — AFL 1 /12 = élément 1 « produire » /8 (0-1,75 / 2-3,75 / 4-5,75 / 6-8) + élément 2
//   « analyser » /4 (1 / 2 / 3 / 4). Fil de séquence /8 : AFL 2 + AFL 3 (un rôle : coach OU
//   observateur-collecteur), points fixes.
// BAC PRO — AFLP 1 /7 (0-1 / 1,5-3 / 3,5-5 / 5,5-7) + AFLP 2 /5 (0-0,5 / 1-2 / 2,5-4 / 4,5-5).
//   Fil de séquence /8 : AFLP 3 (retour réflexif) + AFLP 4 (rôles), plages.

export const THEMES_EPREUVE = [
  { id: 'puissance', libelle: 'Puissance aérobie', effet: 'Effort intense, proche de son maximum', pctMin: 100, pctMax: 120, duree: 25 },
  { id: 'capacite', libelle: 'Capacité aérobie', effet: 'Effort soutenu', pctMin: 80, pctMax: 95, duree: 30 },
  { id: 'endurance', libelle: 'Endurance fondamentale', effet: 'Effort modéré mais prolongé', pctMin: 60, pctMax: 75, duree: 35 },
]

// Allures (km/h) d'un thème pour une VMA donnée.
export function allures(theme, vma) {
  if (!theme || !vma) return null
  const r1 = (v) => Math.round(v * 10) / 10
  return { min: r1((vma * theme.pctMin) / 100), max: r1((vma * theme.pctMax) / 100) }
}

export function degreDepuisHorsZone(n) {
  if (n == null) return null
  if (n > 12) return 1
  if (n > 8) return 2
  if (n >= 3) return 3
  return 4
}

export const ELEMENTS = {
  gt: [
    {
      cle: 'e1', titre: 'Élément 1 — Produire : effort adapté à ses ressources et au thème', sur: 8, pas: 0.25, horsZone: true,
      plages: { 1: [0, 1.75], 2: [2, 3.75], 3: [4, 5.75], 4: [6, 8] },
      degres: [
        'Échauffement inexistant ou incohérent ; plus de 12 passages hors zone ; arrêt prématuré ou pas d’adaptation ; principes techniques très peu appliqués.',
        'Échauffement inconsistant ; 8 à 12 passages hors zone ; principes techniques trop peu appliqués ; paramètres incohérents avec le thème.',
        'Échauffement structuré ; engagement réel ; 3 à 8 passages hors zone ; récupérations actives ; paramètres cohérents avec le thème.',
        'Échauffement complet et personnalisé ; engagement maximal ; moins de 3 passages hors zone ; adaptations rapides ; choix individualisé.',
      ],
    },
    {
      cle: 'e2', titre: 'Élément 2 — Analyser ses ressentis et réguler', sur: 4, fixe: [1, 2, 3, 4],
      degres: [
        'Absence de bilan ou bilan parcellaire ; pas d’adaptation ni de perspective ; connaissances inexistantes ou erronées.',
        'Bilan sommaire, analyse évasive ou en décalage avec le réalisé ; pas de perspective ; connaissances parfois erronées.',
        'Bilan réaliste ; régulation et perspectives globales ; quelques connaissances sur l’entraînement.',
        'Bilan expliqué, analyse pertinente et justifiée ; pistes précises ; connaissances élargies (entraînement, diététique, hygiène de vie).',
      ],
    },
  ],
  pro: [
    {
      cle: 'aflp1', titre: 'AFLP 1 — Concevoir et mettre en œuvre un projet d’entraînement', sur: 7, pas: 0.5, horsZone: true,
      plages: { 1: [0, 1], 2: [1.5, 3], 3: [3.5, 5], 4: [5.5, 7] },
      degres: [
        'Pas de projet lié à un mobile ; arrêt prématuré ou pas d’adaptation ; échauffement incohérent ; plus de 12 passages hors zone.',
        'Paramètres incohérents avec le thème ; loin de ses possibilités ; échauffement inconsistant ; 8 à 12 passages hors zone.',
        'Paramètres cohérents (%VMA, durée, séries, récupération) ; engagement réel ; échauffement structuré ; 3 à 8 passages hors zone.',
        'Choix individualisé, aux limites de ses possibilités ; engagement maximal ; échauffement personnalisé ; moins de 3 passages hors zone.',
      ],
    },
    {
      cle: 'aflp2', titre: 'AFLP 2 — Éprouver différentes méthodes d’entraînement', sur: 5, pas: 0.5,
      plages: { 1: [0, 0.5], 2: [1, 2], 3: [2.5, 4], 4: [4.5, 5] },
      degres: [
        'Une seule méthode, mal appliquée ; principes techniques de course et gestion de l’effort pas ou très peu appliqués.',
        'Une seule méthode, appliquée de manière inconstante ; principes techniques trop peu appliqués.',
        'Plusieurs méthodes utilisées dans la séance (continu, intermittent) ; consignes techniques partiellement appliquées.',
        'Plusieurs méthodes utilisées pour optimiser les effets recherchés ; application constante des consignes d’efficacité.',
      ],
    },
  ],
}

export const DEGRES_AFL2_GT = [
  'L’occasionnel : carnet complété seulement s’il y est obligé, oublis ; ne s’engage pas ou peu ; séquence inadaptée ou copiée.',
  'Le consommateur d’entraînement : carnet incomplet ; engagement insuffisant ; projet stéréotypé, incohérences.',
  'Le concepteur débutant : carnet utilisé pour suivre et réguler (prévu / réalisé, ressentis) ; s’engage ; séquences cohérentes.',
  'Le concepteur pertinent : carnet complet, bilan et régulation ; moteur et engagé ; projet personnalisé et justifié.',
]

export const ROLES_AFL3_GT = [
  {
    id: 'coach', libelle: 'Coach',
    degres: [
      'Agit seul ; peu ou pas attentif à l’allure, l’intensité, la respiration ; n’apporte pas de conseils.',
      'Collabore ponctuellement ; partiellement attentif ; conseils surtout d’encouragement.',
      'Disponible et réactif ; attentif à l’observation OU à l’écart allure prévue / réalisée ; commence à aider la régulation.',
      'Conseille à partir d’indicateurs précis ; attentif à l’observation ET à l’écart d’allure ; favorise la régulation in situ.',
    ],
  },
  {
    id: 'observateur', libelle: 'Observateur-collecteur',
    degres: [
      'Peu ou pas attentif ; énormément de fautes dans le relevé.',
      'Partiellement attentif ; plus de 60 % de données satisfaisantes.',
      'Attentif et impliqué ; plus de 80 % de données satisfaisantes.',
      'Très attentif et impliqué ; recueil des données parfait.',
    ],
  },
]

export const DEGRES_PRO_AFLP3 = [
  'Aucun retour réflexif ; ne régule pas sa charge de travail.',
  'Début d’analyse superficiel ; pas de perspective ni d’alternative.',
  'Analyse sa pratique, propose des régulations cohérentes selon quelques indicateurs ; perspectives globales.',
  'Analyse pertinente et justifiée dans la majorité des séances ; régulations liées à des indicateurs précis ; pistes précises.',
]

export const DEGRES_PRO_AFLP4 = [
  'Ne s’investit pas dans les rôles d’observateur-collecteur ou de coach ; agit seul.',
  'S’investit partiellement ; partiellement attentif ; collabore ponctuellement.',
  'S’investit régulièrement ; attentif et impliqué ; aide son partenaire à partir d’indicateurs simples.',
  'S’investit à chaque séance pour faire progresser ses camarades ; conseille à partir d’indicateurs précis.',
]

export const REPARTITIONS = ['6-2', '4-4', '2-6']
export function pointsRepartition(r) {
  return (REPARTITIONS.includes(r) ? r : '4-4').split('-').map(Number)
}
export function pointsFixes(pts, degre) {
  return degre ? (pts * degre) / 4 : null
}
const PLAGES_FIL = {
  2: [[0, 0.4], [0.5, 0.9], [1, 1.4], [1.5, 2]],
  4: [[0, 0.9], [1, 1.9], [2, 2.9], [3, 4]],
  6: [[0, 1.4], [1.5, 2.9], [3, 4.4], [4.5, 6]],
}
export function plageFil(pts, degre) {
  return degre ? PLAGES_FIL[pts]?.[degre - 1] || null : null
}
export function valeurs([min, max], pas) {
  const res = []
  for (let v = min; v <= max + 1e-9; v += pas) res.push(Math.round(v * 100) / 100)
  return res
}

const r2 = (v) => Math.round(v * 100) / 100
const num = (v) => (typeof v === 'number' ? v : null)

export function calculerNoteBacCourse(typeBac, saisie) {
  const s = saisie || {}
  const [pa, pb] = pointsRepartition(s.repartition)
  if (typeBac === 'gt') {
    const e1 = num(s.e1Note)
    const e2 = s.e2Degre ? s.e2Degre : null
    const afl2 = pointsFixes(pa, s.afl2Degre)
    const afl3 = s.afl3Role ? pointsFixes(pb, s.afl3Degre) : null
    const fin = e1 == null && e2 == null ? null : r2((e1 ?? 0) + (e2 ?? 0))
    const fil = afl2 == null && afl3 == null ? null : r2((afl2 ?? 0) + (afl3 ?? 0))
    return { e1, e2, afl2, afl3, fin, fil, pa, pb, total: fin == null && fil == null ? null : r2((fin ?? 0) + (fil ?? 0)) }
  }
  const aflp1 = num(s.aflp1Note), aflp2 = num(s.aflp2Note), aflp3 = num(s.aflp3Note), aflp4 = num(s.aflp4Note)
  const fin = aflp1 == null && aflp2 == null ? null : r2((aflp1 ?? 0) + (aflp2 ?? 0))
  const fil = aflp3 == null && aflp4 == null ? null : r2((aflp3 ?? 0) + (aflp4 ?? 0))
  return { aflp1, aflp2, aflp3, aflp4, fin, fil, pa, pb, total: fin == null && fil == null ? null : r2((fin ?? 0) + (fil ?? 0)) }
}
