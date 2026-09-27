import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import SelecteurDuree from './SelecteurDuree'
import ListeSeries, { serieSimpleVide } from './ListeSeries'
import { libelleNiveau } from '../utils/niveauLabels'
import { totauxNiveau, structureVide as structureVideCompat } from '../utils/fullpower'
import { formatDuree } from '../utils/calc'
import { RECUPERATION_FIXE } from '../utils/phasesFixes'
import { MODES_GUIDAGE, OPTIONS_RETOUR_DEPART } from '../utils/guidage'

const NOMS_NIVEAUX = ['Facile', 'Moyen', 'Difficile']

function echauffementVide() {
  return { active: false, duree_s: 300 }
}

function niveauVide(nom) {
  return { id: crypto.randomUUID(), nom, visible: true, echauffement: echauffementVide(), blocs: [serieSimpleVide(), serieSimpleVide(), serieSimpleVide()] }
}

// Reconstruit l'état éditable d'un niveau déjà enregistré.
function niveauDepuisSeance(n) {
  return {
    id: n.id,
    nom: n.nom,
    visible: n.visible !== false,
    echauffement: n.echauffement ? { ...n.echauffement } : echauffementVide(),
    retourDepart: n.retourDepart || 'auto',
    blocs: n.blocs.map((b) =>
      b.mode === 'fullpower'
        ? { id: b.id, mode: 'fullpower', structure: b.structure || structureVideCompat() }
        : { id: b.id, mode: 'simple', distance_m: b.distance_m, duree_s: b.duree_s }
    )
  }
}

export default function SeanceEditor({ seanceInitiale, modeParDefaut = 'mixte', onEnregistrer, onFermer }) {
  const [titre, setTitre] = useState(seanceInitiale?.titre || '')
  const [modeGuidage, setModeGuidage] = useState(seanceInitiale?.modeGuidage || 'defaut')
  const [regleParticuliere, setRegleParticuliere] = useState(seanceInitiale?.regleParticuliere || '')
  const [niveaux, setNiveaux] = useState(
    seanceInitiale ? seanceInitiale.niveaux.map(niveauDepuisSeance) : NOMS_NIVEAUX.map(niveauVide)
  )
  // Erreur de validation affichée près du bouton d'enregistrement (ex. bloc Full Power sans
  // séquence) — voir enregistrer().
  const [erreur, setErreur] = useState(null)

  function majNiveau(id, champ, valeur) {
    setNiveaux((prev) => prev.map((n) => (n.id === id ? { ...n, [champ]: valeur } : n)))
  }

  // Ajout d'un niveau supplémentaire (Niveau 4, 5…) : nommé directement "Niveau N" (les 3
  // premiers gardent leur nom interne historique Facile/Moyen/Difficile, affiché Niveau 1/2/3).
  function ajouterNiveau() {
    setNiveaux((prev) => {
      const pris = new Set(prev.map((n) => libelleNiveau(n.nom)))
      let k = prev.length + 1
      while (pris.has(`Niveau ${k}`)) k++
      const base = prev[prev.length - 1]
      const nouveau = base
        ? { ...JSON.parse(JSON.stringify(base)), id: crypto.randomUUID(), nom: `Niveau ${k}`, visible: true }
        : niveauVide(`Niveau ${k}`)
      if (base) nouveau.blocs = nouveau.blocs.map((b) => ({ ...b, id: crypto.randomUUID() }))
      return [...prev, nouveau]
    })
  }

  function supprimerNiveau(id) {
    const n = niveaux.find((x) => x.id === id)
    if (!n || niveaux.length <= 1) return
    if (!window.confirm(`Supprimer le ${libelleNiveau(n.nom)} de cette séance ?`)) return
    setNiveaux((prev) => prev.filter((x) => x.id !== id))
  }

  function enregistrer() {
    if (!titre.trim()) return

    // Une série Full Power sans aucune répétition ne joue en réalité que
    // l'échauffement/la récupération éventuels — presque rien du contenu préparé. Plutôt que
    // d'enregistrer silencieusement une séance quasi vide (comme avant), on bloque et on indique
    // précisément où corriger.
    for (const n of niveaux) {
      if (n.visible === false) continue
      for (let i = 0; i < n.blocs.length; i++) {
        const b = n.blocs[i]
        if (b.mode === 'fullpower' && !(b.structure?.sequence?.length > 0)) {
          setErreur(`${libelleNiveau(n.nom)} · Partie ${i + 1} (Full Power) : ajoute au moins une répétition avant d'enregistrer, sinon cette partie ne contiendra rien à courir.`)
          return
        }
      }
    }
    setErreur(null)

    const niveauxFinaux = niveaux.map((n) => ({
      id: n.id,
      nom: n.nom,
      visible: n.visible !== false,
      echauffement: { active: !!n.echauffement?.active, duree_s: Number(n.echauffement?.duree_s) || 0 },
      retourDepart: n.retourDepart || 'auto',
      blocs: n.blocs.map((b) => {
        if (b.mode === 'fullpower') {
          return { id: b.id, mode: 'fullpower', structure: b.structure }
        }
        const duree_s = Number(b.duree_s) || 0
        const allure_kmh = duree_s > 0 ? Math.round(((b.distance_m / 1000) / (duree_s / 3600)) * 100) / 100 : 0
        return { id: b.id, mode: 'simple', distance_m: Number(b.distance_m), duree_s, allure_kmh }
      })
    }))
    onEnregistrer({
      id: seanceInitiale?.id || crypto.randomUUID(),
      titre: titre.trim(),
      regleParticuliere: regleParticuliere.trim() || null,
      modeGuidage,
      dateCreation: seanceInitiale?.dateCreation || Date.now(),
      // Classement Secondes / Premières-Terminales : géré depuis la bibliothèque (glisser-déposer
      // entre les deux espaces), pas depuis cet éditeur. Ordre d'affichage idem.
      niveauScolaire: seanceInitiale?.niveauScolaire || 'seconde',
      ordre: seanceInitiale?.ordre ?? Date.now(),
      codeType: seanceInitiale?.codeType,
      // La visibilité par classe se gère depuis le tableau de bord (bouton "Visible / Masquée"),
      // pas depuis cet éditeur : on la préserve telle quelle.
      visible: seanceInitiale?.visible ?? false,
      classesVisibles: seanceInitiale?.classesVisibles ?? [],
      niveaux: niveauxFinaux
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-piste-100">
          <h3 className="font-display text-lg text-piste-900">{seanceInitiale ? 'Modifier la séance' : 'Nouvelle séance'}</h3>
          <button onClick={onFermer} className="p-1.5 rounded-full hover:bg-piste-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <label className="block text-sm font-medium text-piste-800 mb-1">Titre de la séance</label>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex : Course en durée du 12/09"
              className="w-full rounded-xl border border-piste-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-piste-500"
            />
          </div>

          <p className="text-xs text-piste-500 -mt-2">
            La visibilité par classe se choisit depuis le bouton "Visible / Masquée" sur la fiche de la séance, après enregistrement.
          </p>

          <div>
            <label className="block text-sm font-medium text-piste-800 mb-1">
              Règle particulière <span className="text-piste-400 font-normal">(optionnel, visible aux élèves)</span>
            </label>
            <textarea
              value={regleParticuliere}
              onChange={(e) => setRegleParticuliere(e.target.value)}
              placeholder="Ex : 1 pause possible dans la zone des 20m du départ, durée < 1 min, toutes les 8 min de course."
              rows={2}
              className="w-full rounded-xl border border-piste-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-piste-800 mb-1">Guidage de l'allure</label>
            <select
              value={modeGuidage}
              onChange={(e) => setModeGuidage(e.target.value)}
              className="w-full rounded-xl border border-piste-200 px-3 py-2.5 text-sm bg-white"
            >
              <option value="defaut">Mon réglage par défaut ({MODES_GUIDAGE[modeParDefaut] || MODES_GUIDAGE.mixte})</option>
              {Object.entries(MODES_GUIDAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {niveaux.map((n) => (
            <div key={n.id} className="border border-piste-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-base text-piste-900">{libelleNiveau(n.nom)}</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-piste-700">
                    <input
                      type="checkbox"
                      checked={n.visible !== false}
                      onChange={(e) => majNiveau(n.id, 'visible', e.target.checked)}
                      className="w-4 h-4"
                    />
                    Visible aux élèves
                  </label>
                  {niveaux.length > 1 && (
                    <button onClick={() => supprimerNiveau(n.id)} title="Supprimer ce niveau" className="p-1 rounded-full hover:bg-[#fbeeea] text-alerte">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <TotauxNiveau niveau={n} />

              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 text-xs font-medium text-piste-700">
                  <input
                    type="checkbox"
                    checked={!!n.echauffement?.active}
                    onChange={(e) => majNiveau(n.id, 'echauffement', { ...n.echauffement, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Échauffement
                </label>
                {n.echauffement?.active && (
                  <SelecteurDuree
                    valeurSec={n.echauffement.duree_s}
                    onChange={(v) => majNiveau(n.id, 'echauffement', { ...n.echauffement, duree_s: v })}
                  />
                )}
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium text-piste-700 mb-1">Retour à la ligne de départ pendant les récupérations</label>
                <select
                  value={n.retourDepart || 'auto'}
                  onChange={(e) => majNiveau(n.id, 'retourDepart', e.target.value)}
                  className="w-full rounded-lg border border-piste-200 px-2.5 py-2 text-xs bg-white"
                >
                  {Object.entries(OPTIONS_RETOUR_DEPART).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <ListeSeries series={n.blocs} onChange={(blocs) => majNiveau(n.id, 'blocs', blocs)} />
            </div>
          ))}

          <button
            onClick={ajouterNiveau}
            className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-piste-200 rounded-xl py-3 text-sm font-medium text-piste-700 hover:border-piste-400"
          >
            <Plus size={15} /> Ajouter un niveau (Niveau {niveaux.length + 1})
          </button>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-piste-100 p-4">
          {erreur && (
            <p className="text-xs text-alerte bg-[#fbeeea] border border-alerte/30 rounded-xl px-3.5 py-2.5 mb-2">
              {erreur}
            </p>
          )}
          <button
            onClick={enregistrer}
            disabled={!titre.trim()}
            className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition"
          >
            {seanceInitiale ? 'Enregistrer les modifications' : 'Enregistrer la séance'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Temps de travail effectif et durée totale du niveau, recalculés en direct pendant l'édition.
function TotauxNiveau({ niveau }) {
  const { duree, travail } = totauxNiveau(niveau, 15, RECUPERATION_FIXE.duree_s)
  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <div className="bg-piste-50 rounded-lg px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-piste-500">Temps de travail</p>
        <p className="font-display text-base text-piste-900 tabular-nums">{formatDuree(travail)}</p>
      </div>
      <div className="bg-piste-50 rounded-lg px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-piste-500">Durée totale</p>
        <p className="font-display text-base text-piste-900 tabular-nums">{formatDuree(duree)}</p>
      </div>
    </div>
  )
}
