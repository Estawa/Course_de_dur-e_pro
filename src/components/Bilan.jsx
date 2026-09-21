import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import { formatDuree, criteresSeance } from '../utils/calc'
import { libelleNiveau } from '../utils/niveauLabels'

const STYLE_REUSSITE = {
  reussi: { icone: CheckCircle2, couleur: 'text-piste-600', label: 'Réussi' },
  partiel: { icone: MinusCircle, couleur: 'text-cendre', label: 'Partiellement réussi' },
  non_reussi: { icone: XCircle, couleur: 'text-alerte', label: 'Non réussi' }
}

const LABELS_CRITERES = {
  distance: 'Distance',
  allure: 'Allure',
  recup: 'Récupération',
  regularite: 'Régularité'
}

function CriteresCard({ criteres }) {
  const entrees = Object.entries(criteres).filter(([, v]) => v != null)
  if (!entrees.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 mb-6 text-left">
      {entrees.map(([cle, valeur]) => (
        <div key={cle} className="bg-piste-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-piste-500">{LABELS_CRITERES[cle]}</p>
          <p className="font-display text-xl text-piste-900">{valeur}%</p>
        </div>
      ))}
    </div>
  )
}

function PhaseRecap({ titre, resultat, sautee }) {
  if (sautee) {
    return (
      <div className="bg-piste-50 rounded-xl px-4 py-3 text-left mb-3">
        <p className="text-sm font-medium text-piste-900">{titre}</p>
        <p className="text-xs text-piste-500 mt-0.5">Passée faute de temps</p>
      </div>
    )
  }
  if (!resultat) return null
  return (
    <div className="bg-piste-50 rounded-xl px-4 py-3 text-left mb-3">
      <p className="text-sm font-medium text-piste-900">{titre}</p>
      <p className="text-xs text-piste-500 mt-0.5">
        {formatDuree(resultat.dureeRealisee_s)} · {resultat.distanceRealisee_m} m
        {resultat.pctTemps != null && ` · ${Math.min(resultat.pctTemps, resultat.pctDistance)}% de l'objectif`}
      </p>
    </div>
  )
}

export default function Bilan({ resultat, niveauNom, onRetourAccueil, labelRetour = "Retour à l'accueil" }) {
  const {
    blocsResultats, borgParPhase, observationGenerale, note, echauffementResultat,
    echauffementChoisi, recuperationResultat, recuperationSautee, poulsParPhase, observationTravail
  } = resultat
  const criteres = criteresSeance(blocsResultats)
  const distanceTotale = blocsResultats.reduce((acc, b) => acc + (b.distanceRealisee || 0), 0)
  const dureeTotale = blocsResultats.reduce((acc, b) => acc + (b.dureeRealisee || 0), 0)
  const nbPausesTotal = blocsResultats.reduce((acc, b) => acc + (b.nbPauses || 0), 0)
  const dureePauseTotal = blocsResultats.reduce((acc, b) => acc + (b.dureePauseS || 0), 0)
  const borg = borgParPhase || {}
  const pouls = poulsParPhase || {}

  return (
    <div className="max-w-md mx-auto px-6 py-10 text-center">
      <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 ${note >= 18 ? 'bg-piste-100' : note >= 12 ? 'bg-[#f7f2e8]' : 'bg-[#fbeeea]'}`}>
        <span className="font-display text-3xl text-piste-900">{note}/20</span>
      </div>

      <h2 className="font-display text-2xl text-piste-900 mb-1">Séance terminée</h2>
      <p className="text-sm text-piste-600 mb-6">{libelleNiveau(niveauNom)} · {blocsResultats.length} bloc{blocsResultats.length > 1 ? 's' : ''}</p>

      {echauffementChoisi === false && (
        <div className="bg-piste-50 rounded-xl px-4 py-3 text-left mb-3">
          <p className="text-sm font-medium text-piste-900">Échauffement</p>
          <p className="text-xs text-piste-500 mt-0.5">Passé par choix de l'élève</p>
        </div>
      )}
      {echauffementResultat && (
        <PhaseRecap titre="Échauffement" resultat={echauffementResultat} />
      )}

      <p className="text-xs font-semibold text-piste-500 uppercase tracking-wide mb-2 text-left">Travail — réussite par critère</p>
      <CriteresCard criteres={criteres} />

      <div className="bg-piste-50 rounded-xl px-3 py-2.5 text-left mb-6">
        <p className="text-[11px] text-piste-500">Distance / durée totale de travail</p>
        <p className="text-sm font-medium text-piste-900">{distanceTotale} m · {formatDuree(dureeTotale)}</p>
      </div>

      {nbPausesTotal > 0 && (
        <div className="bg-piste-50 rounded-xl px-3 py-2.5 text-left mb-6">
          <p className="text-[11px] text-piste-500">Pauses (temps supplémentaire non décompté)</p>
          <p className="text-sm font-medium text-piste-900">
            {nbPausesTotal} pause{nbPausesTotal > 1 ? 's' : ''} · {formatDuree(dureePauseTotal)} au total
          </p>
        </div>
      )}

      <div className="space-y-3 text-left mb-6">
        {blocsResultats.map((b, i) => {
          const { icone: Icone, couleur, label } = STYLE_REUSSITE[b.reussite]
          return (
            <div key={b.blocId} className="bg-piste-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <Icone className={`${couleur} shrink-0`} size={20} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-piste-900">Bloc {i + 1} · {label}</p>
                  {b.note && <p className="text-xs text-piste-500 mt-0.5">{b.note}</p>}
                  {b.distanceCorrigeeManuellement && (
                    <p className="text-xs text-piste-400 mt-0.5">Distance corrigée manuellement (GPS indisponible)</p>
                  )}
                  {b.nbPauses > 0 && (
                    <p className="text-xs text-piste-400 mt-0.5">
                      {b.nbPauses} pause{b.nbPauses > 1 ? 's' : ''} · {formatDuree(b.dureePauseS || 0)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <PhaseRecap titre="Récupération" resultat={recuperationResultat} sautee={recuperationSautee} />

      {(pouls.repos != null || pouls.avantTravail != null || pouls.apresTravail != null || pouls.final != null) && (
        <>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {[['repos', 'Repos'], ['avantTravail', 'Avant travail'], ['apresTravail', 'Après effort'], ['final', 'Final']].map(([cle, label]) => (
              <div key={cle} className="bg-piste-50 rounded-xl px-1.5 py-2.5 text-center">
                <p className="text-[9px] text-piste-500">{label}</p>
                <p className="text-sm font-medium text-piste-900">{pouls[cle] != null ? pouls[cle] : '—'}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-piste-400 mb-6">Pouls (bpm/min) par moment de la séance</p>
        </>
      )}

      {observationTravail && (
        <div className="bg-piste-50 rounded-xl px-4 py-3 text-left mb-6">
          <p className="text-[11px] text-piste-500 mb-0.5">Observation à la fin du travail</p>
          <p className="text-xs text-piste-600">{observationTravail}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-2">
        {['echauffement', 'travail', 'recuperation'].map((cle) => (
          <div key={cle} className="bg-piste-50 rounded-xl px-2 py-2.5 text-center">
            <p className="text-[10px] text-piste-500 capitalize">{cle === 'recuperation' ? 'Récup' : cle}</p>
            <p className="text-sm font-medium text-piste-900">{borg[cle] != null ? `${borg[cle]}/10` : '—'}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-piste-400 mb-6">Ressenti (Borg) par phase</p>

      {observationGenerale && (
        <div className="bg-piste-50 rounded-xl px-4 py-3 text-left mb-8">
          <p className="text-xs text-piste-600">{observationGenerale}</p>
        </div>
      )}

      <button
        onClick={onRetourAccueil}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98] mt-2"
      >
        {labelRetour}
      </button>
    </div>
  )
}
