import { useEffect, useRef, useState } from 'react'
import { X, ChevronDown, ChevronUp, Minus, Plus, Download } from 'lucide-react'
import { storage } from '../utils/storage'
import { syntheseCycle } from '../utils/calc'
import { loadBacClasse, cloudEcrireBacClasse } from '../utils/cloud'
import {
  THEMES_EPREUVE, allures, degreDepuisHorsZone, ELEMENTS, DEGRES_AFL2_GT, ROLES_AFL3_GT, DEGRES_PRO_AFLP3, DEGRES_PRO_AFLP4,
  REPARTITIONS, pointsRepartition, pointsFixes, plageFil, valeurs, calculerNoteBacCourse,
} from '../utils/bacCourse'

// Épreuve et note du bac d'une classe (v1.64.0) : thème d'épreuve du protocole, compteur de
// passages hors zone, degrés et note du bac, à côté de la note de cycle (inchangée).

const fmt = (x) => (x === null || x === undefined || Number.isNaN(x) ? '—' : String(Math.round(x * 100) / 100).replace('.', ','))
const cleEleve = (e) => e.id || `${e.nom}__${e.prenom}`

function Degres({ valeur, onChange, descriptions, points, conseille }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {[1, 2, 3, 4].map((d) => (
          <button key={d} type="button" title={descriptions?.[d - 1]} onClick={() => onChange(valeur === d ? null : d)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${valeur === d ? 'bg-piste-800 text-white border-piste-800' : conseille === d ? 'border-piste-500 text-piste-800 bg-piste-50' : 'border-piste-200 text-piste-600 bg-white'}`}>
            D{d}{points ? ` · ${points(d)}` : ''}{conseille === d && valeur !== d ? ' ★' : ''}
          </button>
        ))}
      </div>
      {valeur && descriptions && <p className="text-[11px] text-piste-500 mt-1 leading-snug">{descriptions[valeur - 1]}</p>}
    </div>
  )
}

function Valeur({ valeur, liste, onChange }) {
  return (
    <select value={valeur ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="mt-1.5 rounded-lg border border-piste-200 px-2 py-1 text-xs bg-white">
      <option value="">—</option>
      {liste.map((v) => <option key={v} value={v}>{fmt(v)}</option>)}
    </select>
  )
}

function Bloc({ titre, note, sur, children }) {
  return (
    <div className="bg-piste-50 rounded-xl p-3">
      <div className="flex justify-between items-baseline gap-2 mb-1.5">
        <p className="text-[11px] font-semibold text-piste-700">{titre}</p>
        <span className="text-xs font-semibold text-piste-900 whitespace-nowrap">{fmt(note)} / {sur}</span>
      </div>
      {children}
    </div>
  )
}

export function Editeur({ typeBac, s, vma, onMaj }) {
  const gt = typeBac === 'gt'
  const res = calculerNoteBacCourse(typeBac, s)
  const [pa, pb] = pointsRepartition(s.repartition)
  const theme = THEMES_EPREUVE.find((t) => t.id === s.theme)
  const al = allures(theme, vma)
  const conseille = degreDepuisHorsZone(typeof s.horsZone === 'number' ? s.horsZone : null)

  return (
    <div className="space-y-2 pt-2">
      <Bloc titre="Épreuve — thème choisi et passages hors zone">
        <div className="flex flex-wrap gap-1 mb-1.5">
          {THEMES_EPREUVE.map((t) => (
            <button key={t.id} type="button" onClick={() => onMaj({ theme: s.theme === t.id ? null : t.id })}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${s.theme === t.id ? 'bg-piste-800 text-white border-piste-800' : 'border-piste-200 text-piste-600 bg-white'}`}>
              {t.libelle} · {t.pctMin}-{t.pctMax} %
            </button>
          ))}
        </div>
        {theme && (
          <p className="text-[11px] text-piste-600 mb-2">
            {theme.effet} : 10 min d’échauffement + {theme.duree} min de courses / récupérations, {theme.pctMin} à {theme.pctMax} % de VMA
            {al ? ` → ${fmt(al.min)} à ${fmt(al.max)} km/h (VMA ${fmt(vma)})` : ' (VMA non renseignée)'}.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-piste-700">Passages hors zone</span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => onMaj({ horsZone: Math.max(0, (s.horsZone || 0) - 1) })} className="w-8 h-8 rounded-lg border border-piste-300 bg-white flex items-center justify-center"><Minus size={14} /></button>
            <span className="w-8 text-center font-display text-xl text-piste-900">{s.horsZone ?? 0}</span>
            <button type="button" onClick={() => onMaj({ horsZone: (s.horsZone || 0) + 1 })} className="w-8 h-8 rounded-lg border border-piste-300 bg-white flex items-center justify-center"><Plus size={14} /></button>
          </span>
        </div>
        <p className="text-[11px] text-piste-500 mt-1">
          Plus de 12 → D1 · 9 à 12 → D2 · 3 à 8 → D3 · moins de 3 → D4{typeof s.horsZone === 'number' ? ` : degré conseillé ${conseille} (★)` : ''}.
        </p>
      </Bloc>

      {ELEMENTS[gt ? 'gt' : 'pro'].map((el) => (
        <Bloc key={el.cle} titre={el.titre} note={res[el.cle]} sur={el.sur}>
          <Degres
            valeur={s[`${el.cle}Degre`]}
            descriptions={el.degres}
            conseille={el.horsZone ? conseille : null}
            points={(d) => (el.fixe ? fmt(el.fixe[d - 1]) : el.plages[d].map(fmt).join('-'))}
            onChange={(d) => onMaj(el.fixe ? { [`${el.cle}Degre`]: d } : { [`${el.cle}Degre`]: d, [`${el.cle}Note`]: d ? el.plages[d][1] : null })}
          />
          {!el.fixe && s[`${el.cle}Degre`] && (
            <Valeur valeur={s[`${el.cle}Note`]} liste={valeurs(el.plages[s[`${el.cle}Degre`]], el.pas)} onChange={(v) => onMaj({ [`${el.cle}Note`]: v })} />
          )}
        </Bloc>
      ))}

      <Bloc titre={`Fil de séquence — ${gt ? 'AFL 2 + AFL 3' : 'AFLP 3 + AFLP 4'}`} note={res.fil} sur={8}>
        <label className="flex items-center gap-2 text-[11px] text-piste-600 mb-2">
          Répartition
          <select value={s.repartition || '4-4'}
            onChange={(e) => {
              const r = e.target.value
              const [na, nb] = pointsRepartition(r)
              if (gt) onMaj({ repartition: r })
              else onMaj({
                repartition: r,
                aflp3Note: s.aflp3Degre ? plageFil(na, s.aflp3Degre)[1] : s.aflp3Note ?? null,
                aflp4Note: s.aflp4Degre ? plageFil(nb, s.aflp4Degre)[1] : s.aflp4Note ?? null,
              })
            }}
            className="rounded-lg border border-piste-200 px-2 py-1 text-xs bg-white">
            {REPARTITIONS.map((r) => {
              const [a, b] = pointsRepartition(r)
              return <option key={r} value={r}>{gt ? `AFL 2 : ${a} — AFL 3 : ${b}` : `AFLP 3 : ${a} — AFLP 4 : ${b}`}</option>
            })}
          </select>
        </label>
        {gt ? (
          <div className="space-y-2">
            <div>
              <p className="text-[11px] text-piste-700 mb-1">AFL 2 — Carnet d’entraînement, engagement · /{pa} · {fmt(res.afl2)}</p>
              <Degres valeur={s.afl2Degre} descriptions={DEGRES_AFL2_GT} points={(d) => fmt(pointsFixes(pa, d))} onChange={(d) => onMaj({ afl2Degre: d })} />
            </div>
            <div>
              <p className="text-[11px] text-piste-700 mb-1">AFL 3 — Rôle choisi par l’élève · /{pb} · {fmt(res.afl3)}</p>
              <div className="flex gap-1 mb-1.5">
                {ROLES_AFL3_GT.map((r) => (
                  <button key={r.id} type="button" onClick={() => onMaj({ afl3Role: s.afl3Role === r.id ? null : r.id })}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${s.afl3Role === r.id ? 'bg-piste-700 text-white border-piste-700' : 'border-piste-200 text-piste-600 bg-white'}`}>
                    {r.libelle}
                  </button>
                ))}
              </div>
              {s.afl3Role && (
                <Degres valeur={s.afl3Degre} descriptions={ROLES_AFL3_GT.find((r) => r.id === s.afl3Role)?.degres}
                  points={(d) => fmt(pointsFixes(pb, d))} onChange={(d) => onMaj({ afl3Degre: d })} />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {[
              { cle: 'aflp3', titre: 'AFLP 3 — Retour réflexif, réguler sa charge', pts: pa, desc: DEGRES_PRO_AFLP3 },
              { cle: 'aflp4', titre: 'AFLP 4 — Rôles : coach, observateur-collecteur', pts: pb, desc: DEGRES_PRO_AFLP4 },
            ].map(({ cle, titre, pts, desc }) => (
              <div key={cle}>
                <p className="text-[11px] text-piste-700 mb-1">{titre} · /{pts} · {fmt(s[`${cle}Note`])}</p>
                <Degres valeur={s[`${cle}Degre`]} descriptions={desc} points={(d) => plageFil(pts, d).map(fmt).join('-')}
                  onChange={(d) => onMaj({ [`${cle}Degre`]: d, [`${cle}Note`]: d ? plageFil(pts, d)[1] : null })} />
                {s[`${cle}Degre`] && (
                  <Valeur valeur={s[`${cle}Note`]} liste={valeurs(plageFil(pts, s[`${cle}Degre`]), 0.1)} onChange={(v) => onMaj({ [`${cle}Note`]: v })} />
                )}
              </div>
            ))}
            <p className="text-[11px] text-piste-500">Meilleur degré atteint au cours de la séquence, puis valeur dans la plage.</p>
          </div>
        )}
      </Bloc>
    </div>
  )
}

export default function EpreuveBacCourse({ classe, eleves, teacherId, typeBac, onFermer }) {
  const [donnees, setDonnees] = useState(null) // { eleves: {cle: saisie}, retenue: {cle: 'cycle'|'bac'} }
  const [ouvert, setOuvert] = useState(null)
  const [etat, setEtat] = useState('')
  const premier = useRef(true)

  useEffect(() => {
    let actif = true
    loadBacClasse(teacherId, classe).then((d) => { if (actif) { premier.current = true; setDonnees(d) } })
    return () => { actif = false }
  }, [teacherId, classe])

  // Enregistrement automatique (petit délai pour regrouper les saisies)
  useEffect(() => {
    if (!donnees) return
    if (premier.current) { premier.current = false; return }
    setEtat('en-cours')
    const t = setTimeout(async () => {
      const ok = await cloudEcrireBacClasse(teacherId, classe, donnees)
      setEtat(ok ? 'ok' : 'erreur')
    }, 600)
    return () => clearTimeout(t)
  }, [donnees, teacherId, classe])

  const majEleve = (cle, patch) => setDonnees((d) => ({ ...d, eleves: { ...d.eleves, [cle]: { ...(d.eleves[cle] || {}), ...patch } } }))
  const retenir = (cle, choix) => setDonnees((d) => ({ ...d, retenue: { ...d.retenue, [cle]: choix } }))
  const vmaDe = (e) => (e.id ? storage.getVmaRetenue({ id: e.id, nom: e.nom, prenom: e.prenom, classe }) : null)
  const cycleDe = (e) => syntheseCycle(e.realisations || [])?.moyenne ?? null

  function exporterCSV() {
    const gt = typeBac === 'gt'
    const entetes = ['Nom', 'Prénom', 'Thème', 'Hors zone', ...(gt ? ['Élém. 1 /8', 'Élém. 2 /4', 'AFL 1 /12', 'AFL 2', 'AFL 3'] : ['AFLP 1 /7', 'AFLP 2 /5', 'Fin séq. /12', 'AFLP 3', 'AFLP 4']), 'Fil /8', 'Bac /20', 'Cycle /20', 'Note retenue']
    const nb = (x) => (x == null ? '' : String(x).replace('.', ','))
    const lignes = eleves.map((e) => {
      const s = donnees.eleves[cleEleve(e)] || {}
      const r = calculerNoteBacCourse(typeBac, s)
      const theme = THEMES_EPREUVE.find((t) => t.id === s.theme)
      const choix = donnees.retenue[cleEleve(e)]
      return [e.nom, e.prenom, theme ? theme.libelle : '', s.horsZone ?? '',
        ...(gt ? [r.e1, r.e2, r.fin, r.afl2, r.afl3] : [r.aflp1, r.aflp2, r.fin, r.aflp3, r.aflp4]).map(nb),
        nb(r.fil), nb(r.total), nb(cycleDe(e)), choix === 'bac' ? 'Bac' : choix === 'cycle' ? 'Cycle' : '']
    })
    const echap = (v) => { const t = String(v ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
    const csv = '﻿' + [entetes, ...lignes].map((l) => l.map(echap).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `bac-course-${String(classe).replace(/[^a-z0-9-]+/gi, '_')}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-white/95 backdrop-blur flex items-center justify-between border-b border-piste-100">
          <div>
            <p className="text-base font-semibold text-piste-900">Épreuve et note du bac — {classe}</p>
            <p className="text-[11px] text-piste-500">
              {etat === 'en-cours' ? 'Enregistrement…' : etat === 'ok' ? 'Enregistré' : etat === 'erreur' ? '⚠ Échec de l’enregistrement (connexion ?)' : typeBac === 'gt' ? 'Bac général et technologique' : typeBac === 'pro' ? 'Bac professionnel' : 'Type de bac à préciser'}
            </p>
          </div>
          <button onClick={onFermer} className="w-10 h-10 rounded-xl border border-piste-200 flex items-center justify-center"><X size={18} /></button>
        </div>

        {!typeBac ? (
          <p className="text-sm text-alerte">Choisis d’abord le type d’évaluation de la classe (Bac GT ou Bac Pro), au-dessus de la liste des élèves.</p>
        ) : !donnees ? (
          <p className="text-sm text-piste-500">Chargement…</p>
        ) : (
          <>
            <p className="text-xs text-piste-600 leading-relaxed">
              Protocole du lycée : {typeBac === 'gt' ? 'AFL 1 /12 (élément 1 /8 + élément 2 /4) + AFL 2 et AFL 3 /8, points fixes.' : 'AFLP 1 /7 + AFLP 2 /5 + AFLP 3 et AFLP 4 /8, plages de points.'}{' '}
              3 thèmes d’épreuve (les thèmes d’entraînement de l’appli restent pour les séances), un coup de sifflet par minute, zone de passage de 3 à 5 m.
              La note de cycle reste calculée comme avant : coche celle que tu retiens.
            </p>
            <button onClick={exporterCSV} className="flex items-center gap-1.5 text-xs font-medium text-piste-700 border border-piste-200 rounded-xl px-3 py-2">
              <Download size={13} /> Export CSV (Excel / Pronote)
            </button>
            <div className="divide-y divide-piste-100 border border-piste-100 rounded-xl">
              {eleves.map((e) => {
                const cle = cleEleve(e)
                const s = donnees.eleves[cle] || {}
                const res = calculerNoteBacCourse(typeBac, s)
                const cycle = cycleDe(e)
                const choix = donnees.retenue[cle] || null
                const estOuvert = ouvert === cle
                const theme = THEMES_EPREUVE.find((t) => t.id === s.theme)
                return (
                  <div key={cle} className="px-3 py-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => setOuvert(estOuvert ? null : cle)} className="flex-1 min-w-[9rem] flex items-center gap-1.5 text-left">
                        {estOuvert ? <ChevronUp size={14} className="text-piste-400" /> : <ChevronDown size={14} className="text-piste-400" />}
                        <span className="text-sm font-medium text-piste-900">{e.prenom} {e.nom}</span>
                        <span className="text-[11px] text-piste-400">{theme ? theme.libelle : ''}{typeof s.horsZone === 'number' ? ` · ${s.horsZone} hors zone` : ''}</span>
                      </button>
                      <label className={`flex items-center gap-1 text-[11px] ${choix === 'cycle' ? 'font-semibold text-piste-900' : 'text-piste-600'}`}>
                        <input type="radio" name={`ret-${cle}`} checked={choix === 'cycle'} disabled={cycle == null} onChange={() => retenir(cle, 'cycle')} />
                        Cycle {fmt(cycle)}
                      </label>
                      <label className={`flex items-center gap-1 text-[11px] ${choix === 'bac' ? 'font-semibold text-piste-900' : 'text-piste-600'}`}>
                        <input type="radio" name={`ret-${cle}`} checked={choix === 'bac'} disabled={res.total == null} onChange={() => retenir(cle, 'bac')} />
                        Bac {fmt(res.total)}
                      </label>
                    </div>
                    {estOuvert && (
                      <>
                        <p className="text-[11px] text-piste-500 mt-1">Bac : {fmt(res.fin)}/12 + {fmt(res.fil)}/8 = <b>{fmt(res.total)}/20</b></p>
                        <Editeur typeBac={typeBac} s={s} vma={vmaDe(e)} onMaj={(patch) => majEleve(cle, patch)} />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
