/** Stable SWR cache keys — prefix `learner` for bulk invalidation on realtime. */

export const learnerKeys = {
  stats: (token: string) => ["learner", "stats", token] as const,
  gamificationProfile: (token: string) => ["learner", "gamification", token] as const,
  quests: (token: string) => ["learner", "quests", token] as const,
  studyPlan: (token: string) => ["learner", "studyPlan", token] as const,
  subscriptionPlans: (token: string) => ["learner", "subscriptionPlans", token] as const,
  vocabulary: (token: string) => ["learner", "vocabulary", token] as const,
  reviewHistory: (token: string, days: number) =>
    ["learner", "reviewHistory", token, days] as const,
  masteryDistribution: (token: string) =>
    ["learner", "masteryDistribution", token] as const,
  leaderboard: (token: string) => ["learner", "leaderboard", token] as const,
  lessonOptions: (token: string) => ["learner", "lessonOptions", token] as const,
  profile: (token: string) => ["learner", "profile", token] as const,
  conversations: (token: string) => ["learner", "conversations", token] as const,
  weakWords: (token: string) => ["learner", "weakWords", token] as const,
};

export function isLearnerKey(key: unknown): boolean {
  return Array.isArray(key) && key[0] === "learner";
}
