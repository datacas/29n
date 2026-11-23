"""
Anthropic (Claude) LLM provider adapter.
Uses the Anthropic Messages API via HTTP requests.
"""

import os
import time
import json
import httpx
from typing import Optional, Dict, Any

from .base import LLMProvider, LLMError, parse_json_from_response


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider using the Messages API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 120,
    ):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self.base_url = (
            base_url or os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
        ).rstrip("/")
        self.timeout = timeout

    def name(self) -> str:
        return "anthropic"

    # Models that don't accept the `temperature` parameter (newer Anthropic models)
    _NO_TEMPERATURE_MODELS = {
        "claude-haiku-5-5",
        "claude-sonnet-5-5",
        "claude-sonnet-5",
        "claude-opus-5-5",
    }

    async def complete(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 4000,
        system_prompt: Optional[str] = None,
    ) -> str:
        if not self.api_key:
            raise LLMError(
                "Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.",
                provider="anthropic",
                retryable=False,
            )

        start = time.time()

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        body: Dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        # Newer models (Haiku 5.5, Sonnet 5.5, etc.) don't accept temperature
        if model not in self._NO_TEMPERATURE_MODELS:
            body["temperature"] = temperature
        if system_prompt:
            body["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/v1/messages",
                    headers=headers,
                    json=body,
                )
            latency_ms = int((time.time() - start) * 1000)

            if response.status_code != 200:
                error_body = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
                raise LLMError(
                    f"Anthropic API error {response.status_code}: {error_body}",
                    provider="anthropic",
                    retryable=response.status_code >= 500 or response.status_code == 429,
                )

            data = response.json()
            text = ""
            for block in data.get("content", []):
                if block.get("type") == "text":
                    text += block["text"]

            # Store usage info on the provider instance for later retrieval
            usage = data.get("usage", {})
            self._last_usage = {
                "input_tokens": usage.get("input_tokens", 0),
                "output_tokens": usage.get("output_tokens", 0),
                "cache_creation_input_tokens": usage.get("cache_creation_input_tokens", 0),
                "cache_read_input_tokens": usage.get("cache_read_input_tokens", 0),
                "model": data.get("model", model),
                "latency_ms": latency_ms,
            }

            return text

        except httpx.TimeoutException:
            raise LLMError(
                f"Anthropic API timeout after {self.timeout}s",
                provider="anthropic",
                retryable=True,
            )
        except httpx.ConnectError as e:
            raise LLMError(
                f"Cannot connect to Anthropic API: {e}",
                provider="anthropic",
                retryable=True,
            )

    def last_usage(self) -> Dict[str, Any]:
        """Return usage info from the last API call."""
        return getattr(self, "_last_usage", {})

    async def complete_json(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 4000,
        system_prompt: Optional[str] = None,
        schema: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        # Add JSON instruction to prompt if not already present
        json_instruction = "\n\nResponde únicamente en formato JSON, sin texto adicional ni bloques de código."
        if schema:
            json_instruction += f"\n\nEsquema esperado:\n{json.dumps(schema, indent=2, ensure_ascii=False)}"

        full_prompt = prompt + json_instruction
        text = await self.complete(
            full_prompt, model, temperature, max_tokens, system_prompt
        )
        return parse_json_from_response(text)


def create_anthropic_provider(config: Optional[Dict[str, Any]] = None) -> AnthropicProvider:
    """Factory function to create an Anthropic provider from config."""
    cfg = config or {}
    return AnthropicProvider(
        api_key=cfg.get("api_key"),
        base_url=cfg.get("base_url"),
        timeout=cfg.get("timeout", 120),
    )
