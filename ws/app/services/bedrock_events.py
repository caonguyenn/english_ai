"""NovaSonic event JSON builders and tool definitions (pure data, no I/O)."""
import json

# ---------------------------------------------------------------------------
# Tool definitions registered once per session in promptStart
# ---------------------------------------------------------------------------
# NovaSonic requires inputSchema.json to be a JSON *string*, not a nested object.
TOOLS = [
    {
        "toolSpec": {
            "name": "record_skill_score",
            "description": (
                "Record a skill score for the student. "
                "Call at session end for each practiced skill."
            ),
            "inputSchema": {
                "json": json.dumps({
                    "type": "object",
                    "properties": {
                        "skill": {
                            "type": "string",
                            "enum": ["speaking", "listening", "grammar", "pronunciation", "vocabulary"],
                        },
                        "score": {"type": "integer", "minimum": 0, "maximum": 100},
                        "notes": {
                            "type": "string",
                            "description": "Brief observation about student performance",
                        },
                    },
                    "required": ["skill", "score"],
                })
            },
        }
    },
    {
        "toolSpec": {
            "name": "complete_class",
            "description": (
                "Call ONCE at the end of a structured class session, when the student has "
                "adequately practiced the lesson's skill and met the learning objective. "
                "The server decides the exact XP award; you only signal completion and a brief reason. "
                "Do NOT call this in placement or playground sessions."
            ),
            "inputSchema": {
                "json": json.dumps({
                    "type": "object",
                    "properties": {
                        "reason": {
                            "type": "string",
                            "description": "One-sentence summary of what the student accomplished",
                        },
                    },
                    "required": ["reason"],
                })
            },
        }
    },
    {
        "toolSpec": {
            "name": "trigger_level_up",
            "description": (
                "Call ONLY when confident the student has mastered the current module. "
                "For placement sessions, include placement_band (2.0–9.0) in evidence."
            ),
            "inputSchema": {
                "json": json.dumps({
                    "type": "object",
                    "properties": {
                        "reason": {"type": "string"},
                        "evidence": {
                            "type": "object",
                            "properties": {
                                "avg_scores": {"type": "object"},
                                "sessions_reviewed": {"type": "integer"},
                                "key_improvements": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "placement_band": {
                                    "type": "number",
                                    "description": "IELTS band 2.0-9.0 assessed during placement",
                                    "minimum": 2.0,
                                    "maximum": 9.0,
                                },
                            },
                        },
                    },
                    "required": ["reason", "evidence"],
                })
            },
        }
    },
]

SESSION_START = json.dumps(
    {
        "event": {
            "sessionStart": {
                "inferenceConfiguration": {
                    "maxTokens": 1024,
                    "topP": 0.9,
                    "temperature": 0.7,
                }
            }
        }
    }
)

SESSION_END = json.dumps({"event": {"sessionEnd": {}}})


def prompt_start(prompt_name: str) -> str:
    return json.dumps(
        {
            "event": {
                "promptStart": {
                    "promptName": prompt_name,
                    "textOutputConfiguration": {"mediaType": "text/plain"},
                    "audioOutputConfiguration": {
                        "mediaType": "audio/lpcm",
                        "sampleRateHertz": 24000,
                        "sampleSizeBits": 16,
                        "channelCount": 1,
                        "voiceId": "matthew",
                        "encoding": "base64",
                        "audioType": "SPEECH",
                    },
                    "toolUseOutputConfiguration": {"mediaType": "application/json"},
                    "toolConfiguration": {"tools": TOOLS},
                }
            }
        }
    )


def text_content_start(prompt_name: str, content_name: str, role: str) -> str:
    return json.dumps(
        {
            "event": {
                "contentStart": {
                    "promptName": prompt_name,
                    "contentName": content_name,
                    "type": "TEXT",
                    "role": role,
                    "interactive": False,
                    "textInputConfiguration": {"mediaType": "text/plain"},
                }
            }
        }
    )


def text_input(prompt_name: str, content_name: str, text: str) -> str:
    return json.dumps(
        {
            "event": {
                "textInput": {
                    "promptName": prompt_name,
                    "contentName": content_name,
                    "content": text,
                }
            }
        }
    )


def audio_content_start(prompt_name: str, audio_content_name: str) -> str:
    return json.dumps(
        {
            "event": {
                "contentStart": {
                    "promptName": prompt_name,
                    "contentName": audio_content_name,
                    "type": "AUDIO",
                    "interactive": True,
                    "role": "USER",
                    "audioInputConfiguration": {
                        "mediaType": "audio/lpcm",
                        "sampleRateHertz": 16000,
                        "sampleSizeBits": 16,
                        "channelCount": 1,
                        "audioType": "SPEECH",
                        "encoding": "base64",
                    },
                }
            }
        }
    )


def audio_input(prompt_name: str, audio_content_name: str, b64_audio: str) -> str:
    return json.dumps(
        {
            "event": {
                "audioInput": {
                    "promptName": prompt_name,
                    "contentName": audio_content_name,
                    "content": b64_audio,
                }
            }
        }
    )


def content_end(prompt_name: str, content_name: str) -> str:
    return json.dumps(
        {
            "event": {
                "contentEnd": {
                    "promptName": prompt_name,
                    "contentName": content_name,
                }
            }
        }
    )


def prompt_end(prompt_name: str) -> str:
    return json.dumps({"event": {"promptEnd": {"promptName": prompt_name}}})


def tool_content_start(
    prompt_name: str, content_name: str, tool_use_id: str
) -> str:
    return json.dumps(
        {
            "event": {
                "contentStart": {
                    "promptName": prompt_name,
                    "contentName": content_name,
                    "interactive": False,
                    "type": "TOOL",
                    "role": "TOOL",
                    "toolResultInputConfiguration": {
                        "toolUseId": tool_use_id,
                        "type": "TEXT",
                        "textInputConfiguration": {"mediaType": "text/plain"},
                    },
                }
            }
        }
    )


def tool_result(prompt_name: str, content_name: str, result_json: str) -> str:
    return json.dumps(
        {
            "event": {
                "toolResult": {
                    "promptName": prompt_name,
                    "contentName": content_name,
                    "content": result_json,
                }
            }
        }
    )
