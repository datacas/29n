#!/usr/bin/env python3
"""
Tests for OpenAI adapter and Anthropic → OpenAI fallback.
Tests use mocked HTTP responses to avoid requiring real API keys.
"""

import asyncio
import json
import sys
import os
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, "..")

from llm.base import LLMError
from llm.openai import OpenAIProvider, create_openai_provider
from llm.anthropic import AnthropicProvider, create_anthropic_provider
from llm import call_with_fallback, create_provider, DEFAULT_TASK_CONFIGS, FALLBACK_TASK_CONFIGS


passed = 0
failed = 0


def test(name, result):
    global passed, failed
    if result:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name}")


def test_exception(name, func, expected_exception=LLMError):
    global passed, failed
    try:
        func()
        test(name, False)
    except expected_exception:
        test(name, True)
    except Exception as e:
        print(f"  ❌ {name}: unexpected exception: {e}")
        failed += 1


# ── OpenAI Provider Tests ──────────────────────────────────────────────

print("\n=== OpenAI Provider Tests ===")

# Test 1: Factory creates provider
provider = create_openai_provider({"api_key": "test-key", "timeout": 60})
test("Factory creates OpenAI provider", provider.name() == "openai")
test("Factory sets API key", provider.api_key == "test-key")
test("Factory sets timeout", provider.timeout == 60)

# Test 2: Provider name
test("Provider name is 'openai'", provider.name() == "openai")

# Test 3: Missing API key raises non-retryable error
no_key_provider = OpenAIProvider(api_key="")
async def _missing_key():
    await no_key_provider.complete("test", "gpt-4o-mini")
test_exception("Missing API key raises non-retryable error",
               lambda: asyncio.run(_missing_key()))

# Test 4: HTTP 200 returns text
async def _success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Hello, world!"}}]
    }
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await provider.complete("prompt", "gpt-4o-mini")
        return result

result = asyncio.run(_success())
test("HTTP 200 returns text", result == "Hello, world!")

# Test 5: HTTP 500 raises retryable error
async def _server_error():
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {"error": {"message": "Rate limit"}}
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        await provider.complete("prompt", "gpt-4o-mini")

test_exception("HTTP 500 raises retryable error",
               lambda: asyncio.run(_server_error()))

# Test 6: HTTP 429 raises retryable error
async def _rate_limit():
    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {"error": {"message": "Rate limit"}}
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        await provider.complete("prompt", "gpt-4o-mini")

test_exception("HTTP 429 raises retryable error",
               lambda: asyncio.run(_rate_limit()))

# Test 7: HTTP 401 raises non-retryable error
async def _auth_error():
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {"error": {"message": "Invalid API key"}}
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        await provider.complete("prompt", "gpt-4o-mini")

async def _auth_error_check():
    try:
        await _auth_error()
    except LLMError as e:
        return not e.retryable
    return False

result = asyncio.run(_auth_error_check())
test("HTTP 401 raises non-retryable error", result)

# Test 8: Timeout raises retryable error
async def _timeout():
    import httpx
    mock_client = AsyncMock()
    mock_client.post.side_effect = httpx.TimeoutException("timeout")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        await provider.complete("prompt", "gpt-4o-mini")

test_exception("Timeout raises retryable error",
               lambda: asyncio.run(_timeout()))

# Test 9: Connection error raises retryable error
async def _connect_error():
    import httpx
    mock_client = AsyncMock()
    mock_client.post.side_effect = httpx.ConnectError("connection refused")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        await provider.complete("prompt", "gpt-4o-mini")

test_exception("Connection error raises retryable error",
               lambda: asyncio.run(_connect_error()))

# Test 10: complete_json parses JSON from response
async def _json_response():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {
        "choices": [{"message": {"content": '{"key": "value"}'}}]
    }
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await provider.complete_json("prompt", "gpt-4o-mini")
        return result

result = asyncio.run(_json_response())
test("complete_json parses JSON", result == {"key": "value"})

# Test 11: complete_json handles markdown code blocks
async def _json_markdown():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "```json\n{\"key\": \"value\"}\n```"}}]
    }
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await provider.complete_json("prompt", "gpt-4o-mini")
        return result

result = asyncio.run(_json_markdown())
test("complete_json strips markdown code blocks", result == {"key": "value"})

# Test 12: Environment variable for API key
with patch.dict(os.environ, {"OPENAI_API_KEY": "env-key"}):
    env_provider = OpenAIProvider()
    test("API key from environment variable", env_provider.api_key == "env-key")

# Test 13: Environment variable for base URL
with patch.dict(os.environ, {"OPENAI_BASE_URL": "https://custom.api.com"}):
    env_provider = OpenAIProvider()
    test("Base URL from environment variable", env_provider.base_url == "https://custom.api.com")


# ── Fallback Tests ─────────────────────────────────────────────────────

print("\n=== Fallback Tests ===")

# Test 14: Fallback config uses OpenAI
test("Fallback provider is OpenAI", FALLBACK_TASK_CONFIGS["extraction"]["provider"] == "openai")
test("Fallback model is gpt-4o-mini", FALLBACK_TASK_CONFIGS["extraction"]["model"] == "gpt-4o-mini")

# Test 15: Primary success — no fallback
async def _primary_success():
    # Mock Anthropic to succeed
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {"content": [{"type": "text", "text": "Primary result"}]}
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            result = await call_with_fallback("extraction", "test prompt")
            return result

result = asyncio.run(_primary_success())
test("Primary success returns without fallback", result["fallback_used"] == False)
test("Primary success uses Anthropic", result["provider"] == "anthropic")
test("Primary success has 1 attempt", len(result["attempts"]) == 1)
test("Primary attempt is successful", result["attempts"][0]["success"] == True)

# Test 16: Primary timeout → fallback to OpenAI
async def _primary_timeout_fallback():
    import httpx
    call_count = [0]

    async def side_effect(*args, **kwargs):
        call_count[0] += 1
        if call_count[0] == 1:
            # First call (Anthropic) — timeout
            raise httpx.TimeoutException("timeout")
        else:
            # Second call (OpenAI) — success
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.headers = {"content-type": "application/json"}
            mock_response.json.return_value = {
                "choices": [{"message": {"content": "Fallback result"}}]
            }
            return mock_response

    mock_client = AsyncMock()
    mock_client.post.side_effect = side_effect
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key", "OPENAI_API_KEY": "test-key"}):
            result = await call_with_fallback("extraction", "test prompt")
            return result

result = asyncio.run(_primary_timeout_fallback())
test("Timeout triggers fallback", result["fallback_used"] == True)
test("Fallback uses OpenAI", result["provider"] == "openai")
test("Fallback has 2 attempts", len(result["attempts"]) == 2)
test("First attempt failed", result["attempts"][0]["success"] == False)
test("Second attempt succeeded", result["attempts"][1]["success"] == True)
test("Fallback result text is correct", result["text"] == "Fallback result")

# Test 17: Both providers fail → LLMError
async def _both_fail():
    import httpx
    mock_client = AsyncMock()
    mock_client.post.side_effect = httpx.TimeoutException("timeout")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key", "OPENAI_API_KEY": "test-key"}):
            await call_with_fallback("extraction", "test prompt")

test_exception("Both providers fail raises LLMError",
               lambda: asyncio.run(_both_fail()))

# Test 18: Non-retryable error does NOT trigger fallback
async def _non_retryable_no_fallback():
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json.return_value = {"error": {"message": "Invalid key"}}
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "invalid-key", "OPENAI_API_KEY": "test-key"}):
            await call_with_fallback("extraction", "test prompt")

async def _non_retryable_check():
    try:
        await _non_retryable_no_fallback()
    except LLMError as e:
        return not e.retryable
    return False

result = asyncio.run(_non_retryable_check())
test("Non-retryable error does not trigger fallback", result)

# Test 19: create_provider factory
test("create_provider('anthropic') works", create_provider("anthropic").name() == "anthropic")
test("create_provider('openai') works", create_provider("openai").name() == "openai")
test_exception("create_provider('unknown') raises LLMError",
               lambda: create_provider("unknown"))

# Test 20: Ollama is NOT in providers
test("Ollama not in fallback config", FALLBACK_TASK_CONFIGS["extraction"]["provider"] != "ollama")
test("Ollama not in default config", DEFAULT_TASK_CONFIGS["extraction"]["provider"] != "ollama")


# ── Summary ────────────────────────────────────────────────────────────

print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed, {passed + failed} total")
if failed == 0:
    print("✅ All tests passed!")
else:
    print(f"❌ {failed} test(s) failed")
    sys.exit(1)
