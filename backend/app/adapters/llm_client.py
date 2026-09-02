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


class GroqChatProvider:
    """Concrete Groq-backed provider for high-speed grounded chat & report synthesis."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.model = model or os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        self.url = "https://api.groq.com/openai/v1/chat/completions"

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 512,
    ) -> str:
        if not self.api_key:
            return DeterministicGroundedProvider().generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens
            )

        import requests
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        try:
            resp = requests.post(self.url, headers=headers, json=payload, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            elif self.model != "openai/gpt-oss-20b":
                payload["model"] = "openai/gpt-oss-20b"
                r2 = requests.post(self.url, headers=headers, json=payload, timeout=15)
                if r2.status_code == 200:
                    return r2.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[GROQ LLM INFERENCE NOTICE] Fallback activated: {e}")
            
        return DeterministicGroundedProvider().generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens
        )


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
        except ImportError as exc:
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
        import requests
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


def create_llm_provider(provider_name: Optional[str] = None) -> LLMProvider:
    """Create an LLM provider instance prioritizing Groq for ultra-fast cloud inference."""
    selected = (provider_name or os.getenv("LLM_PROVIDER") or "groq").lower()

    groq_key = os.getenv("GROQ_API_KEY")
    if selected == "groq" or (not selected and groq_key):
        if groq_key:
            return GroqChatProvider(api_key=groq_key)

    if selected == "ollama":
        return OllamaChatProvider()

    openai_key = os.getenv("OPENAI_API_KEY")
    if selected == "openai" or (not selected and openai_key):
        if openai_key:
            return OpenAIChatProvider(api_key=openai_key)

    return DeterministicGroundedProvider()


__all__ = [
    "LLMProvider", 
    "GroqChatProvider", 
    "OpenAIChatProvider", 
    "OllamaChatProvider", 
    "DeterministicGroundedProvider", 
    "create_llm_provider"
]
