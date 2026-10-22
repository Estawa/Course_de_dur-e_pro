import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { exporterTout, restaurerTout } from '../utils/cloud'

// Sauvegarde complète du cloud dans un fichier, et restauration de ce fichier (administrateur).
export default function SauvegardeComplete() {
  const [etat, setEtat] = useState('')
  const [occupe, setOccupe] = useState(false)

  async function exporter() {
    setOccupe(true); setEtat('Lecture de toutes les données du cloud…')
    try {
      const s = await exporterTout()
      const blob = new Blob([JSON.stringify(s)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `course-duree-pro-sauvegarde-complete-${s.exportLe.slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      setEtat(`✅ Sauvegarde téléchargée : ${s.compte.espaces} espace(s) professeur, ${s.compte.documents} document(s) (accès, classes, séances, réalisations, VMA, notes…). Garde ce fichier précieusement (Drive, mail…).`)
    } catch (e) {
      setEtat('❌ Sauvegarde impossible (réseau ?). Réessaie avec une bonne connexion.')
    }
    setOccupe(false)
  }

  async function restaurer(fichier) {
    setOccupe(true); setEtat('Lecture du fichier…')
    try {
      const s = JSON.parse(await fichier.text())
      if (s.app !== 'course-duree-pro') throw new Error("Ce fichier n'est pas une sauvegarde Course de Durée Pro.")
      const c = s.compte || {}
      if (!confirm(`Restaurer cette sauvegarde du ${new Date(s.exportLe).toLocaleString('fr-FR')} ?\n${c.espaces || 0} espace(s) professeur, ${c.documents || 0} document(s).\nLes documents du fichier remplaceront ceux qui portent le même nom ; les autres ne sont pas touchés.`)) { setOccupe(false); setEtat(''); return }
      setEtat('Restauration en cours…')
      const n = await restaurerTout(s)
      setEtat(`✅ Restauration terminée : ${n} document(s) écrit(s). Recharge l'appli pour voir les données.`)
    } catch (e) {
      setEtat('❌ ' + (e.message || 'Restauration impossible.'))
    }
    setOccupe(false)
  }

  return (
    <section className="bg-white rounded-2xl border border-piste-100 p-4 mt-4">
      <h3 className="font-semibold text-piste-900 mb-1">Sauvegarde complète</h3>
      <p className="text-xs text-piste-500 mb-3">Un fichier avec toutes les données du cloud : les accès et les espaces de tous les professeurs (classes, élèves, séances, réalisations, VMA, barèmes, notes du bac).</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={occupe} onClick={exporter} className="flex items-center gap-1.5 bg-piste-700 hover:bg-piste-800 disabled:opacity-50 text-white text-sm font-medium px-3.5 py-2 rounded-lg">
          <Download size={14} /> Sauvegarder tout
        </button>
        <label className={`flex items-center gap-1.5 border border-piste-200 text-piste-800 text-sm font-medium px-3.5 py-2 rounded-lg cursor-pointer ${occupe ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload size={14} /> Restaurer un fichier
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) restaurer(e.target.files[0]); e.target.value = '' }} />
        </label>
      </div>
      {etat && <p className="text-xs text-piste-700 mt-3">{etat}</p>}
    </section>
  )
}
