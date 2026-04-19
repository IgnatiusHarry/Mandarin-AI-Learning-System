const API_BASE = "/api/backend";
/** Fail fast on stuck proxies; SWR will retry with errorRetryInterval. */
const API_TIMEOUT_MS = 6_000;

/** Curriculum is served by Next (`/api/curriculum/*`), not the Python backend. */
async function curriculumFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timeout. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const raw = await res.text();
    let msg = raw;
    try {
      const j = JSON.parse(raw) as { detail?: string; error?: string };
      if (typeof j.detail === "string") msg = j.detail;
      else if (typeof j.error === "string") msg = j.error;
    } catch {
      /* keep raw */
    }
    throw new Error(msg || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timeout. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Stats ─────────────────────────────────────────────────────────

export async function fetchStats(token: string) {
  return nextApiFetch<{
    total_words: number;
    mastered_words: number;
    weak_words: number;
    due_today: number;
    streak_days: number;
    words_reviewed_today: number;
  }>("/api/stats", { token });
}

export async function fetchReviewHistory(token: string, days = 30) {
  return apiFetch<
    { goal_date: string; actual_new_words: number; actual_reviews: number }[]
  >(`/api/stats/history?days=${days}`, { token });
}

export async function fetchMasteryDistribution(token: string) {
  return apiFetch<Record<string, number>>("/api/stats/mastery-distribution", {
    token,
  });
}

// ── Vocabulary ────────────────────────────────────────────────────

export async function fetchVocabulary(token: string) {
  return nextApiFetch<Record<string, unknown>[]>("/api/vocab", { token });
}

export async function fetchVocabWords(token: string) {
  return fetchVocabWordsForScope(token);
}

export async function fetchVocabWordsForScope(token: string, lessonTag?: string) {
  const query = lessonTag
    ? `/api/vocab/words?lesson_tag=${encodeURIComponent(lessonTag)}`
    : "/api/vocab/words";
  return nextApiFetch<
    {
      word: string;
      pinyin: string | null;
      tone_numbers: string | null;
      meaning_en: string | null;
      meaning_id: string | null;
    }[]
  >(query, { token });
}

export async function fetchLessonReviewOptions(token: string) {
  return apiFetch<{ tag: string; title: string }[]>("/api/vocab/lesson-options", {
    token,
  });
}

export async function deleteVocab(token: string, vocabId: string) {
  return apiFetch<void>(`/api/vocab/${vocabId}`, {
    method: "DELETE",
    token,
  });
}

// ── Review ────────────────────────────────────────────────────────

async function nextApiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timeout. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchDueCards(token: string, lessonTag?: string) {
  const query = lessonTag
    ? `/api/review/due?lesson_tag=${encodeURIComponent(lessonTag)}`
    : "/api/review/due";
  return nextApiFetch<Record<string, unknown>[]>(query, { token });
}

export async function submitReviewAnswer(
  token: string,
  vocabularyId: string,
  quality: number,
  responseTimeMs?: number
) {
  return nextApiFetch<{ next_review_in_days: number; mastery_level: number }>( 
    "/api/review/answer",
    {
      method: "POST",
      token,
      body: JSON.stringify({ vocabulary_id: vocabularyId, quality, response_time_ms: responseTimeMs }),
    }
  );
}

export async function startReviewSession(token: string) {
  return apiFetch<{ id: string }>("/api/review/session/start", {
    method: "POST",
    token,
  });
}

export async function endReviewSession(
  token: string,
  sessionId: string,
  wordsReviewed: number,
  wordsCorrect: number,
  durationSeconds: number
) {
  return apiFetch<{ status: string }>(
    `/api/review/session/end?session_id=${sessionId}&words_reviewed=${wordsReviewed}&words_correct=${wordsCorrect}&duration_seconds=${durationSeconds}`,
    { method: "POST", token }
  );
}

export async function fetchWeakWords(token: string, lessonTag?: string) {
  const query = lessonTag
    ? `/api/review/weak?lesson_tag=${encodeURIComponent(lessonTag)}`
    : "/api/review/weak";
  return nextApiFetch<Record<string, unknown>[]>(query, { token });
}

// ── Conversation ──────────────────────────────────────────────────

export async function startConversation(token: string, topic?: string) {
  return apiFetch<{ id: string; topic: string }>("/api/conversation/start", {
    method: "POST",
    token,
    body: JSON.stringify({ topic, source: "web" }),
  });
}

export async function sendConversationMessage(
  token: string,
  conversationId: string,
  content: string
) {
  return apiFetch<{
    reply: string;
    corrections: Record<string, unknown>[];
    new_vocab: string[];
  }>("/api/conversation/message", {
    method: "POST",
    token,
    body: JSON.stringify({ conversation_id: conversationId, content }),
  });
}

export async function fetchConversationHistory(
  token: string,
  conversationId: string
) {
  return apiFetch<Record<string, unknown>[]>(
    `/api/conversation/history?conversation_id=${conversationId}`,
    { token }
  );
}

export async function fetchConversations(token: string) {
  return apiFetch<Record<string, unknown>[]>("/api/conversation", { token });
}

// ── Gamification & Personalization ───────────────────────────────

export async function fetchGamificationProfile(token: string) {
  return apiFetch<{
    xp: number;
    level: number;
    hearts: number;
    subscription_tier: string;
    streak_days: number;
  }>("/api/gamification/profile", { token });
}

export async function fetchQuests(token: string) {
  return apiFetch<
    {
      id: string;
      title: string;
      target: number;
      progress: number;
      reward_xp: number;
    }[]
  >("/api/gamification/quests", { token });
}

export async function fetchPersonalizedStudyPlan(token: string) {
  return apiFetch<{
    streak_days: number;
    daily_goal_words: number;
    focus_words: { word: string; pinyin: string; meaning: string; reason: string }[];
    missions: { id: string; title: string; description: string; target: number; metric: string }[];
    due_cards_count?: number;
    weak_words_count?: number;
    hsk_level?: number;
    native_language?: string | null;
    display_name?: string;
    coach_tip?: string;
  }>("/api/gamification/study-plan", { token });
}

export async function fetchLeaderboard(token: string) {
  return apiFetch<
    {
      user_id: string;
      display_name: string;
      streak_days: number;
      mastered_words: number;
      reviews_30d: number;
      score: number;
    }[]
  >("/api/gamification/leaderboard", { token });
}

export async function fetchSubscriptionPlans(token: string) {
  return apiFetch<
    {
      id: string;
      name: string;
      price_idr: number;
      interval: string;
      features: string[];
    }[]
  >("/api/gamification/subscription/plans", { token });
}

// ── Profile ───────────────────────────────────────────────────────

export async function linkTelegram(token: string, telegramId: number) {
  return apiFetch<{
    status: string;
    profile_id: string;
    telegram_id: number;
    updated: boolean;
  }>("/api/profile/link-telegram", {
    method: "POST",
    token,
    body: JSON.stringify({ telegram_id: telegramId }),
  });
}

export async function fetchCurrentProfile(token: string) {
  return nextApiFetch<{
    id: string;
    display_name: string | null;
    hsk_level: number;
    native_language: string | null;
    daily_goal_words: number;
    timezone: string | null;
    telegram_id: number | null;
  }>("/api/profile/me", { token });
}

export async function updateCurrentProfile(
  token: string,
  body: Partial<{
    display_name: string;
    hsk_level: number;
    native_language: string;
    daily_goal_words: number;
    timezone: string;
  }>
) {
  return nextApiFetch<{
    id: string;
    display_name: string | null;
    hsk_level: number;
    native_language: string | null;
    daily_goal_words: number;
    timezone: string | null;
    telegram_id: number | null;
  }>("/api/profile/me", {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

// ── Textbook curriculum (public catalog; no auth required) ────────

export type CurriculumBook = {
  id: string;
  slug: string;
  name: string;
  series: string | null;
  volume: number | null;
  meta: Record<string, unknown>;
};

export type CurriculumChapterSummary = {
  id: string;
  chapter_number: number;
  title: string;
  summary: string;
};

export async function fetchCurriculumBooks() {
  return curriculumFetch<CurriculumBook[]>("/api/curriculum/books");
}

export async function fetchCurriculumBook(slug: string) {
  return curriculumFetch<{
    book: CurriculumBook;
    chapters: CurriculumChapterSummary[];
  }>(`/api/curriculum/books/${encodeURIComponent(slug)}`);
}

export async function fetchCurriculumChapter(slug: string, chapterNumber: number) {
  return curriculumFetch<{
    book: { slug: string; name: string };
    chapter: CurriculumChapterSummary & { id: string };
    vocabulary: {
      id: string;
      word: string;
      pinyin: string;
      meaning: string;
      meaning_en: string | null;
      meaning_id: string | null;
      example_sentence: string | null;
      source: string;
      chapter_example_usage: string | null;
      sort_order: number | null;
    }[];
    grammar: {
      id: string;
      grammar_title: string;
      structure: string;
      explanation: string;
      examples: { sentence: string; translation: string; sort_order: number | null }[];
    }[];
  }>(`/api/curriculum/books/${encodeURIComponent(slug)}/chapters/${chapterNumber}`);
}

