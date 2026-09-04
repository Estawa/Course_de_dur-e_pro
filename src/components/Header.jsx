import { ArrowLeft, GraduationCap } from 'lucide-react'

export default function Header({ title, onBack, onEnseignant, showEnseignant = true }) {
  return (
    <header className="sticky top-0 z-20 bg-piste-900 text-piste-50 shadow-md">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-piste-800 active:scale-95 transition"
              aria-label="Retour"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-lg leading-tight truncate">{title}</h1>
            <p className="text-[11px] text-piste-300 tracking-wide">Course de Durée Pro by C. Guilhem · v1.8.1</p>
          </div>
        </div>
        {showEnseignant && (
          <button
            onClick={onEnseignant}
            className="flex items-center gap-1.5 text-xs font-medium bg-piste-800 hover:bg-piste-700 px-3 py-1.5 rounded-full transition active:scale-95"
          >
            <GraduationCap size={15} />
            Enseignant
          </button>
        )}
      </div>
    </header>
  )
}
