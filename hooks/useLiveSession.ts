import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { httpsCallable } from 'firebase/functions';
import { TranscriptEntry } from '../types';
import { downsampleTo16k, base64EncodeAudio, pcmToAudioBuffer, decodeBase64ToBytes } from '../utils/audioUtils';
import { functions } from '../firebaseConfig';

export type SessionStatus = 'idle' | 'connecting' | 'active' | 'error';
export type SessionErrorType = 'connection' | 'limit' | null;

interface UsageStatus {
  count: number;
  limit: number;
  remaining: number;
  unlimited?: boolean;
}

interface TranscriptDebugState {
  inputChunkCount: number;
  outputChunkCount: number;
  inputBuffer: string;
  outputBuffer: string;
  transcriptCount: number;
  lastServerContentKeys: string[];
}

const initialTranscriptDebug: TranscriptDebugState = {
  inputChunkCount: 0,
  outputChunkCount: 0,
  inputBuffer: '',
  outputBuffer: '',
  transcriptCount: 0,
  lastServerContentKeys: [],
};

interface UseLiveSessionProps {
  voiceName: string;
  systemInstruction: string;
  scenarioId?: string;
  microSkillId?: string;
  omitGlobalOS?: boolean;
  mode?: 'diagnostic' | 'tutorial';
  initialPrompt?: string;
  debugLabel?: string;
}

export const useLiveSession = ({ voiceName, systemInstruction, omitGlobalOS = false, mode = 'diagnostic', initialPrompt: initialPromptOverride, debugLabel, scenarioId, microSkillId }: UseLiveSessionProps) => {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<SessionErrorType>(null);
  const [volume, setVolume] = useState(0);
  const [streamingText, setStreamingText] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [transcriptDebug, setTranscriptDebug] = useState<TranscriptDebugState>(initialTranscriptDebug);

  const statusRef = useRef<SessionStatus>('idle');
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const userTranscriptBuffer = useRef<string>('');
  const aiTranscriptBuffer = useRef<string>('');

  const appendTranscript = useCallback((entry: TranscriptEntry) => {
    transcriptRef.current = [...transcriptRef.current, entry];
    setTranscript(transcriptRef.current);
    setTranscriptDebug(prev => ({ ...prev, transcriptCount: transcriptRef.current.length }));
  }, []);

  const flushTranscriptBuffers = useCallback(() => {
    if (userTranscriptBuffer.current.trim()) {
      appendTranscript({ speaker: 'user', text: userTranscriptBuffer.current.trim() });
      userTranscriptBuffer.current = '';
    }
    if (aiTranscriptBuffer.current.trim()) {
      appendTranscript({ speaker: 'ai', text: aiTranscriptBuffer.current.trim() });
      aiTranscriptBuffer.current = '';
    }
    return transcriptRef.current;
  }, [appendTranscript]);

  const stopAllAudio = useCallback(() => {
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { }
    });
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const cleanup = useCallback(async () => {
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) { }
      sessionPromiseRef.current = null;
    }

    stopAllAudio();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        try {
          await audioContextRef.current.close();
        } catch (e) { }
      }
      audioContextRef.current = null;
    }
    nextStartTimeRef.current = 0;
    setVolume(0);
    setStreamingText('');
  }, [stopAllAudio]);

  const disconnect = useCallback(async () => {
    const finalTranscript = flushTranscriptBuffers();
    console.log(`LiveSession: Disconnecting with ${finalTranscript.length} transcript entries.`);
    await cleanup();
    statusRef.current = 'idle';
    setStatus('idle');
    return finalTranscript;
  }, [cleanup, flushTranscriptBuffers]);

  const connect = useCallback(async () => {

    try {
      setStatus('connecting');
      statusRef.current = 'connecting';
      setErrorMessage(null);
      setErrorType(null);
      setTranscript([]);
      transcriptRef.current = [];
      userTranscriptBuffer.current = '';
      aiTranscriptBuffer.current = '';
      setTranscriptDebug(initialTranscriptDebug);

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      }).catch(err => {
        console.error("LiveSession: Microphone access denied", err);
        throw err;
      });
      mediaStreamRef.current = stream;

      const openingInstruction = mode === 'tutorial'
        ? `The learner has just connected. Welcome them briefly, explain that you will begin with a short practice challenge, and invite them into the first rep.`
        : `The participant has already read the scenario and is ready. Your first spoken message must be exactly: "How would you tackle this scenario?" Do not give a generic greeting, ask what they want to discuss, ask whether they are ready, or repeat the scenario. After the participant answers, continue with one neutral question at a time to probe their reasoning.`;

      const initialPrompt = initialPromptOverride || (mode === 'tutorial'
        ? 'I am ready to begin the micro-skill practice. Please start the first rep.'
        : 'I have read the scenario and am ready. Begin the assessment with your first scenario-specific question.');

      let combinedInstruction = `
        ${systemInstruction}

        ### SESSION OPENING
        ${openingInstruction}
      `;

      // Fetch a short-lived ephemeral token from the secure Cloud Function.
      // The real API key never touches the browser. The token is constrained to
      // the same Live setup config this client will use below.
      const getToken = httpsCallable<
        { mode: 'diagnostic' | 'tutorial'; systemInstruction: string; voiceName: string; scenarioId?: string; microSkillId?: string },
        { token: string; usage?: UsageStatus; systemInstruction?: string }
      >(functions, 'getGeminiLiveToken');
      const tokenResult = await getToken({ mode, systemInstruction: combinedInstruction, voiceName, scenarioId, microSkillId: microSkillId || null });
      if (tokenResult.data.systemInstruction) combinedInstruction = tokenResult.data.systemInstruction;
      const ephemeralToken = tokenResult.data.token;
      if (tokenResult.data.usage) {
        setUsageStatus(tokenResult.data.usage);
      }

      const ai = new GoogleGenAI({
        apiKey: ephemeralToken,
        httpOptions: { apiVersion: 'v1beta' },
      });

      console.log("LiveSession: Starting Gemini Live session.", {
        mode,
        label: debugLabel || null,
        systemInstructionChars: combinedInstruction.length,
        initialPromptChars: initialPrompt.length,
        initialPromptPreview: initialPrompt.slice(0, 500),
      });

      const sessionPromise = ai.live.connect({
        model: 'gemini-3.8-live',
        callbacks: {
          onopen: () => {
            console.log("LiveSession: Connection opened.");
            statusRef.current = 'active';
            setStatus('active');
            setErrorMessage(null);
            // Gemini Live accepts conversational text through the real-time
            // input channel. Client content is reserved for seeded history.
            sessionPromiseRef.current?.then((session) => {
              try {
                session.sendRealtimeInput({ text: initialPrompt });
              } catch (e) {
                console.warn("Failed to send initial greeting trigger", e);
              }
            });
          },
          onmessage: (msg) => handleServerMessage(msg),
          onclose: (e) => {
            const closeReason = e.reason || '';
            const isUnexpectedClose = e.code !== 1000 && e.code !== 1001;
            const isBillingClose = closeReason.toLowerCase().includes('prepayment') || closeReason.toLowerCase().includes('credits');
            console.log(`LiveSession: Connection closed. Code: ${e.code}. Reason: ${closeReason || 'none'}`);
            if (statusRef.current === 'connecting' || (statusRef.current === 'active' && isUnexpectedClose)) {
              statusRef.current = 'error';
              setErrorType('connection');
              setErrorMessage(
                isBillingClose
                  ? 'Gemini Live is blocked because the API project has no available prepaid credit. Please complete the Gemini API billing/prepayment step in Google AI Studio, then try again.'
                  : `Gemini Live closed unexpectedly. Code: ${e.code || 'unknown'}${closeReason ? `: ${closeReason}` : ''}`
              );
              setStatus('error');
            } else {
              statusRef.current = 'idle';
              setStatus('idle');
            }
            cleanup();
          },
          onerror: (e) => {
            console.error("LiveSession: Connection error.", e);
            statusRef.current = 'error';
            setErrorType('connection');
            setErrorMessage('Connection failed. Please check your microphone and try again.');
            setStatus('error');
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          systemInstruction: combinedInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
      });

      sessionPromiseRef.current = sessionPromise;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (statusRef.current !== 'active') return;
        const inputData = e.inputBuffer.getChannelData(0);
        const downsampled = downsampleTo16k(inputData, ctx.sampleRate);
        const b64Data = base64EncodeAudio(downsampled);
        sessionPromiseRef.current?.then((session) => {
          session.sendRealtimeInput({ audio: { mimeType: "audio/pcm;rate=16000", data: b64Data } });
        }).catch(err => {
          console.warn("LiveSession: Failed to send realtime input", err);
        });
      };

      source.connect(analyser);
      source.connect(processor);
      processor.connect(ctx.destination);
      sourceRef.current = source;
      processorRef.current = processor;

    } catch (error: any) {
      console.error("LiveSession: Error during connection setup", error);
      const details = error?.details as UsageStatus | undefined;
      if (details?.limit) {
        setUsageStatus(details);
        statusRef.current = 'error';
        setErrorType('limit');
        setErrorMessage(`Daily ${mode === 'tutorial' ? 'micro-skill tutorial' : 'scenario'} limit reached. You have used ${Math.min(details.count, details.limit)} of ${details.limit} today.`);
      } else {
        statusRef.current = 'error';
        setErrorType('connection');
        setErrorMessage(error?.message || "Connection failed. Please check your internet and try again.");
      }
      setStatus('error');
      cleanup();
    }
  }, [voiceName, systemInstruction, omitGlobalOS, mode, initialPromptOverride, debugLabel, scenarioId, microSkillId, cleanup]);

  const handleServerMessage = async (message: LiveServerMessage) => {
    const ctx = audioContextRef.current;
    const serverContent = message.serverContent;
    if (!serverContent) return;

    setTranscriptDebug(prev => ({
      ...prev,
      lastServerContentKeys: Object.keys(serverContent),
    }));

    if (serverContent.interrupted) stopAllAudio();

    if (serverContent.inputTranscription) {
      userTranscriptBuffer.current += serverContent.inputTranscription.text || '';
      console.debug("LiveSession: Received input transcription chunk.", serverContent.inputTranscription.text || '');
      setTranscriptDebug(prev => ({
        ...prev,
        inputChunkCount: prev.inputChunkCount + 1,
        inputBuffer: userTranscriptBuffer.current,
      }));
      setStreamingText(userTranscriptBuffer.current);
    }
    if (serverContent.outputTranscription) {
      aiTranscriptBuffer.current += serverContent.outputTranscription.text || '';
      console.debug("LiveSession: Received output transcription chunk.", serverContent.outputTranscription.text || '');
      setTranscriptDebug(prev => ({
        ...prev,
        outputChunkCount: prev.outputChunkCount + 1,
        outputBuffer: aiTranscriptBuffer.current,
      }));
      setStreamingText(aiTranscriptBuffer.current);
    }

    const audioParts = serverContent.modelTurn?.parts?.filter((part) => part.inlineData?.data) || [];
    if (ctx && audioParts.length > 0) {
      if (userTranscriptBuffer.current.trim()) {
        appendTranscript({ speaker: 'user', text: userTranscriptBuffer.current.trim() });
        userTranscriptBuffer.current = '';
        setTranscriptDebug(prev => ({ ...prev, inputBuffer: '' }));
      }
      for (const part of audioParts) {
        const audioData = part.inlineData?.data;
        if (!audioData) continue;
        const bytes = decodeBase64ToBytes(audioData);
        const audioBuffer = pcmToAudioBuffer(bytes, ctx, 24000);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
        source.start(startTime);
        nextStartTimeRef.current = startTime + audioBuffer.duration;
        audioSourcesRef.current.add(source);
        source.onended = () => audioSourcesRef.current.delete(source);
      }
    }

    if (serverContent.turnComplete) {
      flushTranscriptBuffers();
      setTranscriptDebug(prev => ({
        ...prev,
        inputBuffer: userTranscriptBuffer.current,
        outputBuffer: aiTranscriptBuffer.current,
        transcriptCount: transcriptRef.current.length,
      }));
      setStreamingText('');
    }
  };

  useEffect(() => {
    let frame: number;
    const update = () => {
      if (analyserRef.current && status === 'active') {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        setVolume(data.reduce((a, b) => a + b, 0) / data.length);
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [status]);

  // Update the processor to check status before sending
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = (e) => {
        if (statusRef.current !== 'active') return; // STOP the spam

        const inputData = e.inputBuffer.getChannelData(0);
        const downsampled = downsampleTo16k(inputData, audioContextRef.current?.sampleRate || 24000);
        const b64Data = base64EncodeAudio(downsampled);
        
        sessionPromiseRef.current?.then((session) => {
          try {
            session.sendRealtimeInput({ audio: { mimeType: "audio/pcm;rate=16000", data: b64Data } });
          } catch (e) {
            console.warn("LiveSession: Failed to send realtime input", e);
          }
        }).catch(err => {
          console.warn("LiveSession: Failed to resolve session promise", err);
        });
      };
    }
  }, [status]);

  return { status, errorMessage, errorType, connect, disconnect, volume, streamingText, transcript: transcriptRef.current, usageStatus, transcriptDebug };
};
