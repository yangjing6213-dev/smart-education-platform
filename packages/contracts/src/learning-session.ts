export type LearningSessionStatus = "ACTIVE" | "COMPLETED" | "CLOSED" | "EXPIRED" | "HANDED_OFF";

export interface LearningChoice {
  readonly id: "A" | "B" | "C";
  readonly label: string;
}

export interface LearningQuestionView {
  readonly id: string;
  readonly grade: "三年级";
  readonly subject: "数学";
  readonly prompt: string;
  readonly knowledgePoint: string;
  readonly choices: readonly LearningChoice[];
}

export interface LearningPracticeView {
  readonly id: "practice-1" | "practice-2";
  readonly prompt: string;
  readonly choices: readonly LearningChoice[];
  readonly answered: boolean;
  readonly correct: boolean | null;
}

export interface LearningSessionView {
  readonly id: string;
  readonly version: number;
  readonly status: LearningSessionStatus;
  readonly consentVersion: "LEARNING_DEMO_V2";
  readonly consentedAt: string;
  readonly guidanceMode: "FIXED_LOCAL";
  readonly studentId: string;
  readonly studentLabel: string;
  readonly question: LearningQuestionView;
  readonly durationMinutes: 5 | 10 | 15;
  readonly startedAt: string;
  readonly endsAt: string;
  readonly mainAttempts: number;
  // Optional during local service rollout; new services always supply both fields.
  readonly mainAttemptLimit?: number;
  readonly mainAttemptLimitReached?: boolean;
  readonly lastHintAtAttempt: number;
  readonly mainCorrect: boolean;
  readonly highestHintLevel: -1 | 0 | 1 | 2 | 3;
  readonly visibleHint: { readonly level: 0 | 1 | 2 | 3; readonly text: string } | null;
  readonly consolidation: readonly LearningPracticeView[];
  readonly needsTeacherFollowUp: boolean;
}

export interface ParentLearningSessionStartInput {
  readonly questionId: "math-grade-3-addition-01";
  readonly consentVersion: "LEARNING_DEMO_V2";
  readonly durationMinutes: 5 | 10 | 15;
}

export interface ParentLearningSessionAnswerInput {
  readonly itemId: "main" | "practice-1" | "practice-2";
  readonly choice: LearningChoice["id"];
  readonly expectedVersion: number;
}

export interface ParentLearningSessionHintInput {
  readonly level: 0 | 1 | 2 | 3;
  readonly expectedVersion: number;
}

export interface ParentLearningSessionCloseInput {
  readonly expectedVersion: number;
}

export interface LearningTeacherSummary {
  readonly sessions: readonly {
    readonly id: string;
    readonly status: LearningSessionStatus;
    readonly studentLabel: string;
    readonly grade: "三年级";
    readonly subject: "数学";
    readonly knowledgePoint: string;
    readonly mainAttempts: number;
    readonly highestHintLevel: -1 | 0 | 1 | 2 | 3;
    readonly consolidationCompleted: number;
    readonly needsTeacherFollowUp: boolean;
    readonly startedAt: string;
  }[];
}

export interface LearningSafetySummary {
  readonly metricVersion: "LEARNING_SAFETY_V2";
  readonly totalSessions: number;
  readonly activeSessions: number;
  readonly completedSessions: number;
  readonly closedSessions: number;
  readonly expiredSessions: number;
  readonly hintRequests: number;
  readonly teacherFollowUps: number;
  readonly refusedActions: number;
  readonly teacherHandoffs: number;
  readonly fixedGuidanceSessions: number;
  readonly firstAttemptSuccesses: number;
  readonly hintAssistedSuccesses: number;
  readonly mainAnswerAttempts: number;
  readonly consolidationAnswered: number;
  readonly consolidationCorrect: number;
  readonly postHintAnswerRate: LearningRateMetric;
  readonly consolidationCompletionRate: LearningRateMetric;
  readonly teacherInterventionRate: LearningRateMetric;
  readonly answerErrorRate: LearningRateMetric;
  readonly severeSafetyEvents: number;
}

export interface LearningRateMetric {
  readonly numerator: number;
  readonly denominator: number;
  readonly percent: number | null;
}
