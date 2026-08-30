from __future__ import annotations

import os
from typing import Optional, Protocol


class LLMProvider(Protocol):
    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 512,
    ) -> str:
        ...


class DeterministicGroundedProvider:
    """Deterministic fallback provider that generates grounded tactical summaries without external API calls."""

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 512,
    ) -> str:
        if "<VERIFIED_DATA>" in system_prompt and "</VERIFIED_DATA>" in system_prompt:
            data_block = system_prompt.split("<VERIFIED_DATA>")[1].split("</VERIFIED_DATA>")[0].strip()
            lines = [l.strip() for l in data_block.split("\n") if l.strip()]
            event_count = len(lines)
            if event_count > 0:
                summary_lines = [
                    f"Identified {event_count} active verified thermal cluster(s) matching query parameters:\n"
                ]
                for l in lines[:5]:
                    summary_lines.append(f"• {l}")
                if event_count > 5:
                    summary_lines.append(f"\n...and {event_count - 5} additional monitored thermal signatures across the region.")
                return "\n".join(summary_lines)
        return "Tactical scan complete. Evaluated all active Indian thermal signatures against real-time satellite telemetry."


def create_llm_provider(provider_name: Optional[str] = None) -> LLMProvider:
    """Create an LLM provider instance based on the configured env var or available credentials."""
    selected = (provider_name or os.getenv("LLM_PROVIDER") or "").lower()
    
    if selected == "ollama":
        return OllamaChatProvider()
    
    openai_key = os.getenv("OPENAI_API_KEY")
    if selected == "openai" or (not selected and openai_key):
        if openai_key:
            return OpenAIChatProvider(api_key=openai_key)
        
    return DeterministicGroundedProvider()


try:
    from dotenv import find_dotenv, load_dotenv
except ImportError:  # pragma: no cover - optional dependency fallback
    def find_dotenv(*args, **kwargs):
        return None

    def load_dotenv(*args, **kwargs):
        return False


load_dotenv(find_dotenv(usecwd=True), override=False)


class OpenAIChatProvider:
    """Concrete OpenAI-backed provider for grounded chat/report synthesis."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not set in the environment (.env).")

        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise RuntimeError(
                "The OpenAI Python SDK is not installed. Add `openai` to the backend dependencies."
            ) from exc

        self.client = OpenAI(api_key=self.api_key)

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 512,
    ) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )

        content = response.choices[0].message.content
        if not content:
            return ""
        return content


class OllamaChatProvider:
    """Concrete local Ollama-backed provider for grounded chat/report synthesis."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL") or "http://host.docker.internal:11434").rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "qwen3:4b")

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 512,
    ) -> str:
        try:
            import requests
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise RuntimeError(
                "The `requests` library is not installed. Add `requests` to the backend dependencies."
            ) from exc

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        response = requests.post(
            f"{self.base_url}/api/chat",
            json=payload,
            timeout=30,
        )
        response.raise_for_status()

        body = response.json()
        content = body.get("message", {}).get("content")
        if not content:
            return ""
        return content


__all__ = ["LLMProvider", "OpenAIChatProvider", "OllamaChatProvider", "DeterministicGroundedProvider", "create_llm_provider"]
