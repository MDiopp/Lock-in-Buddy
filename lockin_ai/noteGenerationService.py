import os

import ollama


# Allow overriding the Ollama model via env var
_OLLAMA_MODEL = os.environ.get("LOCKIN_AI_MODEL", "llama3.2")

_STYLE_PROMPTS = {
    "bullet": (
        "You are a study assistant. Convert the following lecture/meeting transcript "
        "into clean, well-organized bullet-point notes. Group related ideas under "
        "headings. Remove filler words and repetition. Keep all key information.\n\n"
        "Transcript:\n{transcript}\n\nNotes:"
    ),
    "summary": (
        "You are a study assistant. Summarize the following transcript into a concise "
        "summary that captures all the main points and key details. Use clear paragraphs.\n\n"
        "Transcript:\n{transcript}\n\nSummary:"
    ),
    "cornell": (
        "You are a study assistant. Convert the following transcript into Cornell-style "
        "notes with three sections:\n"
        "1. **Cues** — key questions or keywords in the left margin\n"
        "2. **Notes** — detailed notes on the right\n"
        "3. **Summary** — a brief summary at the bottom\n\n"
        "Transcript:\n{transcript}\n\nCornell Notes:"
    ),
}


class NoteGenerationService:
    """Generate structured notes from a transcript using Ollama."""

    def __init__(self, model: str | None = None):
        self.model = model or _OLLAMA_MODEL
        print(f"[LockIn AI] Note generation will use Ollama model '{self.model}'")

    def generate(self, transcript: str, style: str = "bullet") -> str:
        """Send transcript to Ollama and return generated notes."""
        if not transcript.strip():
            return ""

        prompt_template = _STYLE_PROMPTS.get(style, _STYLE_PROMPTS["bullet"])
        prompt = prompt_template.format(transcript=transcript)

        response = ollama.chat(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.message.content or ""
