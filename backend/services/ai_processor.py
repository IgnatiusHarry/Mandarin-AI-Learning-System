import json
import anthropic
from config import get_settings
from models.schemas import VocabItem

settings = get_settings()
_client: anthropic.Anthropic | None = None


def get_anthropic() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


VOCAB_EXTRACTION_PROMPT = """The user is a HSK 3-4 Mandarin learner (Traditional Chinese, Taiwan context).
They pasted: "{text}"

Extract ALL vocabulary words (focus on words useful for HSK 3-4, skip basic HSK 1-2 words they likely know).
For each word return valid JSON with exactly these fields:
{{
  "word": "學習",
  "simplified": "学习",
  "pinyin": "xué xí",
  "tone_numbers": "2 2",
  "meaning_en": "to study / to learn",
  "meaning_id": "belajar",
  "part_of_speech": "verb",
  "hsk_level": 2,
  "example_sentence": "我每天學習中文。",
  "example_pinyin": "Wǒ měitiān xuéxí Zhōngwén.",
  "memory_tip": "學 = child (子) imitating marks under a roof (冖)"
}}

Return a JSON array only. No explanation, no markdown fences."""


CONVERSATION_SYSTEM_PROMPT = """You are 小明 (Xiǎo Míng), a friendly Taiwanese Mandarin conversation partner.

User profile:
- Level: HSK 3-4
- Known vocabulary: {known_words}
- Weak spots (needs practice): {weak_words}
- Native language: Indonesian

Rules:
1. ALWAYS reply in Traditional Chinese (繁體字), Taiwan usage
2. Include pinyin in (brackets) only for new or difficult words
3. Keep complexity at HSK 3-4 level
4. Naturally weave the user's known vocabulary into your sentences
5. Correct grammar mistakes gently using this exact format:
   「你說的是：[wrong]，更好的說法是：[correct]，因為...」
6. Flag tone errors: 「注意聲調：[word] 是 X 聲，不是 Y 聲」
7. Every 3-4 exchanges, introduce 1 word from their review queue naturally in a sentence
8. Topic: {topic}

After your reply, on a new line add a JSON block (wrapped in ```corrections``` tags) like:
```corrections
{{"corrections": [], "new_vocab": []}}
```
If you made corrections, list them. If you introduced new vocab, list the words."""


async def extract_vocab(text: str) -> list[VocabItem]:
    """Call Claude to extract vocabulary from pasted Chinese text."""
    client = get_anthropic()
    prompt = VOCAB_EXTRACTION_PROMPT.format(text=text)

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown fences if Claude wrapped it anyway
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    data = json.loads(raw)
    return [VocabItem(**item) for item in data]


async def chat_response(
    conversation_id: str,
    user_message: str,
    history: list[dict],
    known_words: list[str],
    weak_words: list[str],
    topic: str = "free conversation",
) -> tuple[str, list[dict], list[str]]:
    """
    Send a conversation message to Claude.
    Returns (reply_text, corrections_list, new_vocab_list).
    """
    client = get_anthropic()

    system = CONVERSATION_SYSTEM_PROMPT.format(
        known_words=", ".join(known_words[:50]) if known_words else "none yet",
        weak_words=", ".join(weak_words[:20]) if weak_words else "none",
        topic=topic,
    )

    messages = history + [{"role": "user", "content": user_message}]

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        system=system,
        messages=messages,
    )

    full_reply = response.content[0].text

    # Parse out corrections block
    corrections: list[dict] = []
    new_vocab: list[str] = []
    display_reply = full_reply

    if "```corrections" in full_reply:
        parts = full_reply.split("```corrections")
        display_reply = parts[0].strip()
        try:
            corrections_json = parts[1].split("```")[0].strip()
            parsed = json.loads(corrections_json)
            corrections = parsed.get("corrections", [])
            new_vocab = parsed.get("new_vocab", [])
        except (json.JSONDecodeError, IndexError):
            pass

    return display_reply, corrections, new_vocab
