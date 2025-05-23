// ─────────────────────────── src/agent.ts ───────────────────────────
import { pipeline, llm, initializeLogger } from '@livekit/agents';
import { Room, Participant }               from '@livekit/rtc-node';

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
const LIVEKIT_URL = process.env.LIVEKIT_URL!; // non-nullable

// ─── init logger once ───────────────────────────────────────────────
initializeLogger({ pretty: false, level: 'info' });

// ─── main entry, called by server.ts ────────────────────────────────
async function entry(config: {
  room_name      : string;
  agent_name     : string;
  join_token     : string;
  admin_token   ?: string;
  initial_prompt?: string;
  user_metadata ?: Record<string, unknown>;
}) {
  console.log('AGENT ENTRY STARTED', config);

  // status for /agent-status
  (global as any).AGENT_JOIN_STATUS = {
    joined   : false,
    roomName : config.room_name,
    agentName: config.agent_name,
    status   : 'waiting',
  };

  try {
    // 1. load models / plugins
    const vad      = await silero.VAD.load();
    const stt      = new deepgram.STT();
    const tts      = new elevenlabs.TTS();
    const llmModel = new openai.LLM();

    // 2. chat context
    const chatCtx = new llm.ChatContext().append({
      role: llm.ChatRole.SYSTEM,
      text:
        config.initial_prompt ??
        'You are a LiveKit voice assistant. Speak clearly and concisely.',
    });

    // 3. build the VoicePipelineAgent
    const agent = new pipeline.VoicePipelineAgent(
      vad,
      stt,
      llmModel,
      tts,
      { chatCtx },
    );

    // 4. connect Room and start
    const room = new Room();
    await room.connect(LIVEKIT_URL, config.join_token);
    await agent.start(room);

    // ────────────────────────────────────────────────────────────
// AUTO-DISCONNECT IF ALONE FOR 60 s
// ────────────────────────────────────────────────────────────
let aloneTimer: NodeJS.Timeout | null = null;
const TIMEOUT_MS = 60_000;           // 60 seconds
let remoteCount = 0;                 // participants other than the agent

const maybeStartOrStopTimer = () => {
  if (remoteCount === 0) {
    if (!aloneTimer) {
      aloneTimer = setTimeout(async () => {
        console.log(
          `[timeout] Agent alone for ${TIMEOUT_MS / 1_000}s – disconnecting`,
        );
        try {
          await room.disconnect();
        } finally {
          process.exit(0);          // end container & free resources
        }
      }, TIMEOUT_MS);
    }
  } else if (aloneTimer) {
    clearTimeout(aloneTimer);
    aloneTimer = null;
  }
};

// initial check right after the agent joins
maybeStartOrStopTimer();

// update the counter whenever someone joins / leaves
room.on('participantConnected',   () => { remoteCount++; maybeStartOrStopTimer(); });
room.on('participantDisconnected',() => { remoteCount--; maybeStartOrStopTimer(); });

    // 5. success
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
