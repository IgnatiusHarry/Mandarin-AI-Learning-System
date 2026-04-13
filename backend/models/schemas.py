from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


# --- Request models ---

class MessageRequest(BaseModel):
    telegram_id: int
    text: str
    message_type: str = "text"
    supabase_auth_id: UUID | None = None


class MessageResponse(BaseModel):
    reply_text: str
    parse_mode: str = "Markdown"


class AddWordRequest(BaseModel):
    telegram_id: int
    word: str
    pinyin: str
    meaning_en: str
    meaning_id: str | None = None


class LinkTelegramRequest(BaseModel):
    telegram_id: int


class ReviewAnswerRequest(BaseModel):
    telegram_id: int | None = None
    user_id: UUID | None = None
    vocabulary_id: UUID
    quality: int = Field(ge=0, le=5)
    response_time_ms: int | None = None


class ConversationStartRequest(BaseModel):
    telegram_id: int | None = None
    user_id: UUID | None = None
    topic: str | None = None
    source: str = "telegram"


class ConversationMessageRequest(BaseModel):
    conversation_id: UUID
    content: str
    telegram_id: int | None = None
    user_id: UUID | None = None


# --- Data models ---

class VocabItem(BaseModel):
    word: str
    simplified: str | None = None
    pinyin: str
    tone_numbers: str | None = None
    meaning_en: str
    meaning_id: str | None = None
    part_of_speech: str | None = None
    hsk_level: int | None = None
    example_sentence: str | None = None
    example_pinyin: str | None = None
    memory_tip: str | None = None


class ReviewCard(BaseModel):
    vocabulary_id: UUID
    word: str
    pinyin: str
    meaning_en: str
    meaning_id: str | None = None
    example_sentence: str | None = None
    mastery_level: int
    review_count: int


class SRSResult(BaseModel):
    interval: int
    ease_factor: float
    next_review_at: datetime
    mastery_level: int


class UserStats(BaseModel):
    total_words: int
    mastered_words: int  # mastery_level >= 4
    weak_words: int  # average_quality < 3 and review_count >= 3
    due_today: int
    streak_days: int
    words_reviewed_today: int


class ConversationMessage(BaseModel):
    role: str
    content: str
    corrections: dict | None = None
    vocab_introduced: list[str] | None = None
