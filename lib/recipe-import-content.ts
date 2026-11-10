/**
 * Imported recipe instructions are facts needed to prepare the dish, not a
 * place to reproduce a source's editorial article. Keep long values out of
 * normalized candidates so a review can add a concise step manually when it
 * is genuinely needed.
 */
export const maxImportedProceduralStepCharacters = 500

export function keepConciseProceduralSteps(values: readonly string[]) {
  const steps = values.filter(
    (value) => value.length <= maxImportedProceduralStepCharacters,
  )

  return {
    steps,
    omittedCount: values.length - steps.length,
  }
}

export const importedEditorialProseWarning =
  'Substantial source prose was not imported; only concise procedural steps were kept.'
