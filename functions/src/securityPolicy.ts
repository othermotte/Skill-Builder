import { HttpsError } from 'firebase-functions/v2/https';
export function validateModelPayload(data: unknown) {
  if (Buffer.byteLength(JSON.stringify(data ?? {}), 'utf8') > 256000) {
    throw new HttpsError('invalid-argument', 'This request is too large. Please shorten the conversation or supporting notes.');
  }
}
export function validatedTranscript(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 300) throw new HttpsError('invalid-argument', 'The conversation transcript is invalid or too long.');
  let total = 0;
  const result = value.map(entry => {
    if (!entry || !['user','ai'].includes(entry.speaker) || typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > 8000) throw new HttpsError('invalid-argument', 'The conversation contains an invalid message.');
    total += entry.text.length;
    return {speaker: entry.speaker as 'user' | 'ai', text: entry.text.trim()};
  });
  if (total > 120000) throw new HttpsError('invalid-argument', 'The conversation transcript is too long.');
  return result;
}
export function assertTextTurnAvailable(data: {turnCount?: number; processingUntil?: number}, now: number) {
  if (Number(data.turnCount || 0) >= 30) throw new HttpsError('resource-exhausted', 'This conversation has reached its turn limit. Please complete it or start a new session.');
  if (Number(data.processingUntil || 0) > now) throw new HttpsError('aborted', 'A reply is already being prepared. Please wait for it to finish.');
}
