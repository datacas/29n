# Verificación de las métricas de concordancia con implementaciones externas

Código propio: `scripts/methodology/agreement.mjs`. Contraste: `scripts/methodology/verify_external/` (`dump.mjs` genera los datos y los resultados propios; `compare.py` los compara con librerías externas). Entorno: `python3 -m venv` + `pip install -r requirements.txt` (`krippendorff`, `scikit-learn`, `irrCAC`).

## Conjuntos
Un ejemplo de 15 unidades y 4 evaluadores con datos ausentes; ordinal de 4 evaluadores con 20 % de ausentes (200 unidades); ordinal muy sesgado (90 % en un valor); ordinal de 2 evaluadores completo; nominal de 5 clases con 3 evaluadores y ausentes; y un caso degenerado sin variación. Generados con semilla fija.

## Resultados (diferencia absoluta máxima respecto a la librería externa)
| Métrica | Referencia externa | Dif. máxima |
|---|---|---|
| Alfa de Krippendorff nominal, ordinal e intervalo | paquete `krippendorff` | ≤ 5·10⁻¹⁶ (incluye datos ausentes) |
| Kappa de Cohen sin ponderar, lineal y cuadrático | `scikit-learn` | ≤ 3·10⁻¹⁶ |
| Gwet AC1 y AC2 (lineal y cuadrático) | `irrCAC` | ≤ 7·10⁻⁶ (la librería devuelve el coeficiente redondeado) |
| Caso degenerado (sin variación) | ambos | alfa indefinido (NaN) en ambos; AC1/AC2 = 1 |

## Hallazgo durante la verificación
La primera versión de AC1/AC2 calculaba las proporciones marginales solo con unidades de ≥2 evaluadores. Gwet (2014) y `irrCAC` las calculan con las unidades de ≥1 evaluador y el acuerdo observado con las de ≥2. La diferencia llegaba a 3·10⁻² con datos ausentes. Corregido; los tests del repositorio siguen en verde.

## Tratamiento de los datos ausentes y de las clases
- Las unidades con menos de 2 valoraciones no entran en el alfa de Krippendorff (como en la definición).
- `ambiguous` y `not_mentioned` solo forman parte del análisis **nominal** de la clase. La intensidad ordinal solo recibe valores numéricos; las clases sin intensidad (`null`) se tratan como ausentes en el análisis ordinal, nunca como una puntuación.
- Escalas con huecos (p. ej. sin el 0 observado): para los pesos de AC2 y kappa se declara la escala completa (−2…+2); el alfa ordinal usa solo las categorías observadas.

## Límites
Coinciden con las librerías consolidadas, pero siguen siendo concordancia entre evaluadores artificiales o con una referencia provisional: no sustituyen la validación humana independiente.
