import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import FullPowerBuilder from './FullPowerBuilder'

const NOMS_NIVEAUX = ['Facile', 'Moyen', 'Difficile']

function blocSimpleVide() {
  return { id: crypto.randomUUID(), mode: 'simple', distance_m: 400, duree_min: 2, duree_sec: 0 }
}

function blocFullPowerVide() {
  return { id: crypto.randomUUID(), mode: 'fullpower', structure: null }
}

function echauffementVide() {
  return { active: false, duree_s: 300 }
}

function niveauVide(nom) {
  return { id: crypto.randomUUID(), nom, guidage: 'minuteur', visible: true, echauffement: echauffementVide(), blocs: [blocSimpleVide(), blocSimpleVide(), blocSimpleVide()] }
}

// Reconstruit l'état éditable d'un niveau déjà enregistré (bloc simple : durée en secondes -> min/sec).
function niveauDepuisSeance(n) {
  return {
    id: n.id,
    nom: n.nom,
    guidage: n.guidage,
    visible: n.visible !== false,
    echauffement: n.echauffement ? { ...n.echauffement } : echauffementVide(),
    blocs: n.blocs.map((b) =>
      b.mode === 'fullpower'
        ? { id: b.id, mode: 'fullpower', structure: b.structure }
        : { id: b.id, mode: 'simple', distance_m: b.distance_m, duree_min: Math.floor(b.duree_s / 60), duree_sec: b.duree_s % 60 }
    )
  }
}

export default function SeanceEditor({ seanceInitiale, onEnregistrer, onFermer }) {
  const [titre, setTitre] = useState(seanceInitiale?.titre || '')
  const [niveaux, setNiveaux] = useState(
    seanceInitiale ? seanceInitiale.niveaux.map(niveauDepuisSeance) : NOMS_NIVEAUX.map(niveauVide)
  )

  function majNiveau(id, champ, valeur) {
    setNiveaux((prev) => prev.map((n) => (n.id === id ? { ...n, [champ]: valeur } : n)))
  }

  function majBloc(niveauId, blocId, champ, valeur) {
    setNiveaux((prev) =>
      prev.map((n) =>
        n.id !== niveauId
          ? n
          : { ...n, blocs: n.blocs.map((b) => (b.id === blocId ? { ...b, [champ]: valeur } : b)) }
      )
    )
  }

  function changerModeBloc(niveauId, blocId, mode) {
    setNiveaux((prev) =>
      prev.map((n) =>
        n.id !== niveauId
          ? n
          : {
              ...n,
              blocs: n.blocs.map((b) =>
                b.id !== blocId ? b : mode === 'simple' ? { ...blocSimpleVide(), id: b.id } : { ...blocFullPowerVide(), id: b.id }
              )
            }
      )
    )
  }

  function ajouterBloc(niveauId) {
    setNiveaux((prev) => prev.map((n) => (n.id === niveauId ? { ...n, blocs: [...n.blocs, blocSimpleVide()] } : n)))
  }

  function supprimerBloc(niveauId, blocId) {
    setNiveaux((prev) =>
      prev.map((n) => (n.id !== niveauId ? n : { ...n, blocs: n.blocs.filter((b) => b.id !== blocId) }))
    )
  }

  function enregistrer() {
    if (!titre.trim()) return
    const niveauxFinaux = niveaux.map((n) => ({
      id: n.id,
      nom: n.nom,
      guidage: n.guidage,
      visible: n.visible !== false,
      echauffement: { active: !!n.echauffement?.active, duree_s: Number(n.echauffement?.duree_s) || 0 },
      blocs: n.blocs.map((b) => {
        if (b.mode === 'fullpower') {
          return { id: b.id, mode: 'fullpower', structure: b.structure }
        }
        const duree_s = Number(b.duree_min) * 60 + Number(b.duree_sec)
        const allure_kmh = duree_s > 0 ? Math.round(((b.distance_m / 1000) / (duree_s / 3600)) * 100) / 100 : 0
        return { id: b.id, mode: 'simple', distance_m: Number(b.distance_m), duree_s, allure_kmh }
      })
    }))
    onEnregistrer({
      id: seanceInitiale?.id || crypto.randomUUID(),
      titre: titre.trim(),
      dateCreation: seanceInitiale?.dateCreation || Date.now(),
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

          {niveaux.map((n) => (
            <div key={n.id} className="border border-piste-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-base text-piste-900">{n.nom}</p>
                <label className="flex items-center gap-2 text-xs font-medium text-piste-700">
                  <input
                    type="checkbox"
                    checked={n.visible !== false}
                    onChange={(e) => majNiveau(n.id, 'visible', e.target.checked)}
                    className="w-4 h-4"
                  />
                  Visible aux élèves
                </label>
              </div>

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
                  <input
                    type="number"
                    value={n.echauffement.duree_s}
                    onChange={(e) => majNiveau(n.id, 'echauffement', { ...n.echauffement, duree_s: Number(e.target.value) })}
                    placeholder="secondes"
                    className="w-24 rounded-lg border border-piste-200 px-2.5 py-1.5 text-xs"
                  />
                )}
              </div>

              <div className="space-y-4 mb-2">
                {n.blocs.map((b, i) => (
                  <div key={b.id} className="bg-piste-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-piste-600">Bloc {i + 1}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {['simple', 'fullpower'].map((mode) => (
                            <button
                              key={mode}
                              onClick={() => changerModeBloc(n.id, b.id, mode)}
                              className={`text-[11px] px-2 py-1 rounded-full border transition ${b.mode === mode ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-700'}`}
                            >
                              {mode === 'simple' ? 'Simple' : 'Full Power'}
                            </button>
                          ))}
                        </div>
                        {n.blocs.length > 1 && (
                          <button onClick={() => supprimerBloc(n.id, b.id)} className="p-1 rounded-full hover:bg-[#fbeeea] text-alerte shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {b.mode === 'simple' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={b.distance_m}
                          onChange={(e) => majBloc(n.id, b.id, 'distance_m', e.target.value)}
                          className="w-full rounded-lg border border-piste-200 px-2.5 py-1.5 text-sm"
                          placeholder="Distance (m)"
                        />
                        <input
                          type="number"
                          value={b.duree_min}
                          onChange={(e) => majBloc(n.id, b.id, 'duree_min', e.target.value)}
                          className="w-16 rounded-lg border border-piste-200 px-2.5 py-1.5 text-sm"
                          placeholder="min"
                        />
                        <input
                          type="number"
                          value={b.duree_sec}
                          onChange={(e) => majBloc(n.id, b.id, 'duree_sec', e.target.value)}
                          className="w-16 rounded-lg border border-piste-200 px-2.5 py-1.5 text-sm"
                          placeholder="sec"
                        />
                      </div>
                    ) : (
                      <FullPowerBuilder
                        structureInitiale={b.structure}
                        onChange={(structure) => majBloc(n.id, b.id, 'structure', structure)}
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => ajouterBloc(n.id)}
                className="flex items-center gap-1 text-xs font-medium text-piste-700 hover:text-piste-900"
              >
                <Plus size={13} /> Ajouter un bloc
              </button>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-piste-100 p-4">
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
