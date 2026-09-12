import { useState } from 'react'
import { Share2 } from 'lucide-react'
import EnseignantDashboard from './EnseignantDashboard'
import EspaceAcces from './EspaceAcces'
import PartageApp from './PartageApp'

// Pour un collègue (role !== 'admin') : pas d'onglets, juste son propre tableau de bord,
// sur son propre espace (déjà actif sur son appareil depuis sa connexion).
// Pour l'administrateur : bascule entre "Mes classes" (son espace personnel), "Vue globale"
// (l'espace d'un collègue au choix, en lecture/écriture) et "Accès" (gestion des collègues).
export default function EnseignantShell({
  role, accesConfig, onSauverAcces,
  espaceActif, codeAdminPersonnel, onChangerEspace, onDeconnexionEnseignant,
  ...dashboardProps
}) {
  const [vue, setVue] = useState('mes-classes')
  const [collegueVu, setCollegueVu] = useState('')
  const [partageOuvert, setPartageOuvert] = useState(false)

  if (role !== 'admin') {
    return (
      <div>
        <div className="max-w-3xl mx-auto px-4 pt-4 flex items-center justify-between">
          <button onClick={() => setPartageOuvert((v) => !v)} className="flex items-center gap-1.5 text-xs font-medium text-piste-700">
            <Share2 size={14} /> Partager mon lien
          </button>
          <button onClick={onDeconnexionEnseignant} className="text-xs text-piste-500 hover:text-piste-700">Se déconnecter</button>
        </div>
        {partageOuvert && <PartageApp />}
        <EnseignantDashboard {...dashboardProps} />
      </div>
    )
  }

  function choisirVue(v) {
    setVue(v)
    if (v === 'mes-classes' && espaceActif !== codeAdminPersonnel) {
      onChangerEspace(codeAdminPersonnel)
    }
  }

  function choisirCollegue(id) {
    setCollegueVu(id)
    const c = (accesConfig.collegues || []).find((x) => x.id === id)
    if (c) onChangerEspace(c.code)
  }

  const collegues = accesConfig.collegues || []
  const espacePret = vue === 'mes-classes' || (vue === 'globale' && collegueVu && espaceActif === collegues.find((c) => c.id === collegueVu)?.code)

  return (
    <div>
      <div className="flex gap-2 px-4 pt-4 pb-2 max-w-3xl mx-auto overflow-x-auto items-center">
        {[
          { id: 'mes-classes', label: 'Mes classes' },
          { id: 'globale', label: 'Vue globale' },
          { id: 'acces', label: 'Accès' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => choisirVue(t.id)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition ${vue === t.id ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-600'}`}
          >
            {t.label}
          </button>
        ))}
        {vue !== 'acces' && (
          <button onClick={() => setPartageOuvert((v) => !v)} className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-piste-700">
            <Share2 size={14} /> Partager
          </button>
        )}
        <button onClick={onDeconnexionEnseignant} className="ml-auto shrink-0 text-xs text-piste-500 hover:text-piste-700 self-center">
          Se déconnecter
        </button>
      </div>

      {partageOuvert && vue !== 'acces' && <PartageApp />}

      {vue === 'globale' && (
        <div className="max-w-3xl mx-auto px-4 mb-3">
          <select
            value={collegueVu}
            onChange={(e) => choisirCollegue(e.target.value)}
            className="w-full sm:w-64 bg-white border border-piste-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="" disabled>Choisir un collègue...</option>
            {collegues.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
          {collegues.length === 0 && (
            <p className="text-xs text-piste-400 mt-2">Aucun collègue ajouté pour l'instant (onglet Accès).</p>
          )}
        </div>
      )}

      {vue === 'acces' ? (
        <div className="max-w-3xl mx-auto px-4 pb-8">
          <EspaceAcces accesConfig={accesConfig} onSauver={onSauverAcces} />
        </div>
      ) : espacePret ? (
        <EnseignantDashboard key={espaceActif} {...dashboardProps} />
      ) : vue === 'globale' ? (
        <p className="max-w-3xl mx-auto px-4 text-sm text-piste-500">Choisis un collègue pour voir ses classes.</p>
      ) : (
        <p className="max-w-3xl mx-auto px-4 text-sm text-piste-500">Chargement...</p>
      )}
    </div>
  )
}
