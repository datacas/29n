"""
LLM provider package.
Provides factory functions and configuration for multi-provider LLM access.
"""

import os
import json
from typing import Optional, Dict, Any

from .base import LLMProvider, LLMError
from .anthropic import AnthropicProvider, create_anthropic_provider
from .openai import OpenAIProvider, create_openai_provider


# Default task configurations per D-04
DEFAULT_TASK_CONFIGS = {
    "extraction": {
        "provider": "anthropic",
        "model": "claude-sonnet-5-5",
        "temperature": 0.1,
        "max_tokens": 4000,
        "timeout": 120,
    },
    "verification": {
        "provider": "anthropic",
        "model": "claude-sonnet-5-5",
        "temperature": 0.0,
        "max_tokens": 2000,
        "timeout": 120,
    },
    "classification": {
        "provider": "anthropic",
        "model": "claude-sonnet-5-5",
        "temperature": 0.1,
        "max_tokens": 1000,
        "timeout": 60,
    },
}

# Fallback configs when primary provider is unavailable
FALLBACK_TASK_CONFIGS = {
    "extraction": {
        "provider": "openai",
        "model": "gpt-4o-mini",
        "temperature": 0.1,
        "max_tokens": 4000,
        "timeout": 120,
    },
    "verification": {
        "provider": "openai",
        "model": "gpt-4o-mini",
        "temperature": 0.0,
        "max_tokens": 2000,
        "timeout": 120,
    },
    "classification": {
        "provider": "openai",
        "model": "gpt-4o-mini",
        "temperature": 0.1,
        "max_tokens": 1000,
        "timeout": 60,
    },
}


def create_provider(name: str, config: Optional[Dict[str, Any]] = None) -> LLMProvider:
    """
    Factory function to create an LLM provider by name.

    Args:
        name: Provider name ('anthropic', 'openai').
        config: Optional provider-specific configuration.

    Returns:
        An LLMProvider instance.

    Raises:
        LLMError: If the provider name is unknown.
    """
    providers = {
        "anthropic": create_anthropic_provider,
        "openai": create_openai_provider,
    }
    factory = providers.get(name.lower())
    if not factory:
        raise LLMError(
            f"Unknown LLM provider: {name}. Available: {list(providers.keys())}",
            retryable=False,
        )
    return factory(config)


def load_task_config(task: str) -> Dict[str, Any]:
    """
    Load task configuration from environment or defaults.

    Checks for environment variable LLM_TASK_{TASK_UPPER} (JSON) first,
    then falls back to DEFAULT_TASK_CONFIGS.
    """
    env_var = f"LLM_TASK_{task.upper()}"
    env_value = os.environ.get(env_var)
    if env_value:
        try:
            return json.loads(env_value)
        except json.JSONDecodeError:
            pass
    return DEFAULT_TASK_CONFIGS.get(task, DEFAULT_TASK_CONFIGS["extraction"])


def get_provider_for_task(task: str) -> LLMProvider:
    """
    Get the configured provider for a specific task.

    Args:
        task: Task name ('extraction', 'verification', 'classification').

    Returns:
        An LLMProvider instance configured for the task.
    """
    config = load_task_config(task)
    provider_name = config.get("provider", "anthropic")
    return create_provider(provider_name)


async def call_with_fallback(
    task: str,
    prompt: str,
    system_prompt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Call LLM with automatic fallback to OpenAI only on recoverable errors.

    Fallback is triggered ONLY on:
    - Timeouts
    - Transient errors (5xx, 429)
    - Connection failures

    Fallback is NOT triggered on:
    - Semantic errors (incomplete/incorrect responses) — these go to editorial review.
    - Non-retryable errors (missing API key, authentication failure).

    Each attempt is logged with provider, model, prompt version, duration, error, and result.

    Args:
        task: Task name for configuration lookup.
        prompt: The user prompt.
        system_prompt: Optional system prompt.

    Returns:
        A dict with 'text', 'provider', 'model', 'attempts', and metadata.

    Raises:
        LLMError: If both primary and fallback fail.
    """
    import time

    primary_config = load_task_config(task)
    fallback_config = FALLBACK_TASK_CONFIGS.get(task, {})

    attempts: list[Dict[str, Any]] = []

    # --- Attempt 1: Primary provider (Anthropic) ---
    start_time = time.time()
    try:
        provider = create_provider(primary_config["provider"])
        text = await provider.complete(
            prompt=prompt,
            model=primary_config["model"],
            temperature=primary_config.get("temperature", 0.1),
            max_tokens=primary_config.get("max_tokens", 4000),
            system_prompt=system_prompt,
        )
        duration_ms = int((time.time() - start_time) * 1000)
        usage = provider.last_usage()
        attempts.append({
            "provider": provider.name(),
            "model": primary_config["model"],
            "duration_ms": duration_ms,
            "success": True,
            "input_tokens": usage.get("input_tokens", 0),
            "output_tokens": usage.get("output_tokens", 0),
        })
        return {
            "text": text,
            "provider": provider.name(),
            "model": primary_config["model"],
            "task": task,
            "fallback_used": False,
            "attempts": attempts,
            "input_tokens": usage.get("input_tokens", 0),
            "output_tokens": usage.get("output_tokens", 0),
        }
    except LLMError as e:
        duration_ms = int((time.time() - start_time) * 1000)
        attempts.append({
            "provider": primary_config["provider"],
            "model": primary_config["model"],
            "duration_ms": duration_ms,
            "success": False,
            "error": str(e),
            "retryable": e.retryable,
        })

        # Non-retryable errors: fail immediately
        if not e.retryable:
            raise

        # --- Attempt 2: Fallback provider (OpenAI) ---
        if fallback_config and fallback_config.get("provider") != primary_config["provider"]:
            start_time = time.time()
            try:
                fallback_provider = create_provider(fallback_config["provider"])
                text = await fallback_provider.complete(
                    prompt=prompt,
                    model=fallback_config["model"],
                    temperature=fallback_config.get("temperature", 0.1),
                    max_tokens=fallback_config.get("max_tokens", 4000),
                    system_prompt=system_prompt,
                )
                duration_ms = int((time.time() - start_time) * 1000)
                usage = fallback_provider.last_usage()
                attempts.append({
                    "provider": fallback_provider.name(),
                    "model": fallback_config["model"],
                    "duration_ms": duration_ms,
                    "success": True,
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                })
                return {
                    "text": text,
                    "provider": fallback_provider.name(),
                    "model": fallback_config["model"],
                    "task": task,
                    "fallback_used": True,
                    "attempts": attempts,
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                }
            except LLMError as fallback_err:
                duration_ms = int((time.time() - start_time) * 1000)
                attempts.append({
                    "provider": fallback_config["provider"],
                    "model": fallback_config["model"],
                    "duration_ms": duration_ms,
                    "success": False,
                    "error": str(fallback_err),
                    "retryable": fallback_err.retryable,
                })

        # Both providers failed
        raise LLMError(
            f"All providers failed for task '{task}': {attempts}",
            provider=primary_config["provider"],
            retryable=False,
        )
