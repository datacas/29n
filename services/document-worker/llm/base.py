"""
Base interface for LLM providers.
All providers must implement this interface for interchangeability.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
import json


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 4000,
        system_prompt: Optional[str] = None,
    ) -> str:
        """Send a completion request and return the text response."""
        pass

    @abstractmethod
    async def complete_json(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 4000,
        system_prompt: Optional[str] = None,
        schema: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Send a completion request expecting JSON output."""
        pass

    @abstractmethod
    def name(self) -> str:
        """Return the provider name (e.g., 'anthropic', 'openai')."""
        pass


class LLMResponse:
    """Standardized response from any LLM provider."""

    def __init__(
        self,
        text: str,
        provider: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        latency_ms: int = 0,
    ):
        self.text = text
        self.provider = provider
        self.model = model
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.latency_ms = latency_ms

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "provider": self.provider,
            "model": self.model,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "latency_ms": self.latency_ms,
        }


class LLMError(Exception):
    """Error raised when LLM call fails."""

    def __init__(self, message: str, provider: str = "", retryable: bool = True):
        super().__init__(message)
        self.provider = provider
        self.retryable = retryable


def parse_json_from_response(text: str) -> Dict[str, Any]:
    """
    Extract JSON from LLM response, handling markdown code blocks
    and partial JSON.
    """
    # Strip markdown code blocks
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Remove ```json or ``` prefix
        lines = cleaned.split("\n")
        lines = lines[1:]  # remove first ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    # Try parsing directly
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try finding JSON object in text
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise LLMError(f"Could not parse JSON from response: {text[:200]}")
