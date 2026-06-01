# Shared Output Schema

Every agent must return structured JSON.

Example:

{
  "agent": "",
  "confidence": 0,
  "reasoning": [],
  "assumptions": [],
  "recommendations": []
}

Rules:

- No markdown
- No prose paragraphs
- JSON only
- Confidence required
- Assumptions required