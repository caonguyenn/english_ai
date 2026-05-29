# AI Memory System

## Goal

Create a personalized tutor experience.

The AI should remember important information about students.

---

# Memory Categories

## Personal

Examples:

* Name
* Occupation
* Country
* Family

---

## Interests

Examples:

* Photography
* Chess
* Football
* Travel

---

## Learning Goals

Examples:

* IELTS 6.5
* Study abroad
* Job interview

---

# Memory Extraction

After every session:

Transcript
↓
Memory Extractor
↓
Memory Store

Example:

Student:

"I work as a DevOps Engineer."

Store:

```json
{
  "type": "job",
  "value": "DevOps Engineer"
}
```

---

# Memory Usage

Future session:

Prompt Context:

Student Job:
DevOps Engineer

Student Interests:
Photography

Student Goal:
IELTS 6.5

AI Question:

"You mentioned that you work as a DevOps Engineer. What challenges do you face when managing cloud infrastructure?"

---

# Memory Rules

Store:

✓ Long-term useful information

Do Not Store:

✗ Temporary information
✗ Sensitive personal data
✗ Financial information
✗ Credentials
✗ Passwords

---

# Memory Lifecycle

New Memory
↓
Confidence Scoring
↓
Verification
↓
Long-Term Memory
↓
Prompt Injection

```
```
