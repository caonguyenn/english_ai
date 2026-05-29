"""boto3 converse() wrapper for Nova Lite transcript analysis.

Uses tool-use with toolChoice to enforce JSON schema output from Nova Lite.
"""
import json
import logging
import threading

import boto3
from botocore.config import Config

from app.core.config import settings
from app.services.analysis.analyzer_prompt import ANALYZER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

# Thread-local boto3 client — Celery prefork workers are single-threaded per process.
_local = threading.local()

# JSON schema enforced via toolConfig toolChoice — Nova must call this tool.
_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "grammar_mistakes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "original": {"type": "string"},
                    "corrected": {"type": "string"},
                    "severity": {"type": "string", "enum": ["minor", "moderate", "major"]},
                    "explanation": {"type": "string"},
                },
                "required": ["category", "original", "corrected", "severity"],
                "additionalProperties": False,
            },
        },
        "vocab_usage": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "word": {"type": "string"},
                    "cefr_level": {"type": "string", "enum": ["A1", "A2", "B1", "B2", "C1", "C2"]},
                    "used_correctly": {"type": "boolean"},
                    "mastery_signal": {"type": "string", "enum": ["emerging", "developing", "secure"]},
                },
                "required": ["word", "cefr_level", "used_correctly", "mastery_signal"],
                "additionalProperties": False,
            },
        },
        "fluency_metrics": {
            "type": "object",
            "properties": {
                "coherence_score": {"type": "number", "minimum": 0, "maximum": 100},
                "discourse_markers": {"type": "array", "items": {"type": "string"}},
                "self_corrections": {"type": "integer", "minimum": 0},
                "avg_response_length_words": {"type": "number", "minimum": 0},
            },
            "required": ["coherence_score", "self_corrections"],
            "additionalProperties": False,
        },
        "band_estimate": {
            "type": "object",
            "properties": {
                "overall": {"type": "number", "minimum": 1, "maximum": 9},
                "fluency": {"type": "number", "minimum": 1, "maximum": 9},
                "grammar": {"type": "number", "minimum": 1, "maximum": 9},
                "vocabulary": {"type": "number", "minimum": 1, "maximum": 9},
                "pronunciation": {"type": "null"},
                "estimate_note": {"type": "string"},
            },
            "required": ["overall", "fluency", "grammar", "vocabulary", "pronunciation", "estimate_note"],
            "additionalProperties": False,
        },
        "strengths": {"type": "array", "items": {"type": "string"}},
        "weaknesses": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "grammar_mistakes", "vocab_usage", "fluency_metrics",
        "band_estimate", "strengths", "weaknesses",
    ],
    "additionalProperties": False,
}


def _get_client() -> boto3.client:
    """Return a cached per-thread boto3 bedrock-runtime client."""
    if not hasattr(_local, "bedrock"):
        _local.bedrock = boto3.client(
            "bedrock-runtime",
            region_name=settings.AWS_REGION,
            config=Config(read_timeout=120, connect_timeout=10),
        )
    return _local.bedrock


def analyze_transcript(transcript_text: str, system_prompt: str | None = None) -> dict:
    """Call Nova Lite with the serialized transcript. Returns parsed analysis dict.

    Uses toolConfig with toolChoice to force structured JSON output.
    Raises ValueError on missing/malformed tool response (caller should retry).

    Args:
        transcript_text: Serialized transcript text.
        system_prompt: Override the default ANALYZER_SYSTEM_PROMPT. Used by
            memory_extractor which needs a different extraction instruction.
            When provided, toolConfig is omitted so Nova returns plain JSON text.
    """
    client = _get_client()

    effective_system = system_prompt or ANALYZER_SYSTEM_PROMPT

    # When a custom system_prompt is supplied (e.g. memory extraction), we don't
    # force a tool call — the caller wants free-form JSON in the assistant turn.
    if system_prompt:
        response = client.converse(
            modelId=settings.NOVA_ANALYSIS_MODEL_ID,
            system=[{"text": effective_system}],
            messages=[{
                "role": "user",
                "content": [{"text": transcript_text}],
            }],
            inferenceConfig={"maxTokens": 512, "temperature": 0.1},
        )
        # Extract plain text content and parse JSON manually
        content_blocks = response["output"]["message"]["content"]
        text_block = next(
            (b["text"] for b in content_blocks if "text" in b),
            None,
        )
        if text_block is None:
            raise ValueError("Nova returned no text content for custom prompt call")
        import json as _json
        # Strip markdown code fences if present
        cleaned = text_block.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```", 2)[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.rsplit("```", 1)[0]
        return _json.loads(cleaned.strip())

    response = client.converse(
        modelId=settings.NOVA_ANALYSIS_MODEL_ID,
        system=[{"text": effective_system}],
        messages=[{
            "role": "user",
            "content": [{"text": transcript_text}],
        }],
        inferenceConfig={"maxTokens": 2048, "temperature": 0.2},
        toolConfig={
            "tools": [{
                "toolSpec": {
                    "name": "record_analysis",
                    "description": "Record the structured IELTS transcript analysis result",
                    "inputSchema": {"json": _ANALYSIS_SCHEMA},
                }
            }],
            "toolChoice": {"tool": {"name": "record_analysis"}},
        },
    )

    # Extract tool use input — Nova is forced to call record_analysis
    content_blocks = response["output"]["message"]["content"]
    tool_block = next(
        (b for b in content_blocks if b.get("toolUse", {}).get("name") == "record_analysis"),
        None,
    )
    if tool_block is None:
        raise ValueError(
            f"Nova did not return a record_analysis tool call. stopReason={response.get('stopReason')}"
        )

    result = tool_block["toolUse"]["input"]

    logger.info(
        "nova_client: analysis complete — grammar=%d vocab=%d band=%.1f",
        len(result.get("grammar_mistakes", [])),
        len(result.get("vocab_usage", [])),
        result.get("band_estimate", {}).get("overall", 0),
    )
    return result
