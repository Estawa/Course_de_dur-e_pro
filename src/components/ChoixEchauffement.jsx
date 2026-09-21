export default function ChoixEchauffement({ onChoix }) {
  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h2 className="font-display text-xl text-piste-900 mb-2">Échauffement</h2>
      <p className="text-sm text-piste-600 mb-8">
        Tu peux faire l'échauffement prévu pour cette séance, ou le passer si tu es déjà échauffé.
      </p>
      <button
        onClick={() => onChoix(true)}
        className="w-full bg-piste-800 hover:bg-piste-700 text-white font-medium py-3.5 rounded-xl transition active:scale-[0.98] mb-3"
      >
        Faire l'échauffement
      </button>
      <button onClick={() => onChoix(false)} className="text-xs text-piste-400 underline">
        Passer l'échauffement
      </button>
    </div>
  )
}
