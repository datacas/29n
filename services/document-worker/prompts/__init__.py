"""
Versioned prompt templates for the AI pipeline.
Each prompt has a version, task type, and template.
"""

EXTRACTION_PROMPT_V1 = {
    "version": "1.0.0",
    "task": "extraction",
    "template": """Eres un analista de documentos políticos. Extrae propuestas concretas del siguiente texto.

Documento: {source_title}
Sección: {section}
Página: {page}

Texto:
{passage_text}

Instrucciones:
1. Identifica propuestas, medidas o posiciones concretas.
2. Para cada propuesta, proporciona:
   - literal_text: cita exacta del texto original (máx. 200 caracteres)
   - normalized_text: descripción normalizada de la propuesta
   - conditions: condiciones o excepciones mencionadas (si las hay)
   - affected_area: área temática general
3. Solo extrae propuestas con contenido verificable.
4. No inventes, no infieras, no generalices.
5. Si no hay propuestas concretas, devuelve array vacío.

Salida en JSON:
{{
  "claims": [
    {{
      "literal_text": "...",
      "normalized_text": "...",
      "conditions": "...",
      "affected_area": "..."
    }}
  ],
  "has_more": false
}}""",
    "system_prompt": "Eres un asistente especializado en análisis de documentos políticos. Extraes propuestas concretas manteniendo fidelidad al texto original.",
}

VERIFICATION_PROMPT_V1 = {
    "version": "1.0.0",
    "task": "verification",
    "template": """Verifica si la siguiente propuesta refleja fielmente el texto original del documento.

Texto original del documento:
{original_text}

Propuesta extraída:
- Literal: {literal_text}
- Normalizada: {normalized_text}
- Condiciones: {conditions}

Instrucciones:
1. Comprueba que literal_text existe como substring en el texto original.
2. Verifica que normalized_text no añade contenido no presente en el original.
3. Detecta si hay condiciones o excepciones que no se registraron.
4. Evalúa si la propuesta es contradictoria con otras partes del texto.

Salida en JSON:
{{
  "verified": true,
  "literal_exists": true,
  "faithful_summary": true,
  "missing_conditions": false,
  "contradiction_detected": false,
  "confidence": 0.95,
  "notes": "..."
}}""",
    "system_prompt": "Eres un verificador independiente de propuestas políticas. Tu trabajo es asegurar que cada propuesta extraída refleja fielmente el documento original sin añadir, quitar ni distorsionar contenido.",
}

CLASSIFICATION_PROMPT_V1 = {
    "version": "1.0.0",
    "task": "classification",
    "template": """Clasifica la siguiente propuesta política en la taxonomía proporcionada.

Propuesta: {normalized_text}
Condiciones: {conditions}

Taxonomía disponible:
{taxonomy}

Instrucciones:
1. Asigna el tema principal más adecuado.
2. Si aplica, asigna temas secundarios.
3. Proporciona una breve justificación.

Salida en JSON:
{{
  "primary_topic": "{{topic_code}}",
  "secondary_topics": ["{{topic_code}}"],
  "confidence": 0.9,
  "justification": "..."
}}""",
    "system_prompt": "Eres un clasificador temático de propuestas políticas. Asignas cada propuesta a los temas de la taxonomía predefinida con precisión y consistencia.",
}

# Registry of all prompt versions
PROMPT_REGISTRY = {
    "extraction": {
        "1.0.0": EXTRACTION_PROMPT_V1,
    },
    "verification": {
        "1.0.0": VERIFICATION_PROMPT_V1,
    },
    "classification": {
        "1.0.0": CLASSIFICATION_PROMPT_V1,
    },
}


def get_prompt(task: str, version: str = "latest") -> dict:
    """
    Get a prompt template by task and version.

    Args:
        task: Task name ('extraction', 'verification', 'classification').
        version: Version string or 'latest' for the most recent.

    Returns:
        Prompt template dict with 'version', 'template', and 'system_prompt'.

    Raises:
        KeyError: If task or version not found.
    """
    task_prompts = PROMPT_REGISTRY.get(task)
    if not task_prompts:
        raise KeyError(f"Unknown task: {task}. Available: {list(PROMPT_REGISTRY.keys())}")

    if version == "latest":
        versions = sorted(task_prompts.keys())
        version = versions[-1] if versions else None

    if version not in task_prompts:
        raise KeyError(
            f"Unknown version {version} for task {task}. "
            f"Available: {list(task_prompts.keys())}"
        )

    return task_prompts[version]


def render_prompt(task: str, variables: dict, version: str = "latest") -> str:
    """
    Render a prompt template with variables.

    Args:
        task: Task name.
        variables: Dict of variables to substitute in the template.
        version: Prompt version or 'latest'.

    Returns:
        Rendered prompt string.
    """
    prompt = get_prompt(task, version)
    return prompt["template"].format(**variables)


def get_system_prompt(task: str, version: str = "latest") -> str:
    """Get the system prompt for a task."""
    prompt = get_prompt(task, version)
    return prompt.get("system_prompt", "")
