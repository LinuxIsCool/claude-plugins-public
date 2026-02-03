"""Ollama text generation for contextual descriptions."""
import httpx
from typing import Iterator


class OllamaGenerator:
    """
    Generate text using Ollama's local LLM API.

    Used for creating contextual descriptions of document chunks.
    Defaults to a small, fast model suitable for summarization.
    """

    def __init__(
        self,
        model: str = "qwen2.5-coder:1.5b",
        base_url: str = "http://localhost:11434",
        timeout: float = 30.0
    ):
        """
        Initialize Ollama generator.

        Args:
            model: Ollama model name (smaller models are faster)
            base_url: Ollama API URL
            timeout: Request timeout in seconds
        """
        self.model = model
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout

    def generate(self, prompt: str, max_tokens: int = 150) -> str:
        """
        Generate text completion.

        Args:
            prompt: Input prompt
            max_tokens: Maximum tokens to generate

        Returns:
            Generated text
        """
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": 0.3  # Lower temp for consistent descriptions
            }
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                return response.json().get("response", "").strip()
        except httpx.HTTPError as e:
            raise ConnectionError(
                f"Failed to connect to Ollama at {self.base_url}. "
                f"Ensure Ollama is running: ollama serve"
            ) from e

    def generate_stream(self, prompt: str, max_tokens: int = 150) -> Iterator[str]:
        """
        Generate text with streaming output.

        Args:
            prompt: Input prompt
            max_tokens: Maximum tokens to generate

        Yields:
            Generated text chunks
        """
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "num_predict": max_tokens,
                "temperature": 0.3
            }
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                try:
                    with client.stream("POST", url, json=payload) as response:
                        response.raise_for_status()
                        for line in response.iter_lines():
                            if line:
                                import json
                                data = json.loads(line)
                                if "response" in data:
                                    yield data["response"]
                except (httpx.ReadTimeout, httpx.ReadError) as stream_error:
                    raise ConnectionError(
                        f"Stream interrupted from Ollama: {stream_error}"
                    ) from stream_error
        except httpx.HTTPError as e:
            raise ConnectionError(
                f"Failed to connect to Ollama at {self.base_url}. "
                f"Ensure Ollama is running: ollama serve"
            ) from e

    def is_available(self) -> bool:
        """Check if Ollama is running and model is available."""
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    return any(m.get("name", "").startswith(self.model.split(":")[0])
                               for m in models)
        except httpx.HTTPError:
            pass
        return False
