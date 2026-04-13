const API_BASE = "/api/backend";
const API_TIMEOUT_MS = 8000;

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
  return apiFetch<{
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
  return apiFetch<Record<string, unknown>[]>("/api/vocab", { token });
}

export async function deleteVocab(token: string, vocabId: string) {
  return apiFetch<void>(`/api/vocab/${vocabId}`, {
    method: "DELETE",
    token,
  });
}

// ── Review ────────────────────────────────────────────────────────

export async function fetchDueCards(token: string) {
  return apiFetch<Record<string, unknown>[]>("/api/review/due", { token });
}

export async function submitReviewAnswer(
  token: string,
  vocabularyId: string,
  quality: number,
  responseTimeMs?: number
) {
  return apiFetch<{ next_review_in_days: number; mastery_level: number }>( 
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

export async function fetchWeakWords(token: string) {
  return apiFetch<Record<string, unknown>[]>("/api/review/weak", { token });
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
