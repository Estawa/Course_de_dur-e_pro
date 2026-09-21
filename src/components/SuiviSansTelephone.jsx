import { useMemo, useState } from 'react'
import { X, ChevronLeft, ChevronRight, WifiOff, Check, CheckCircle2 } from 'lucide-react'
import { preparerBloc } from './SeanceRunner'
import { storage } from '../utils/storage'
import { calculerNoteSeance, calculerNoteReelle, formatDuree, vitesseVersAllure } from '../utils/calc'
import { construireResultatBlocSaisieProf, resultatBlocNonRealise, repetitionsInitiales } from '../utils/saisieProf'
import { NIVEAUX_BORG } from '../utils/borg'

function cleEleve(e) {
  return e.id || `${e.nom}__${e.prenom}`
}

// État de saisie initial pour un niveau donné : une entrée par bloc, avec une répétition par
// phase de travail du bloc, pré-remplie à la valeur cible.
function donneesInitiales(niveau, vmaRef) {
  const blocs = {}
  niveau.blocs.forEach((bloc) => {
    const prep = preparerBloc(bloc, niveau, vmaRef)
    const phasesTravail = prep.phases.filter((p) => p.phase === 'travail')
    blocs[bloc.id] = {
      phasesTravail,
      nonRealise: false,
      inclureDansNote: false,
      repetitions: repetitionsInitiales(phasesTravail)
    }
  })
  return { blocs, borg: null, observation: '' }
}

export default function SuiviSansTelephone({ classe, eleves, seances, onFermer, onAjouterRealisation, onModifierRealisation }) {
  const [etape, setEtape] = useState('selection') // 'selection' | 'saisie'
  const [seanceId, setSeanceId] = useState('')
  const [elevesChoisis, setElevesChoisis] = useState([]) // clés élèves
  const [niveauParEleve, setNiveauParEleve] = useState({}) // clé -> niveauId
  const [indexCourant, setIndexCourant] = useState(0)
  const [donneesParEleve, setDonneesParEleve] = useState({}) // clé -> { blocs, borg, observation }
  const [enregistres, setEnregistres] = useState({}) // clé -> id de la réalisation enregistrée

  const seancesTriees = useMemo(() => seances.slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)), [seances])
  const seance = seancesTriees.find((s) => s.id === seanceId) || null

  function niveauPourEleve(cle) {
    if (!seance) return null
    const id = niveauParEleve[cle]
    return seance.niveaux.find((n) => n.id === id) || null
  }

  function toggleEleve(cle) {
    setElevesChoisis((prev) => (prev.includes(cle) ? prev.filter((c) => c !== cle) : [...prev, cle]))
    if (!niveauParEleve[cle] && seance) {
      const premier = seance.niveaux.find((n) => n.visible !== false) || seance.niveaux[0]
      if (premier) setNiveauParEleve((prev) => ({ ...prev, [cle]: premier.id }))
    }
  }

  function demarrerSaisie() {
    if (!seance || elevesChoisis.length === 0) return
    const init = {}
    elevesChoisis.forEach((cle) => {
      const eleveObj = eleves.find((e) => cleEleve(e) === cle)
      const niveau = niveauPourEleve(cle)
      if (!eleveObj || !niveau) return
      const vmaRef = eleveObj.id ? storage.getVmaRetenue({ id: eleveObj.id, nom: eleveObj.nom, prenom: eleveObj.prenom, classe }) : null
      init[cle] = donneesInitiales(niveau, vmaRef)
    })
    setDonneesParEleve(init)
    setIndexCourant(0)
    setEtape('saisie')
  }

  const cleCourante = elevesChoisis[indexCourant]
  const eleveCourant = cleCourante ? eleves.find((e) => cleEleve(e) === cleCourante) : null
  const niveauCourant = cleCourante ? niveauPourEleve(cleCourante) : null
  const donneesCourantes = cleCourante ? donneesParEleve[cleCourante] : null

  function majBloc(blocId, patch) {
    setDonneesParEleve((prev) => ({
      ...prev,
      [cleCourante]: {
        ...prev[cleCourante],
        blocs: {
          ...prev[cleCourante].blocs,
          [blocId]: { ...prev[cleCourante].blocs[blocId], ...patch }
        }
      }
    }))
  }

  function majRepetition(blocId, index, champ, valeur) {
    setDonneesParEleve((prev) => {
      const bloc = prev[cleCourante].blocs[blocId]
      const repetitions = bloc.repetitions.map((r, i) => (i === index ? { ...r, [champ]: valeur } : r))
      return {
        ...prev,
        [cleCourante]: { ...prev[cleCourante], blocs: { ...prev[cleCourante].blocs, [blocId]: { ...bloc, repetitions } } }
      }
    })
  }

  function majBorg(valeur) {
    setDonneesParEleve((prev) => ({ ...prev, [cleCourante]: { ...prev[cleCourante], borg: valeur } }))
  }

  function majObservation(valeur) {
    setDonneesParEleve((prev) => ({ ...prev, [cleCourante]: { ...prev[cleCourante], observation: valeur } }))
  }

  function enregistrerEleveCourant() {
    if (!eleveCourant || !niveauCourant || !donneesCourantes) return
    const blocsResultats = niveauCourant.blocs.map((bloc) => {
      const info = donneesCourantes.blocs[bloc.id]
      if (!info) return null
      if (info.nonRealise) return resultatBlocNonRealise(bloc.id, info.phasesTravail, info.inclureDansNote)
      return construireResultatBlocSaisieProf(bloc.id, info.phasesTravail, info.repetitions)
    }).filter(Boolean)

    const blocsPourNote = blocsResultats.filter((b) => !b.nonRealise || b.inclureDansNote)
    const note = calculerNoteSeance(blocsPourNote)
    const { note: noteReelle, avecGps: noteReelleAvecGps } = calculerNoteReelle(blocsPourNote)

    const idExistant = enregistres[cleCourante]
    const contenu = {
      eleve: { id: eleveCourant.id, nom: eleveCourant.nom, prenom: eleveCourant.prenom, classe },
      seanceId: seance.id,
      seanceTitre: seance.titre,
      niveauNom: niveauCourant.nom,
      date: Date.now(),
      noteReelle,
      noteReelleAvecGps,
      blocsResultats,
      echauffementResultat: null,
      recuperationResultat: null,
      recuperationSautee: true,
      borgParPhase: { echauffement: null, travail: donneesCourantes.borg, recuperation: null },
      borg: donneesCourantes.borg,
      observationGenerale: donneesCourantes.observation,
      note,
      saisieProf: true
    }
    if (idExistant) {
      onModifierRealisation(idExistant, contenu)
    } else {
      const id = crypto.randomUUID()
      onAjouterRealisation({ id, ...contenu })
      setEnregistres((prev) => ({ ...prev, [cleCourante]: id }))
    }
  }

  function allerA(i) {
    if (i >= 0 && i < elevesChoisis.length) setIndexCourant(i)
  }

  // --- Écran de sélection --------------------------------------------------
  if (etape === 'selection') {
    return (
      <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
          <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-4 border-b border-piste-100">
            <div className="flex items-center gap-2">
              <WifiOff size={18} className="text-piste-700" />
              <h3 className="font-display text-lg text-piste-900">Suivi sans téléphone</h3>
            </div>
            <button onClick={onFermer} className="p-1.5 rounded-full hover:bg-piste-100">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <label className="block text-[11px] font-semibold text-piste-500 uppercase tracking-wide mb-1.5">Séance du jour</label>
              <select
                value={seanceId}
                onChange={(e) => { setSeanceId(e.target.value); setNiveauParEleve({}) }}
                className="w-full rounded-xl border border-piste-200 px-3.5 py-2.5 text-sm bg-white"
              >
                <option value="">Choisir une séance…</option>
                {seancesTriees.map((s) => (
                  <option key={s.id} value={s.id}>{s.titre}</option>
                ))}
              </select>
            </div>

            {seance && (
              <div>
                <p className="text-[11px] font-semibold text-piste-500 uppercase tracking-wide mb-1.5">
                  Élèves sans téléphone aujourd'hui
                </p>
                <div className="space-y-2">
                  {eleves.map((e) => {
                    const cle = cleEleve(e)
                    const choisi = elevesChoisis.includes(cle)
                    return (
                      <div key={cle} className={`rounded-xl px-3 py-2.5 border ${choisi ? 'border-piste-800 bg-piste-50' : 'border-piste-100'}`}>
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input type="checkbox" checked={choisi} onChange={() => toggleEleve(cle)} className="w-4 h-4 shrink-0" />
                          <span className="text-sm font-medium text-piste-900 flex-1 truncate">{e.prenom} {e.nom}</span>
                        </label>
                        {choisi && (
                          <select
                            value={niveauParEleve[cle] || ''}
                            onChange={(ev) => setNiveauParEleve((prev) => ({ ...prev, [cle]: ev.target.value }))}
                            className="mt-2 w-full rounded-lg border border-piste-200 px-2.5 py-1.5 text-xs bg-white"
                          >
                            {seance.niveaux.filter((n) => n.visible !== false).map((n) => (
                              <option key={n.id} value={n.id}>{n.nom}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <button
              disabled={!seance || elevesChoisis.length === 0}
              onClick={demarrerSaisie}
              className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition"
            >
              Commencer la saisie ({elevesChoisis.length} élève{elevesChoisis.length > 1 ? 's' : ''})
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Écran de saisie -------------------------------------------------------
  if (!eleveCourant || !niveauCourant || !donneesCourantes) {
    return null
  }

  const estEnregistre = !!enregistres[cleCourante]

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-3 py-4 border-b border-piste-100 gap-2">
          <button onClick={() => setEtape('selection')} className="p-1.5 rounded-full hover:bg-piste-100 shrink-0">
            <X size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h3 className="font-display text-base text-piste-900 truncate">
              {eleveCourant.prenom} {eleveCourant.nom} {estEnregistre && <CheckCircle2 size={14} className="inline text-piste-700 -mt-0.5 ml-1" />}
            </h3>
            <p className="text-[11px] text-piste-500">{niveauCourant.nom} · élève {indexCourant + 1}/{elevesChoisis.length}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => allerA(indexCourant - 1)} disabled={indexCourant === 0} className="p-1.5 rounded-full hover:bg-piste-100 disabled:opacity-30">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => allerA(indexCourant + 1)} disabled={indexCourant === elevesChoisis.length - 1} className="p-1.5 rounded-full hover:bg-piste-100 disabled:opacity-30">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {niveauCourant.blocs.map((bloc, i) => {
            const info = donneesCourantes.blocs[bloc.id]
            if (!info) return null
            return (
              <div key={bloc.id} className="bg-piste-50 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-piste-800">Bloc {i + 1}/{niveauCourant.blocs.length}</p>
                  <label className="flex items-center gap-1.5 text-[11px] text-piste-600">
                    <input
                      type="checkbox"
                      checked={info.nonRealise}
                      onChange={(e) => majBloc(bloc.id, { nonRealise: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    Non réalisé
                  </label>
                </div>

                {info.nonRealise ? (
                  <label className="flex items-center gap-1.5 text-[11px] text-piste-600">
                    <input
                      type="checkbox"
                      checked={info.inclureDansNote}
                      onChange={(e) => majBloc(bloc.id, { inclureDansNote: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    Compter quand même comme non réussi dans le calcul de la note
                  </label>
                ) : (
                  <div className="space-y-2">
                    {info.phasesTravail.map((p, j) => (
                      <div key={j} className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-piste-500 w-full sm:w-auto">
                          Répétition {j + 1}/{info.phasesTravail.length} — objectif {formatDuree(p.duree_s)} à {vitesseVersAllure(p.vitesse_kmh)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={info.repetitions[j]?.distanceM ?? ''}
                            onChange={(e) => majRepetition(bloc.id, j, 'distanceM', e.target.value)}
                            className="w-20 rounded-lg border border-piste-200 px-2 py-1.5 text-sm"
                          />
                          <span className="text-xs text-piste-500">m en</span>
                          <input
                            type="number"
                            min="0"
                            value={info.repetitions[j]?.dureeS ?? ''}
                            onChange={(e) => majRepetition(bloc.id, j, 'dureeS', e.target.value)}
                            className="w-16 rounded-lg border border-piste-200 px-2 py-1.5 text-sm"
                          />
                          <span className="text-xs text-piste-500">s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div>
            <p className="text-[11px] font-semibold text-piste-500 uppercase tracking-wide mb-1.5">
              Échelle de Borg (facultatif)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NIVEAUX_BORG.map((n) => (
                <button
                  key={n.valeur}
                  onClick={() => majBorg(n.valeur)}
                  title={n.label}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 border-2 ${donneesCourantes.borg === n.valeur ? 'border-piste-800' : 'border-transparent'}`}
                  style={{ backgroundColor: n.couleur }}
                >
                  {n.valeur}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-piste-500 uppercase tracking-wide mb-1.5">
              Observation (facultatif)
            </label>
            <textarea
              value={donneesCourantes.observation}
              onChange={(e) => majObservation(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-piste-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-piste-500"
              placeholder="Ex : conditions, ressenti rapporté par l'élève..."
            />
          </div>

          <button
            onClick={enregistrerEleveCourant}
            className="w-full flex items-center justify-center gap-1.5 bg-piste-800 hover:bg-piste-700 text-white font-medium py-3 rounded-xl transition"
          >
            <Check size={16} /> {estEnregistre ? 'Mettre à jour cette séance' : 'Enregistrer cette séance'}
          </button>

          {indexCourant < elevesChoisis.length - 1 && (
            <button
              onClick={() => allerA(indexCourant + 1)}
              className="w-full text-xs font-medium text-piste-600 hover:text-piste-900 py-1"
            >
              Élève suivant →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
