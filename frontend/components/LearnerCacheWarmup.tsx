"use client";

import { useEffect, useRef } from "react";
import { preload } from "swr";
import {
  fetchStats,
  fetchGamificationProfile,
  fetchQuests,
  fetchPersonalizedStudyPlan,
  fetchSubscriptionPlans,
  fetchCurrentProfile,
  fetchVocabulary,
  fetchReviewHistory,
  fetchMasteryDistribution,
  fetchLeaderboard,
  fetchLessonReviewOptions,
  fetchWeakWords,
  fetchConversations,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { learnerKeys } from "@/lib/learner-keys";

const HISTORY_DAYS = 30;

type Triple = readonly [string, string, string];

function tok3(key: unknown): string {
  return (key as Triple)[2];
}

function tokReview(key: unknown): [string, number] {
  const k = key as readonly [string, string, string, number];
  return [k[2], k[3]];
}

/**
 * After login, prefetch main learner APIs in parallel so route transitions
 * hit a warm SWR cache (see AppProviders dedupingInterval).
 */
export default function LearnerCacheWarmup() {
  const { token, ready } = useAuth();
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !token) {
      if (ready && !token) {
        lastToken.current = null;
      }
      return;
    }
    if (lastToken.current === token) {
      return;
    }
    lastToken.current = token;

    void preload(learnerKeys.stats(token), (k) => fetchStats(tok3(k)));
    void preload(learnerKeys.gamificationProfile(token), (k) =>
      fetchGamificationProfile(tok3(k))
    );
    void preload(learnerKeys.quests(token), (k) => fetchQuests(tok3(k)));
    void preload(learnerKeys.studyPlan(token), (k) =>
      fetchPersonalizedStudyPlan(tok3(k))
    );
    void preload(learnerKeys.subscriptionPlans(token), (k) =>
      fetchSubscriptionPlans(tok3(k))
    );
    void preload(learnerKeys.profile(token), (k) => fetchCurrentProfile(tok3(k)));
    void preload(learnerKeys.vocabulary(token), (k) => fetchVocabulary(tok3(k)));
    void preload(learnerKeys.reviewHistory(token, HISTORY_DAYS), (k) => {
      const [t, days] = tokReview(k);
      return fetchReviewHistory(t, days);
    });
    void preload(learnerKeys.masteryDistribution(token), (k) =>
      fetchMasteryDistribution(tok3(k))
    );
    void preload(learnerKeys.leaderboard(token), (k) => fetchLeaderboard(tok3(k)));
    void preload(learnerKeys.lessonOptions(token), (k) =>
      fetchLessonReviewOptions(tok3(k))
    );
    void preload(learnerKeys.weakWords(token), (k) => fetchWeakWords(tok3(k)));
    void preload(learnerKeys.conversations(token), (k) => fetchConversations(tok3(k)));
  }, [ready, token]);

  return null;
}
