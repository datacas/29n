// Qué incluye cada tema al calibrar prioridades. Está en la interfaz y no en la release porque es solo una ayuda de lectura:
// los temas y sus preguntas siguen siendo los de la release congelada. Se indexa por el código del tema.
export const DIMENSION_HELP: Record<string, string> = {
  economy: 'Impuestos, empleo, deuda pública, autónomos y pequeñas empresas, precio de la energía y turismo.',
  environment: 'Cambio climático, energía, agua y sequía, biodiversidad, bienestar animal y residuos.',
  institutions: 'Cómo funciona el Estado: corrupción, justicia, sistema político, monarquía, Unión Europea, defensa y burocracia.',
  rights: 'Libertades y derechos civiles: aborto y final de la vida, igualdad y derechos LGTBI, lenguas, memoria democrática, nacionalidad y violencia machista.',
  social: 'Servicios y bienestar: vivienda, sanidad, educación, pensiones, inmigración, cuidados, pobreza y mundo rural.',
  territory: 'Cómo se reparte el poder entre territorios: modelo de Estado, financiación autonómica, autogobierno, despoblación y regímenes especiales como Canarias, Ceuta y Melilla.'
}

export function dimensionHelp(code: string | undefined): string {
  return (code && DIMENSION_HELP[code]) || ''
}
