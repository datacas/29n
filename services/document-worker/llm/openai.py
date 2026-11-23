"""
OpenAI LLM provider adapter.
Uses the OpenAI Chat Completions API via HTTP requests.
"""

import os
import time
import json
import httpx
from typing import Optional, Dict, Any

from .base import LLMProvider, LLMError, parse_json_from_response


class OpenAIProvider(LLMProvider):
    """OpenAI provider using the Chat Completions API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 120,
    ):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.base_url = (
            base_url or os.environ.get("OPENAI_BASE_URL", "https://api.openai.com")
        ).rstrip("/")
        self.timeout = timeout

    def name(self) -> str:
        return "openai"

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
                "OpenAI API key not configured. Set OPENAI_API_KEY environment variable.",
                provider="openai",
                retryable=False,
            )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        messages: list[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        body: Dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/v1/chat/completions",
                    headers=headers,
                    json=body,
                )

            if response.status_code != 200:
                error_body = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
                raise LLMError(
                    f"OpenAI API error {response.status_code}: {error_body}",
                    provider="openai",
                    retryable=response.status_code >= 500 or response.status_code == 429,
                )

            data = response.json()
            text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return text

        except httpx.TimeoutException:
            raise LLMError(
                f"OpenAI API timeout after {self.timeout}s",
                provider="openai",
                retryable=True,
            )
        except httpx.ConnectError as e:
            raise LLMError(
                f"Cannot connect to OpenAI API: {e}",
                provider="openai",
                retryable=True,
            )

    async def complete_json(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 4000,
        system_prompt: Optional[str] = None,
        schema: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        json_instruction = "\n\nResponde únicamente en formato JSON, sin texto adicional ni bloques de código."
        if schema:
            json_instruction += f"\n\nEsquema esperado:\n{json.dumps(schema, indent=2, ensure_ascii=False)}"

        full_prompt = prompt + json_instruction
        text = await self.complete(
            full_prompt, model, temperature, max_tokens, system_prompt
        )
        return parse_json_from_response(text)


def create_openai_provider(config: Optional[Dict[str, Any]] = None) -> OpenAIProvider:
    """Factory function to create an OpenAI provider from config."""
    cfg = config or {}
    return OpenAIProvider(
        api_key=cfg.get("api_key"),
        base_url=cfg.get("base_url"),
        timeout=cfg.get("timeout", 120),
    )
