# Evolución del panel de modelos codificadores (2026-11-25/26)

## Panel inicialmente autorizado (modalidad A, conjunto S)
Siete modelos de proveedores distintos, vía OmniRoute: Gemini 3.6 flash, Gemma 4 31B, Ministral 14B, Qwen3.8-27B (Groq), GPT-OSS 120B (Groq), MiniMax M3.1 flash y Llama 4 Scout. Codex quedó previsto como segundo codificador (decisión 2) y Jev como verificador, no como codificador. Criterios de aceptación congelados antes de obtener resultados (`criterios-aceptacion-modalidad-A.md`).

## Cambios, por qué y bajo qué criterio
| Cambio | Motivo | Criterio / autorización |
|---|---|---|
| Se archiva el primer piloto (con herramientas de memoria inyectadas por OmniRoute) y se repite limpio | Se descubrió que OmniRoute inyectaba 4 herramientas `memory_*` en todas las peticiones; se evita con `x-omniroute-no-memory` | Corrección técnica; los resultados anteriores no se reutilizan (otra configuración) |
| `max_tokens` de Gemma, MiniMax, Qwen, GPT-OSS y después de Gemini 3.6 flash (700 → 3.000) | Salidas de razonamiento truncadas (`finish_reason = length`) | Desviación técnica documentada; los intentos con la configuración anterior no cuentan |
| Interruptor de fallos por modelo y no por proveedor | Gemini 3.6 flash en enfriamiento de cuota impedía evaluar a Gemma | Corrección técnica |
| Tamaño mínimo de muestra para clasificar (20 respuestas propias y 10 pares) | Evitar declarar «no pasa» con n=2 | Aclaración; no cambia ningún umbral |
| Gemma 4 31B detenida | Petición del responsable (lentitud ~1 min por llamada); 8 respuestas válidas conservadas | Decisión expresa; queda «no evaluable» |
| **Se incorporan Codex, DeepSeek v4.1 flash y Gemini 4 Hydrogen** | El responsable autorizó usarlos si OmniRoute daba problemas: cuotas diarias agotadas (Groq, Gemini 3.6 flash) y falta de saldo en opencode-zen (DeepSeek no accesible por la API) | Autorización expresa; mismos criterios M1–M3 / O1–O4, mismo manual y mismos pasajes |

## Cómo se evalúan los tres incorporados
- **Codex** (`codex exec`, gpt-6.2-sol, esfuerzo de razonamiento bajo): sandbox de solo lectura, sin configuración de usuario ni reglas, directorio vacío y efímero. Coste: suscripción (no hay cifra por llamada; ~28 mil tokens por llamada, la mayor parte el prompt del agente).
- **DeepSeek v4.1 flash** (`opencode run`, modelo gratuito de OpenCode): directorio vacío, coste declarado 0.
- **Gemini 4 Hydrogen** (`agy`, variante `low`): directorio vacío; ~20 mil tokens por llamada.
- Limitaciones de método comunes: las CLI son **agentes**, no APIs de modelo; no admiten mensaje de sistema (manual y consulta van en un único mensaje de usuario); el modelo ejecutado es el solicitado, no verificado por la CLI (no hay cabecera equivalente a `x-omniroute-model`); su prompt base no es el mismo que el de la API. Estas diferencias se informan y no se corrigen.
- **Codex no es referencia dorada**: es un evaluador más. Comparte proveedor con GPT-OSS (OpenAI), por lo que no cuentan como independientes entre sí.

## Estado final de A y panel propuesto para B
Ver el documento de solicitud de autorización de la modalidad B. Principio: panel principal de familias distintas con calidad suficiente y viabilidad operativa; panel adicional (verificación, discrepancias, modelos lentos o con cuota limitada).
