import json
import anthropic
from config import get_settings
from models.schemas import VocabItem

settings = get_settings()
_client: anthropic.Anthropic | None = None

# ── Lesson-specific data ──────────────────────────────────────────

# 時代華語 Book 1, Chapter 10 — 下課後一起去健身吧！
LESSON_VOCAB: dict[str, list[str]] = {
    "時代華語-10": [
        "健身", "健身房", "下課", "一起", "運動", "跑步", "游泳",
        "打球", "爬山", "騎腳踏車", "有空", "覺得", "因為", "所以",
        "習慣", "公斤", "瘦", "胖", "累", "舒服", "精神", "最近",
        "每天", "週末", "身體", "健康", "不錯", "要", "可以",
        "多", "少", "小時", "公里", "放學",
    ],
}

LESSON_TITLES: dict[str, str] = {
    "時代華語-10": "時代華語 第10課：下課後一起去健身吧！",
}

LESSON_GRAMMAR: dict[str, str] = {
    "時代華語-10": """
Grammar focus for this lesson (第10課):
1. 一起 + V → invite/suggest doing together: 我們一起去健身吧！
2. V + 吧！→ mild suggestion: 去游泳吧！去跑步吧！
3. 因為...所以... → because...therefore...: 因為我很累，所以不想運動。
4. 覺得 + adj/clause → feel/think: 你覺得游泳怎麼樣？
5. 習慣 + V/N → be used to / habit: 我習慣每天早上跑步。
6. 有空/有時間 + V → have time to: 你週末有空去健身嗎？

Suggested roleplay scenarios:
- Inviting a classmate to the gym after school
- Discussing favorite sports and workout routines  
- Talking about health goals (weight, endurance)
- Comparing different exercises and their benefits""",
}

LESSON_QUESTIONS: dict[str, list[str]] = {
    "時代華語-10": [
        "填空：我們下課後一起___吧！（健身 / 健身房）",
        "改錯：因為我很累，我所以不想運動。",
        "口說：用『因為...所以...』說你喜歡的運動。",
        "口說：用『覺得』造句，描述健身後的感覺。",
        "問答：你週末有空一起去跑步嗎？請完整回答。",
        "情境：同學邀請你去游泳，你接受或拒絕並說理由。",
    ],
}


def _anthropic_enabled() -> bool:
    key = (settings.anthropic_api_key or "").strip()
    return bool(key and key != "placeholder")


def get_anthropic() -> anthropic.Anthropic:
    if not _anthropic_enabled():
        raise RuntimeError("Anthropic API key is not configured")

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
- Level: HSK {user_level}
- Known vocabulary: {known_words}
- Weak spots (needs practice): {weak_words}
- Native language: {native_language}

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
9. When you explain a grammar pattern in more than one sentence, add one short clarifying sentence in the learner's native language ({native_language}) after the Chinese explanation.

After your reply, on a new line add a JSON block (wrapped in ```corrections``` tags) like:
```corrections
{{"corrections": [], "new_vocab": []}}
```
If you made corrections, list them. If you introduced new vocab, list the words."""


async def extract_vocab(text: str) -> list[VocabItem]:
    """Call Claude to extract vocabulary from pasted Chinese text."""
    try:
        client = get_anthropic()
    except RuntimeError:
        return []

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
    lesson_tag: str | None = None,
    lesson_vocab: list[dict] | None = None,
    lesson_mode: str | None = None,
    user_level: int = 3,
    native_language: str = "Indonesian",
) -> tuple[str, list[dict], list[str]]:
    """
    Send a conversation message to Claude.
    Returns (reply_text, corrections_list, new_vocab_list).
    """
    if not _anthropic_enabled():
        fallback = (
            "我現在在離線教學模式。"
            "請用中文再說一次你的句子，我會幫你練習語法和用字。\n"
            f"你剛剛說的是：{user_message}"
        )
        return fallback, [], []

    client = get_anthropic()

    system = CONVERSATION_SYSTEM_PROMPT.format(
        user_level=user_level,
        known_words=", ".join(known_words[:50]) if known_words else "none yet",
        weak_words=", ".join(weak_words[:20]) if weak_words else "none",
        native_language=native_language,
        topic=topic,
    )

    # Inject lesson-specific context when in lesson mode
    if lesson_tag and lesson_tag in LESSON_GRAMMAR:
        lesson_title = LESSON_TITLES.get(lesson_tag, lesson_tag)
        grammar_notes = LESSON_GRAMMAR[lesson_tag].strip()
        vocab_lines = ""
        if lesson_vocab:
            vocab_lines = "\nLesson vocabulary the student has in their deck:\n" + ", ".join(
                f"{v['word']}({v.get('pinyin', '')})"
                for v in lesson_vocab[:40]
            )

        question_lines = ""
        questions = LESSON_QUESTIONS.get(lesson_tag, [])
        if questions:
            question_lines = "\nQuestion bank examples:\n" + "\n".join(
                f"- {q}" for q in questions[:8]
            )

        mode = (lesson_mode or "mixed").lower()
        mode_instruction = {
            "vocabulary": (
                "Primary focus: vocabulary drill. In each reply, use 2-4 target words and "
                "briefly check meaning/usage with one mini prompt."
            ),
            "grammar": (
                "Primary focus: grammar drill. Give concise correction/explanation and then one "
                "new sentence pattern from this lesson."
            ),
            "quiz": (
                "Primary focus: quiz mode. Ask one short question each turn (fill-in / correction / "
                "roleplay) from the lesson question bank, then wait for user answer."
            ),
            "mixed": (
                "Primary focus: mixed practice. Blend conversation naturally with lesson vocabulary, "
                "grammar correction, and occasional short quiz questions."
            ),
        }.get(mode, "Primary focus: mixed practice.")

        system += (
            f"\n\nLESSON MODE ACTIVE: {lesson_title} ({lesson_tag})\n"
            f"{grammar_notes}"
            f"{vocab_lines}"
            f"{question_lines}"
            f"\nAdapt all explanations, correction depth, and vocabulary difficulty to HSK {user_level}."
            f"\n\n{mode_instruction}"
            "\nAlways stay in this lesson scope unless the user asks to switch lessons."
        )

    messages = history + [{"role": "user", "content": user_message}]

    try:
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system=system,
            messages=messages,
        )
    except Exception:
        fallback = "我現在連線有點不穩定。請你換一句簡單的中文，我會馬上回覆你。"
        return fallback, [], []

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
