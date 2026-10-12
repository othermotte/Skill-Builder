import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import type { TranscriptEntry, Scenario, FeedbackAnalysis, PracticeAttempt, SkillSnapshot, InteractionMedium } from '../types';
import {
  getGlobalAssessorProtocol,
  getSkillLibrary
} from './firebase';

/**
 * Custom error class to handle rate limits and quota issues.
 */
export class GeminiApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

interface UsageStatus {
  count: number;
  limit: number;
  remaining: number;
  unlimited?: boolean;
}

interface TextSessionStart {
  sessionId: string;
  response: string;
  model: string;
  usage?: UsageStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// All AI calls go through Firebase Cloud Functions.
// The real Gemini API key never touches the browser.
// ─────────────────────────────────────────────────────────────────────────────

export const startTextConversation = async (
  mode: 'diagnostic' | 'tutorial',
  systemInstruction: string
): Promise<TextSessionStart> => {
  const fn = httpsCallable<
    { mode: 'diagnostic' | 'tutorial'; systemInstruction: string },
    TextSessionStart
  >(functions, 'startGeminiTextSession');
  const result = await fn({ mode, systemInstruction });
  return result.data;
};

export const continueTextConversation = async (
  sessionId: string,
  systemInstruction: string,
  transcript: TranscriptEntry[]
): Promise<{ response: string; model: string }> => {
  const fn = httpsCallable<
    { sessionId: string; systemInstruction: string; transcript: TranscriptEntry[] },
    { response: string; model: string }
  >(functions, 'continueGeminiTextSession');
  const result = await fn({ sessionId, systemInstruction, transcript });
  return result.data;
};

export const conversationModelForMedium = (medium: InteractionMedium) =>
  medium === 'text'
    ? 'gemini-3.6-flash'
    : 'gemini-3.8-live';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * DEEP ASSESSMENT (Requires Pro for high-fidelity reasoning)
 */
export const getFeedbackForTranscript = async (
  scenario: Scenario,
  transcript: TranscriptEntry[],
  skillName: string,
  language: string
): Promise<{ text: string }> => {
  if (transcript.length === 0) throw new Error("Transcript is empty.");

  // Fetch the assessor protocol from Firestore (still client-side, it's not a secret)
  const protocol = await getGlobalAssessorProtocol();

  try {
    const fn = httpsCallable<any, { text: string }>(functions, 'getFeedbackForTranscript');
    const result = await fn({ transcript, scenario, skillName, language, protocol });
    return result.data;
  } catch (error: any) {
    if (error?.code === 'functions/resource-exhausted' || error?.message?.includes('429')) {
      throw new GeminiApiError(429, "The Assessment Studio is currently at capacity. Please wait a few moments before submitting again.");
    }
    throw error;
  }
};

/**
 * SKILL SUGGESTIONS
 */
export const getMicroSkillSuggestions = async (
  transcript: TranscriptEntry[],
  feedback: FeedbackAnalysis
): Promise<any[]> => {
  const skillLibrary = await getSkillLibrary();

  const fn = httpsCallable<any, any[]>(functions, 'getMicroSkillSuggestions');
  const result = await fn({ transcript, feedback, skillLibrary });
  return result.data;
};

/**
 * SNAPSHOT GENERATION - Structured for clean UI
 */
export const generateSkillSnapshot = async (
  microSkillLabel: string,
  evidence: string,
  history: string
): Promise<SkillSnapshot> => {
  const fn = httpsCallable<any, SkillSnapshot>(functions, 'generateSkillSnapshot');
  const result = await fn({ microSkillLabel, evidence, history });
  return result.data;
};

/**
 * PRACTICE REFLECTION
 */
export const analyzePracticeReflection = async (
  attempt: PracticeAttempt,
  microSkillLabel: string
): Promise<any> => {
  const fn = httpsCallable<any, any>(functions, 'analyzePracticeReflection');
  const result = await fn({ transcript: attempt.transcript, microSkillLabel });
  return result.data;
};
