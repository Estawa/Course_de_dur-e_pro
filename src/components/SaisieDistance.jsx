import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Undo2 } from 'lucide-react'
import { formatDuree } from '../utils/calc'
import { distancePlausible } from '../utils/guidage'
import { beep } from '../utils/audio'

// Saisie par l'élève de la distance qu'il vient de parcourir, qu'il calcule lui-même (tours ×
// 400 m + plots/mètres) et convertit en km + m. Aucune mesure GPS n'est affichée ici.
// - Contrôle de cohérence au regard du temps de course : tant que la distance paraît
//   incohérente, l'élève doit la confirmer ou la modifier (chaque modification est revérifiée).
// - retourFinTs (facultatif) : l'élève doit retourner à la ligne de départ pendant la
//   récupération ; un grand décompte l'affiche. Une fois la distance validée ET le décompte
//   terminé, onPret() relance la partie suivante.
export default function SaisieDistance({ titre, dureeCourseS, tours = 0, retourFinTs = null, libelleSuite = 'la prochaine répétition', distanceInitiale = null, onValide, onPret }) {
  const [km, setKm] = useState(distanceInitiale != null ? String(Math.floor(distanceInitiale / 1000)) : '')
  const [m, setM] = useState(distanceInitiale != null ? String(distanceInitiale % 1000) : '')
  const [etape, setEtape] = useState(distanceInitiale != null ? 'valide' : 'saisie') // saisie | incoherent | valide
  const [maintenant, setMaintenant] = useState(Date.now())
  const pretEnvoyeRef = useRef(false)
  const dernierBipRef = useRef(null)

  useEffect(() => {
    if (!retourFinTs) return
    const iv = setInterval(() => setMaintenant(Date.now()), 250)
    return () => clearInterval(iv)
  }, [retourFinTs])

  const restantS = retourFinTs ? Math.max(0, (retourFinTs - maintenant) / 1000) : 0

  // Petits bips sur les 3 dernières secondes du décompte de retour.
  useEffect(() => {
    if (!retourFinTs) return
    const s = Math.ceil(restantS)
    if (s <= 3 && s > 0 && dernierBipRef.current !== s) {
      dernierBipRef.current = s
      beep({ freq: 660, duration: 0.1, volume: 0.3 })
    }
  }, [restantS, retourFinTs])

  useEffect(() => {
    if (etape === 'valide' && retourFinTs && restantS <= 0 && !pretEnvoyeRef.current) {
      pretEnvoyeRef.current = true
      onPret?.()
    }
  }, [etape, restantS, retourFinTs, onPret])

  const distance = (parseInt(km, 10) || 0) * 1000 + (parseInt(m, 10) || 0)
  const saisieVide = km === '' && m === ''
  const mInvalide = m !== '' && (parseInt(m, 10) > 999 || parseInt(m, 10) < 0)

  function accepter() {
    setEtape('valide')
    onValide(distance)
    if (!retourFinTs) return
    if (restantS <= 0 && !pretEnvoyeRef.current) {
      pretEnvoyeRef.current = true
      onPret?.()
    }
  }

  function valider() {
    if (!distancePlausible(distance, dureeCourseS)) {
      setEtape('incoherent')
      return
    }
    accepter()
  }

  return (
    <div className="max-w-md mx-auto px-6 py-6">
      {retourFinTs && (
        <div className="rounded-2xl bg-alerte text-white px-5 py-5 mb-5 text-center">
          <p className="font-display text-xl leading-snug">Retourne au départ avant {libelleSuite} !</p>
          <p className="font-display text-6xl tabular-nums mt-2">{formatDuree(restantS)}</p>
          <p className="text-xs opacity-90 mt-1">
            {restantS > 0 ? 'de récupération restante' : etape === 'valide' ? 'Départ !' : 'Récupération terminée : valide ta distance pour repartir'}
          </p>
        </div>
      )}

      <p className="text-xs uppercase tracking-wide text-piste-500 text-center mb-1">{titre}</p>
      <h2 className="font-display text-2xl text-piste-900 text-center mb-1">Quelle distance as-tu parcourue ?</h2>
      <p className="text-sm text-piste-600 text-center mb-5">
        Temps de course : {formatDuree(dureeCourseS || 0)}
        {tours > 0 && ` · ${tours} tour${tours > 1 ? 's' : ''} compté${tours > 1 ? 's' : ''}`}
      </p>

      {etape === 'valide' ? (
        <div className="flex items-center justify-center gap-2 bg-piste-50 rounded-xl px-4 py-4 text-piste-800">
          <CheckCircle2 size={18} className="text-piste-600" />
          <span className="text-sm font-medium">
            Distance enregistrée : {Math.floor(distance / 1000) > 0 ? `${Math.floor(distance / 1000)} km ` : ''}{distance % 1000} m
          </span>
        </div>
      ) : (
        <>
          <p className="text-xs text-piste-500 text-center mb-3">
            Calcule-la toi-même à partir de tes tours et des plots, puis convertis-la en km et m.
          </p>
          <div className="flex items-end justify-center gap-3 mb-4">
            <div className="text-center">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={km}
                onChange={(e) => { setKm(e.target.value); setEtape('saisie') }}
                placeholder="0"
                className="w-24 text-center text-3xl font-display rounded-xl border-2 border-piste-200 px-2 py-3 focus:outline-none focus:border-piste-500"
              />
              <p className="text-xs text-piste-600 mt-1">km</p>
            </div>
            <div className="text-center">
              <input
                type="number"
                min="0"
                max="999"
                inputMode="numeric"
                value={m}
                onChange={(e) => { setM(e.target.value); setEtape('saisie') }}
                placeholder="0"
                className="w-28 text-center text-3xl font-display rounded-xl border-2 border-piste-200 px-2 py-3 focus:outline-none focus:border-piste-500"
              />
              <p className="text-xs text-piste-600 mt-1">m</p>
            </div>
          </div>
          {mInvalide && <p className="text-xs text-alerte text-center mb-3">Les mètres doivent être compris entre 0 et 999.</p>}

          {etape === 'incoherent' ? (
            <div className="rounded-xl border-2 border-alerte/50 bg-[#fbeeea] p-4">
              <p className="flex items-start gap-2 text-sm text-piste-800 mb-3">
                <AlertTriangle size={18} className="text-alerte shrink-0 mt-0.5" />
                Au regard de ton temps de course, la distance annoncée paraît incohérente. Confirme-la, ou modifie-la.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEtape('saisie')}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-piste-800 text-white text-sm font-medium py-3 rounded-xl"
                >
                  <Undo2 size={15} /> Modifier
                </button>
                <button
                  onClick={accepter}
                  className="flex-1 border-2 border-piste-300 text-piste-700 text-sm font-medium py-3 rounded-xl"
                >
                  Confirmer
                </button>
              </div>
            </div>
          ) : (
            <button
              disabled={saisieVide || mInvalide}
              onClick={valider}
              className="w-full bg-piste-800 hover:bg-piste-700 disabled:opacity-40 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98]"
            >
              Valider ma distance
            </button>
          )}
        </>
      )}
    </div>
  )
}
