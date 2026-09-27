import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

_gemini_client_initialized = False
_init_attempted = False

def get_api_key() -> Optional[str]:
    """Retrieve Gemini or Vertex API key from environment."""
    key = (
        os.getenv("GEMINI_API_KEY") or
        os.getenv("GOOGLE_API_KEY") or
        os.getenv("VERTEX_API_KEY")
    )
    # Treat placeholder values as absent
    if key and key.startswith("your-"):
        return None
    return key

def is_configured() -> bool:
    """Returns True if a real Gemini API key is configured."""
    return bool(get_api_key())

def init_gemini() -> bool:
    global _gemini_client_initialized, _init_attempted
    if _gemini_client_initialized:
        return True
    if _init_attempted:
        return False

    _init_attempted = True
    api_key = get_api_key()
    if not api_key:
        logger.warning(
            "⚠️  AEGIS LLM: No valid Gemini API key found. "
            "Set GEMINI_API_KEY in your .env file. "
            "All agents will use heuristic fallback mode (results will NOT be AI-generated)."
        )
        return False

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _gemini_client_initialized = True
        logger.info("✅ AEGIS LLM: Google Generative AI client initialized successfully. Real LLM analysis active.")
        return True
    except Exception as e:
        logger.error(f"❌ AEGIS LLM: Could not configure google.generativeai: {e}")
        return False

async def generate_text(
    prompt: str,
    model_name: str = "gemini-1.5-flash",
    temperature: float = 0.2,
    system_instruction: Optional[str] = None
) -> Optional[str]:
    """
    Generates text using Google Gemini API if configured.
    Returns None if no API key is set or on error, allowing callers to fall back to heuristic synthesis.
    """
    if not init_gemini():
        return None

    try:
        import google.generativeai as genai
        target_model = "gemini-1.5-pro" if "pro" in model_name.lower() else "gemini-1.5-flash"

        kwargs: Dict[str, Any] = {
            "model_name": target_model,
            "generation_config": {
                "temperature": temperature,
                "top_p": 0.95,
                "max_output_tokens": 2048,
            }
        }
        if system_instruction:
            kwargs["system_instruction"] = system_instruction

        model = genai.GenerativeModel(**kwargs)
        response = model.generate_content(prompt)
        if response and hasattr(response, "text") and response.text:
            return response.text.strip()
    except Exception as e:
        logger.warning(f"Gemini generation call failed ({e}). Reverting to analytical heuristic reasoning.")

    return None
