export function QuestEmptyState() {
  return (
    <div
      className="quest-empty-state"
      aria-labelledby="quest-empty-title"
      aria-describedby="quest-empty-description"
      aria-live="polite"
      role="status"
      data-testid="quest-empty-state"
    >
      <div className="quest-empty-state__origin" aria-hidden="true" />
      <div className="quest-empty-state__message">
        <p>TRAZO</p>
        <h1 id="quest-empty-title">Tu ruta empieza aquí</h1>
        <p id="quest-empty-description">
          Crea una Quest desde ChatGPT y conviértela en un camino visible.
        </p>
        <span>Cuando ChatGPT cree o modifique tu ruta, aparecerá aquí.</span>
      </div>
    </div>
  )
}
