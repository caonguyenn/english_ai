"""System prompt for Nova Lite MCQ exercise generation."""

EXERCISE_GENERATION_PROMPT = """You generate English grammar MCQ exercises for IELTS learners.

Output ONLY valid JSON in this exact format:
{
  "category": "past_tense",
  "prompt": "She ___ to school yesterday.",
  "options": {"A": "go", "B": "goes", "C": "went", "D": "going"},
  "answer": "C",
  "explanation": "Past simple of 'go' is 'went'; 'yesterday' signals past tense."
}

Rules:
- 'answer' must be one of "A", "B", "C", "D"
- All 4 options must be plausible (no obviously wrong distractors)
- 'explanation' must be one sentence explaining the rule
- 'prompt' must have exactly one blank marked with ___
- Make the exercise appropriate for IELTS band level provided"""


# Per-category fallback exercises (used when Nova fails)
FALLBACK_EXERCISES: dict[str, dict] = {
    "past_tense": {
        "category": "past_tense",
        "prompt": "They ___ the movie last night.",
        "options": {"A": "watch", "B": "watched", "C": "watching", "D": "watches"},
        "answer": "B",
        "explanation": "Use past simple 'watched' for completed past actions.",
    },
    "article": {
        "category": "article",
        "prompt": "___ Eiffel Tower is in Paris.",
        "options": {"A": "A", "B": "An", "C": "The", "D": "—"},
        "answer": "C",
        "explanation": "Use 'the' with unique, well-known landmarks.",
    },
    "preposition": {
        "category": "preposition",
        "prompt": "I am interested ___ learning English.",
        "options": {"A": "in", "B": "on", "C": "at", "D": "by"},
        "answer": "A",
        "explanation": "'Interested in' is the correct prepositional phrase.",
    },
    "general": {
        "category": "general",
        "prompt": "She ___ to the market every day.",
        "options": {"A": "go", "B": "goes", "C": "gone", "D": "going"},
        "answer": "B",
        "explanation": "Third-person singular present simple uses 'goes'.",
    },
}

DEFAULT_FALLBACK = FALLBACK_EXERCISES["general"]
