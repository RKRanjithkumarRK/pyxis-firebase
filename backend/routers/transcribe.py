"""
Transcription router — converts audio to text using Gemini multimodal.
Input: base64-encoded audio (webm/mp4/wav)
Output: plain text transcript
"""

import asyncio
import base64
import logging

from fastapi import APIRouter, Depends, HTTPException

import google.generativeai as genai

from core.auth import verify_token
from core.config import get_settings
from schemas.models import TranscribeRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/transcribe")
async def transcribe_audio(req: TranscribeRequest, user: dict = Depends(verify_token)):
    settings = get_settings()
    api_key = settings.gemini_api_key

    if not api_key:
        raise HTTPException(status_code=503, detail="Transcription service not configured")

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        audio_data = base64.b64decode(req.audio)

        loop = asyncio.get_event_loop()

        def _transcribe():
            response = model.generate_content(
                [
                    {
                        "inline_data": {
                            "mime_type": req.mimeType,
                            "data": base64.b64encode(audio_data).decode(),
                        }
                    },
                    "Transcribe the audio accurately. Return only the transcript text, no commentary.",
                ],
                generation_config=genai.types.GenerationConfig(
                    temperature=0,
                    max_output_tokens=500,
                ),
            )
            return response.text

        transcript = await asyncio.wait_for(
            loop.run_in_executor(None, _transcribe),
            timeout=30.0,
        )

        return {"transcript": transcript.strip()}

    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Transcription timed out")
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed")
