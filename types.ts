
export enum Role {
  LEARNER = 'LEARNER',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  role: Role;
  growth_memory?: string;
  skill_mastery?: Record<string, number>;
  reminders_enabled?: boolean;
  retention_map?: Record<string, {
    last_practiced: string;
    next_review_date: string;
    strength: 'fresh' | 'fading' | 'stale';
  }>;
}

export interface MicroSkill {
  id: string;
  label: string;
  criteria?: string[];
  trap?: string;
  cue?: string;
}

export interface Skill {
  id: string;
  name?: string;
  label?: string;
  micro_skills?: MicroSkill[];
}

export interface SkillGroup {
  id: string;
  label: string;
  skills: Skill[];
}

export interface SkillLibrary {
  skill_groups: SkillGroup[];
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  challenges?: string[];
  voice?: string;
  instruction?: string;
  rubric?: string;
  skillId: string;
}

export interface TranscriptEntry {
  speaker: 'user' | 'ai';
  text: string;
}

export type InteractionMedium = 'voice' | 'text';

export interface FeedbackScore {
  score: number;
  justification: string;
}

export interface FeedbackAnalysis {
  validity: {
    is_valid: boolean;
    reason: string;
  };
  scores: {
    adaptive_mindset: FeedbackScore;
    cognitive_analytical: FeedbackScore;
    social_interpersonal: FeedbackScore;
    ethics_integrity_values: FeedbackScore;
    change_leadership: FeedbackScore;
  };
  summary: {
    strengths: string[];
    areas_for_improvement: string[];
    overall_summary: string;
  };
  total_score: number;
  leadership_potential: string;
  next_review_days?: number;
}

export interface SkillSnapshot {
  concept: string;
  starterStems: string[];
  watchFor: string;
  successIndicators: string[];
  firstChallenge: string;
}

export interface PracticeAttempt {
  id: string;
  userId: string;
  parentSessionId: string;
  scenarioId: string; // Anchored to the Scenario template
  skillId: string;
  microSkillId: string;
  selectionReason: string;
  snapshotContent?: string; // Stored as JSON string
  transcript: TranscriptEntry[];
  interactionMedium?: InteractionMedium;
  conversationModel?: string;
  analysisModel?: string;
  reflection?: {
    detected: boolean;
    evidence: string;
    impact: string;
    adjustment: string;
    confidence: number;
    usefulness: number;
  };
  timestamp: string; // acts as started_at
  completedAt?: string; // only populated if tutor reached closing message
}

export interface PracticeSession {
  id: string;
  userId: string;
  scenarioId: string;
  transcript: TranscriptEntry[];
  interactionMedium?: InteractionMedium;
  conversationModel?: string;
  analysisModel?: string;
  feedback?: string;
  suggestedFocusOptions?: string;
  learner_rating?: number;
  timestamp: string;
  status: 'in-progress' | 'completed';
}

export interface AppFeedback {
  id: string;
  userId: string;
  userEmail: string;
  content: string;
  timestamp: string;
}

export interface EventLog {
  id: string;
  userId: string;
  eventType: string;
  payload: any;
  timestamp: string;
}
