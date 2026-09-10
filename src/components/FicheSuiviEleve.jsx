import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, KeyRound, UserX, Trash2, Check } from 'lucide-react'
import VmaEleveLigne from './VmaEleveLigne'
import ComportementAjustement from './ComportementAjustement'
import { storage } from '../utils/storage'
import { noteFinale, pourcentagesReussite } from '../utils/calc'

// Distance de glissement horizontal minimale (px) pour déclencher un changement de fiche,
// et écart vertical maximal toléré pour ne pas confondre avec un scroll de la liste.
const SEUIL_SWIPE_X = 60
const SEUIL_SWIPE_Y = 60

export default function FicheSuiviEleve({
  eleve,
  realisations,
  listeEleves,
  onNaviguer,
  onFermer,
  onChange,
  onSupprimerEleve,
  onSupprimerSeancesEleve,
  onModifierRealisation,
  onSupprimerRealisation
}) {
  const [editionOuverte, setEditionOuverte] = useState(false)
  const [editNom, setEditNom] = useState(eleve.nom)
  const [editPrenom, setEditPrenom] = useState(eleve.prenom)
  const [editSexe, setEditSexe] = useState(eleve.sexe || '')
  const toucheDepart = useRef(null)

  const cleDe = (e) => e.id || `${e.nom}__${e.prenom}`
  const cleActuelle = cleDe(eleve)
  const index = listeEleves ? listeEleves.findIndex((e) => cleDe(e) === cleActuelle) : -1
  const elevePrecedent = listeEleves && index > 0 ? listeEleves[index - 1] : null
  const eleveSuivant = listeEleves && index >= 0 && index < listeEleves.length - 1 ? listeEleves[index + 1] : null

  function allerPrecedent() {
    if (elevePrecedent && onNaviguer) onNaviguer(cleDe(elevePrecedent))
  }

  function allerSuivant() {
    if (eleveSuivant && onNaviguer) onNaviguer(cleDe(eleveSuivant))
  }

  // Flèches gauche/droite du clavier pour naviguer d'une fiche à l'autre sur PC, sauf si le
  // focus est dans un champ de saisie (édition nom/prénom en cours).
  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') allerPrecedent()
      else if (e.key === 'ArrowRight') allerSuivant()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevePrecedent, eleveSuivant])

  function onTouchStart(e) {
    const t = e.touches[0]
    toucheDepart.current = { x: t.clientX, y: t.clientY }
  }

  function onTouchEnd(e) {
    if (!toucheDepart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - toucheDepart.current.x
    const dy = t.clientY - toucheDepart.current.y
    toucheDepart.current = null
    if (Math.abs(dx) < SEUIL_SWIPE_X || Math.abs(dy) > SEUIL_SWIPE_Y) return
    if (dx < 0) allerSuivant() // glissement vers la gauche → élève suivant
    else allerPrecedent() // glissement vers la droite → élève précédent
  }

  function enregistrerEdition(e) {
    e.preventDefault()
    if (!editNom.trim() || !editPrenom.trim() || !eleve.id) return
    storage.modifierEleve(eleve.classe, eleve.id, { nom: editNom, prenom: editPrenom, sexe: editSexe })
    setEditionOuverte(false)
    onChange()
  }

  function reinitialiserPin() {
    if (!eleve.id) return
    storage.reinitialiserPin(eleve.classe, eleve.id)
    onChange()
  }

  function supprimerUneRealisation(r) {
    if (!onSupprimerRealisation) return
    if (!confirm(`Effacer la séance "${r.seanceTitre} · ${r.niveauNom}" du ${new Date(r.date).toLocaleDateString('fr-FR')} ?`)) return
    onSupprimerRealisation(r.id)
  }

  const realisationsTriees = realisations.slice().sort((a, b) => b.date - a.date)

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center">
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto relative"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-3 py-4 border-b border-piste-100 gap-2">
          <button onClick={onFermer} title="Retour à la liste des élèves" className="p-1.5 rounded-full hover:bg-piste-100 shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg text-piste-900 truncate">
              {eleve.prenom} {eleve.nom}
              {eleve.sexe && <span className="text-piste-400 font-normal"> ({eleve.sexe})</span>}
            </h3>
            {eleve.id && !eleve.pinDefini && <p className="text-[11px] text-piste-500">PIN non défini</p>}
          </div>
          {listeEleves && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={allerPrecedent}
                disabled={!elevePrecedent}
                title="Élève précédent"
                className="p-1.5 rounded-full hover:bg-piste-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={allerSuivant}
                disabled={!eleveSuivant}
                title="Élève suivant"
                className="p-1.5 rounded-full hover:bg-piste-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="p-5 space-y-5">
          {eleve.id && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setEditionOuverte((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-medium text-piste-700 border border-piste-200 rounded-full px-2.5 py-1 hover:bg-piste-50"
              >
                <Pencil size={12} /> Modifier nom/prénom
              </button>
              <button
                onClick={reinitialiserPin}
                className="flex items-center gap-1 text-[11px] font-medium text-piste-700 border border-piste-200 rounded-full px-2.5 py-1 hover:bg-piste-50"
              >
                <KeyRound size={12} /> Réinitialiser le PIN
              </button>
              {realisations.length > 0 && (
                <button
                  onClick={() => onSupprimerSeancesEleve(eleve)}
                  className="flex items-center gap-1 text-[11px] font-medium text-alerte border border-[#f0d3ca] rounded-full px-2.5 py-1 hover:bg-white"
                >
                  <Trash2 size={12} /> Effacer ses séances
                </button>
              )}
              <button
                onClick={() => onSupprimerEleve(eleve.id)}
                className="flex items-center gap-1 text-[11px] font-medium text-alerte border border-[#f0d3ca] rounded-full px-2.5 py-1 hover:bg-white"
              >
                <UserX size={12} /> Retirer de la classe
              </button>
            </div>
          )}

          {editionOuverte && eleve.id && (
            <form onSubmit={enregistrerEdition} className="flex flex-col sm:flex-row gap-2 bg-piste-50 rounded-xl p-3">
              <input
                value={editPrenom}
                onChange={(e) => setEditPrenom(e.target.value)}
                autoFocus
                className="flex-1 rounded-lg border border-piste-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
              />
              <input
                value={editNom}
                onChange={(e) => setEditNom(e.target.value)}
                className="flex-1 rounded-lg border border-piste-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
              />
              <select
                value={editSexe}
                onChange={(e) => setEditSexe(e.target.value)}
                className="rounded-lg border border-piste-200 px-2 py-1.5 text-sm bg-white"
              >
                <option value="">Sexe</option>
                <option value="F">F</option>
                <option value="M">M</option>
              </select>
              <button type="submit" className="p-1.5 rounded-full bg-piste-800 text-white hover:bg-piste-700 self-start sm:self-auto">
                <Check size={14} />
              </button>
            </form>
          )}

          {eleve.id && (
            <div>
              <p className="text-[11px] font-semibold text-piste-500 uppercase tracking-wide mb-1.5">VMA</p>
              <VmaEleveLigne eleve={{ id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, classe: eleve.classe }} onChange={onChange} />
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold text-piste-500 uppercase tracking-wide mb-1.5">
              Séances réalisées pendant le cycle
            </p>
            {realisationsTriees.length === 0 && <p className="text-xs text-piste-500">Pas encore de séance réalisée.</p>}
            <div className="space-y-2">
              {realisationsTriees.map((r) => {
                const nbReussis = r.blocsResultats?.filter((b) => b.reussite === 'reussi').length ?? 0
                const noteBase = r.noteReelle ?? r.note
                const noteAvecComportement = noteFinale(r)
                const ajustement = r.ajustementComportement || 0
                const labelGps = r.noteReelleAvecGps === undefined ? null : r.noteReelleAvecGps ? '(ac GPS)' : '(Sans GPS)'
                const pct = pourcentagesReussite(r.blocsResultats)
                return (
                  <div key={r.id} className="bg-piste-50 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-piste-900">{r.seanceTitre} · {r.niveauNom}</p>
                        <p className="text-[11px] text-piste-500">
                          {new Date(r.date).toLocaleDateString('fr-FR')} · {nbReussis}/{r.blocsResultats?.length ?? 0} blocs · Borg {r.borg}
                        </p>
                        {pct.allure !== null && (
                          <p className="text-[11px] text-piste-500">
                            Allure {pct.allure}% · Distance/durée {pct.distanceDuree}%
                          </p>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="text-right">
                          <span className="font-display text-piste-900">{noteAvecComportement}/20</span>
                          {ajustement !== 0 && (
                            <p className="text-[10px] text-piste-500">{noteBase}/20 base {ajustement > 0 ? '+' : ''}{ajustement}</p>
                          )}
                          {labelGps && <p className="text-[10px] text-piste-500">{labelGps}</p>}
                        </div>
                        {onSupprimerRealisation && (
                          <button
                            onClick={() => supprimerUneRealisation(r)}
                            title="Effacer cette séance"
                            className="p-1 rounded-full hover:bg-[#fbeeea] text-alerte shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {onModifierRealisation && (
                      <ComportementAjustement realisation={r} onModifier={onModifierRealisation} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
