// ─────────────────────────── src/agent.ts ───────────────────────────
import { pipeline, llm, initializeLogger } from '@livekit/agents';
import { Room }                           from '@livekit/rtc-node';

import * as deepgram   from '@livekit/agents-plugin-deepgram';
import * as silero     from '@livekit/agents-plugin-silero';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as openai     from '@livekit/agents-plugin-openai';

import dotenv from 'dotenv';
import path   from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── env ─────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

if (!process.env.LIVEKIT_URL) {
  throw new Error('LIVEKIT_URL is missing in environment');
}
const LIVEKIT_URL = process.env.LIVEKIT_URL!;

// ─── logger ──────────────────────────────────────────────────────────
initializeLogger({ pretty: false, level: 'info' });

/*─────────────── one-time model singletons per container ────────────*/
let vadSingleton:  silero.VAD     | null = null;
let sttSingleton:  deepgram.STT   | null = null;
let ttsSingleton:  elevenlabs.TTS | null = null;
let llmSingleton:  openai.LLM     | null = null;
/*─────────────────────────────────────────────────────────────────────*/

export async function entry(config: {
  room_name      : string;
  agent_name     : string;
  join_token     : string;
  admin_token   ?: string;
  initial_prompt?: string;
  user_metadata ?: Record<string, unknown>;
}) {
  console.log('AGENT ENTRY STARTED', config);

  (global as any).AGENT_JOIN_STATUS = {
    joined   : false,
    roomName : config.room_name,
    agentName: config.agent_name,
    status   : 'waiting',
  };

  try {
    /* 1 ─ load (or reuse) models */
    if (!vadSingleton)  vadSingleton  = await silero.VAD.load();
    if (!sttSingleton)  sttSingleton  = new deepgram.STT();
    if (!ttsSingleton)  ttsSingleton  = new elevenlabs.TTS();
    if (!llmSingleton)  llmSingleton  = new openai.LLM();

    /* 2 ─ chat context */
    const chatCtx = new llm.ChatContext().append({
      role: llm.ChatRole.SYSTEM,
      text:
        config.initial_prompt ??
        'You are a LiveKit voice assistant. Speak clearly and concisely.',
    });

    /* 3 ─ build agent */
    const agent = new pipeline.VoicePipelineAgent(
      vadSingleton,
      sttSingleton,
      llmSingleton,
      ttsSingleton,
      { chatCtx },
    );

    /* 4 ─ connect & start */
    const room = new Room();
    await room.connect(LIVEKIT_URL, config.join_token);
    await agent.start(room);

    /* ── lonely-timer (60 s) ─────────────────────────────────────── */
    const TIMEOUT_MS = 60_000;
    let aloneTimer: NodeJS.Timeout | null = null;
    let remoteCount = 0;

    const updateTimer = () => {
      if (remoteCount === 0) {
        if (!aloneTimer) {
          aloneTimer = setTimeout(async () => {
            console.log(`[timeout] Agent alone ${TIMEOUT_MS / 1000}s → disconnect`);
            try {
              await agent.stop();
              await room.disconnect();
            } finally {
              // clear state so the same container can accept a new /call
              remoteCount = 0;
              aloneTimer  = null;
              (global as any).AGENT_JOIN_STATUS.status = 'idle';
            }
          }, TIMEOUT_MS);
        }
      } else if (aloneTimer) {
        clearTimeout(aloneTimer);
        aloneTimer = null;
      }
    };

    updateTimer();
    room.on('participantConnected',   () => { remoteCount++; updateTimer(); });
    room.on('participantDisconnected',() => { remoteCount--; updateTimer(); });

    /* 5 ─ success */
    (global as any).AGENT_JOIN_STATUS = {
      joined   : true,
      roomName : config.room_name,
      agentName: config.agent_name,
      status   : 'joined',
    };
    console.log('AGENT joined LiveKit room successfully');
    return { status: 'success' };

  } catch (err) {
    (global as any).AGENT_JOIN_STATUS = {
      joined   : false,
      roomName : config.room_name,
      agentName: config.agent_name,
      status   : 'error',
    };
    console.error('AGENT failed:', err);
    throw err;
  }
}

export default { entry };
