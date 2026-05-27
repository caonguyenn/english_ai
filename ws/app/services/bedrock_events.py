"""NovaSonic event JSON builders and tool definitions (pure data, no I/O)."""
import json

# ---------------------------------------------------------------------------
# Tool definitions registered once per session in promptStart
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "toolSpec": {
            "name": "record_skill_score",
            "description": (
                "Record a skill score for the student. "
                "Call at session end for each practiced skill."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "skill": {
                            "type": "string",
                            "enum": ["speaking", "listening", "grammar", "pronunciation"],
                        },
                        "score": {"type": "integer", "minimum": 0, "maximum": 100},
                        "notes": {
                            "type": "string",
                            "description": "Brief observation about student performance",
                        },
                    },
                    "required": ["skill", "score"],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "trigger_level_up",
            "description": (
                "Call ONLY when confident the student has mastered the current module."
            ),
            "inputSchema": {
                "json": {
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
                            },
                        },
                    },
                    "required": ["reason", "evidence"],
                }
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
