// Qué incluye cada tema al calibrar prioridades. Está en la interfaz y no en la release porque es solo una ayuda de lectura:
// los temas y sus preguntas siguen siendo los de la release congelada. Se indexa por el código del tema.
export const DIMENSION_HELP: Record<string, string> = {
  economy: 'Impuestos, empleo, deuda pública, autónomos y pequeñas empresas, precio de la energía y turismo.',
  environment: 'Cambio climático, energía, agua y sequía, biodiversidad, bienestar animal y residuos.',
  institutions: 'Cómo funciona el Estado: corrupción, justicia, sistema político, monarquía, Unión Europea, defensa y burocracia.',
  rights: 'Libertades y derechos civiles: aborto y final de la vida, igualdad y derechos LGTBI, lenguas, memoria democrática, nacionalidad y violencia machista.',
  social: 'Servicios y bienestar: vivienda, sanidad, educación, pensiones, inmigración, cuidados, pobreza y mundo rural.',
  // Encuesta histórica (1917–1936)
  'h1-regimen': 'Cómo se gobierna el país: Parlamento y elecciones, romper o no con la Constitución, libertades para los adversarios, autonomía de las regiones y expansión territorial.',
  'h2-sociedad': 'Religión, educación y defensa: separación entre Iglesia y Estado, libertad de los colegios privados y religiosos, y ejército profesional o milicia del pueblo.',
  'h3-economia': 'Quién es dueño de qué: reparto de la tierra, banca pública, empresas públicas o privadas, e impuestos progresivos.',
  'h4-trabajo': 'Derechos y conflictos en el trabajo: control obrero de las empresas, huelga en los servicios públicos y subsidio de paro.',
  territory: 'Cómo se reparte el poder entre territorios: modelo de Estado, financiación autonómica, autogobierno, despoblación y regímenes especiales como Canarias, Ceuta y Melilla.'
}

export function dimensionHelp(code: string | undefined): string {
  return (code && DIMENSION_HELP[code]) || ''
}
