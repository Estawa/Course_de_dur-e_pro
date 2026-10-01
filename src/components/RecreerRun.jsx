import { useState } from 'react'
import { storage } from '../utils/storage'
import { cloudEcrireRealisation } from '../utils/cloud'

// "h:mm:ss", "mm:ss" ou "1h36min18" → millisecondes
function versMs(texte) {
  const t = (texte || '').trim().toLowerCase()
  const hms = t.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?\s*(?:(\d+)\s*s?)?$/)
  if (hms && (hms[1] || hms[2])) return ((+hms[1] || 0) * 3600 + (+hms[2] || 0) * 60 + (+hms[3] || 0)) * 1000
  const parts = t.split(/[:'"]/).filter(Boolean).map(Number)
  if (!parts.length || parts.length > 3 || parts.some(isNaN)) return null
  const [hh, mm, ss] = parts.length === 3 ? parts : parts.length === 2 ? [0, ...parts] : [0, parts[0], 0]
  return (hh * 3600 + mm * 60 + ss) * 1000
}

// Réduit une image (capture d'écran) en JPEG ≤ 900 px de large pour tenir largement dans
// l'enregistrement en ligne (limite 1 Mo par séance).
function compresserImage(fichier) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const echelle = Math.min(1, 900 / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * echelle)
      canvas.height = Math.round(img.height * echelle)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      let qualite = 0.75
      let data = canvas.toDataURL('image/jpeg', qualite)
      while (data.length > 600000 && qualite > 0.3) {
        qualite -= 0.1
        data = canvas.toDataURL('image/jpeg', qualite)
      }
      resolve(data)
    }
    img.onerror = () => reject(new Error('Image illisible'))
    img.src = URL.createObjectURL(fichier)
  })
}

const PHASES_DEFAUT = [
  { phase: 'echauffement', label: 'Échauffement', duree: '0:05:04', distance: '613', vitesse: '5.9', pct: '41' },
  { phase: 'course', label: 'Course', duree: '1:36:18', distance: '10610', vitesse: '6.9', pct: '48' },
  { phase: 'recuperation', label: 'Récupération', duree: '0:30:31', distance: '3970', vitesse: '7.5', pct: '52' }
]

// Recrée à la main un run libre perdu (sans trace GPS), à partir des chiffres de son bilan,
// rattaché à un élève existant (par défaut C. Guilhem, classe PROF).
export default function RecreerRun({ espaceId, eleve, onFait, onAnnuler }) {
  const [date, setDate] = useState('')
  const [heure, setHeure] = useState('16:00')
  const [phases, setPhases] = useState(PHASES_DEFAUT)
  const [vMax, setVMax] = useState('21.1')
  const [meilleurKm, setMeilleurKm] = useState("5'38")
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [image, setImage] = useState(null)

  const maj = (i, champ, v) => setPhases((p) => p.map((x, j) => (j === i ? { ...x, [champ]: v } : x)))
  const phasesCalc = phases.map((p) => ({
    phase: p.phase,
    dureeMs: versMs(p.duree),
    distanceM: Math.round(+p.distance),
    vitesseMoyenne: +String(p.vitesse).replace(',', '.'),
    pctVmaMoyen: p.pct === '' ? null : +p.pct
  }))
  const valide = date && phasesCalc.every((p) => p.dureeMs != null && !isNaN(p.distanceM) && !isNaN(p.vitesseMoyenne))
  const totalMs = phasesCalc.reduce((a, p) => a + (p.dureeMs || 0), 0)
  const totalM = phasesCalc.reduce((a, p) => a + (p.distanceM || 0), 0)

  async function enregistrer() {
    if (!valide) return
    setEnCours(true)
    const realisation = {
      id: crypto.randomUUID(),
      eleve: { id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, classe: eleve.classe, teacherId: espaceId },
      seanceId: 'run-direct',
      seanceTitre: 'Run direct séance complète',
      niveauNom: '',
      date: new Date(`${date}T${heure || '12:00'}`).getTime(),
      blocsResultats: [],
      runDirect: {
        mode: 'complete',
        dureeGlobaleMs: totalMs,
        distanceGlobaleM: totalM,
        phases: phasesCalc,
        points: [],
        vitesseMaxKmh: vMax === '' ? null : +String(vMax).replace(',', '.'),
        meilleurKmMs: versMs(meilleurKm),
        recree: true,
        ...(image ? { imageTrajet: image } : {})
      }
    }
    storage.ajouterRealisation(realisation)
    const ok = await cloudEcrireRealisation(espaceId, realisation)
    setEnCours(false)
    if (!ok) return setErreur("L'enregistrement en ligne a échoué : vérifie le réseau et réessaie.")
    onFait()
  }

  const champ = 'w-full rounded-lg border border-piste-200 px-2 py-1.5 text-sm bg-white'
  const h = Math.floor(totalMs / 3600000)
  const m = Math.floor((totalMs % 3600000) / 60000)
  const s = Math.round((totalMs % 60000) / 1000)

  return (
    <div className="rounded-xl border border-piste-800 px-3 py-3 space-y-3">
      <p className="text-sm font-medium text-piste-900">
        Recréer un run libre pour {eleve.prenom} {eleve.nom} ({eleve.classe})
      </p>
      <p className="text-[11px] text-piste-500">Pré-rempli avec ta capture. La carte interactive ne peut pas être recréée, mais tu peux joindre ta capture.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-piste-600">Date du run<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={champ} /></label>
        <label className="text-[11px] text-piste-600">Heure de fin<input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={champ} /></label>
      </div>
      {phases.map((p, i) => (
        <div key={p.phase}>
          <p className="text-xs font-medium text-piste-800 mb-1">{p.label}</p>
          <div className="grid grid-cols-4 gap-1.5">
            <label className="text-[10px] text-piste-500">Durée h:mm:ss<input value={p.duree} onChange={(e) => maj(i, 'duree', e.target.value)} className={champ} /></label>
            <label className="text-[10px] text-piste-500">Distance m<input inputMode="numeric" value={p.distance} onChange={(e) => maj(i, 'distance', e.target.value)} className={champ} /></label>
            <label className="text-[10px] text-piste-500">km/h<input inputMode="decimal" value={p.vitesse} onChange={(e) => maj(i, 'vitesse', e.target.value)} className={champ} /></label>
            <label className="text-[10px] text-piste-500">% VMA<input inputMode="numeric" value={p.pct} onChange={(e) => maj(i, 'pct', e.target.value)} className={champ} /></label>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-piste-600">Vitesse max km/h<input inputMode="decimal" value={vMax} onChange={(e) => setVMax(e.target.value)} className={champ} /></label>
        <label className="text-[11px] text-piste-600">Meilleur km (m'ss)<input value={meilleurKm} onChange={(e) => setMeilleurKm(e.target.value)} className={champ} /></label>
      </div>
      <div>
        <p className="text-[11px] text-piste-600 mb-1">Image du trajet (facultatif) : ta capture de la carte, recadrée si possible</p>
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try { setImage(await compresserImage(f)); setErreur(null) } catch (err) { setErreur(err.message) }
          }}
          className="text-xs"
        />
        {image && (
          <div className="mt-2 relative">
            <img src={image} alt="Aperçu du trajet" className="w-full rounded-xl" />
            <button onClick={() => setImage(null)} className="absolute top-1.5 right-1.5 bg-white/90 text-xs font-medium text-alerte px-2 py-1 rounded-lg">Retirer</button>
          </div>
        )}
      </div>
      <p className="text-xs text-piste-700">
        Total : {h}h{String(m).padStart(2, '0')}min{String(s).padStart(2, '0')} · {(totalM / 1000).toFixed(2).replace('.', ',')} km
      </p>
      {erreur && <p className="text-xs text-alerte">{erreur}</p>}
      <div className="flex gap-2">
        <button onClick={onAnnuler} className="flex-1 bg-piste-50 text-piste-700 text-sm font-medium py-2.5 rounded-xl">Annuler</button>
        <button onClick={enregistrer} disabled={!valide || enCours} className="flex-1 bg-piste-800 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl">
          {enCours ? 'Enregistrement…' : 'Recréer le run'}
        </button>
      </div>
      {!date && <p className="text-[11px] text-piste-500">Indique la date pour pouvoir enregistrer.</p>}
    </div>
  )
}
