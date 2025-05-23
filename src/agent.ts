// src/agent.ts ───────────────────────────────────────────────
import { pipeline, llm } from '@livekit/agents';

import * as deepgram   from '@livekit/agents-plugin-deepgram';
import * as silero     from '@livekit/agents-plugin-silero';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as openai     from '@livekit/agents-plugin-openai';

import dotenv from 'dotenv';
import path   from 'node:path';
import { fileURLToPath } from 'node:url';

// load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// ────────────────────────────────────────────────────────────
async function entry(config: {
  room_name      : string;
  agent_name     : string;
  join_token     : string;
  admin_token   ?: string;
  initial_prompt?: string;
  user_metadata ?: Record<string, unknown>;
}) {

  console.log('AGENT ENTRY STARTED');
  console.log('CONFIG:', config);

  // status for /agent-status endpoint
  (global as any).AGENT_JOIN_STATUS = {
    joined    : false,
    roomName  : config.room_name,
    agentName : config.agent_name,
    status    : 'waiting',
  };

  try {
    // 1. load plugins / models
    const vad      = await silero.VAD.load();
    const stt      = new deepgram.STT();
    const tts      = new elevenlabs.TTS();
    const llmModel = new openai.LLM();

    // 2. system chat prompt
    const chatCtx = new llm.ChatContext().append({
      role : llm.ChatRole.SYSTEM,
      text : config.initial_prompt ??
             'You are a LiveKit voice assistant. Speak clearly and concisely.',
    });

    // 3. build voice pipeline agent
    const agent = new pipeline.VoicePipelineAgent(
      vad,
      stt,
      llmModel,
      tts,
      {
        chatCtx,
        joinOptions: {
          roomName       : config.room_name,
          participantName: config.agent_name,
          joinToken      : config.join_token,
          adminToken     : config.admin_token,
          metadata       : config.user_metadata,
        },
      },
    );

    // 4. just start()  → SDK reads joinOptions internally
    await agent.start();      //  ← NO ARGUMENTS ‼

    // joined ok
    (global as any).AGENT_JOIN_STATUS = {
      joined    : true,
      roomName  : config.room_name,
      agentName : config.agent_name,
      status    : 'joined',
    };
    console.log('AGENT is now in the room! (joined: true)');
    return { status: 'success' };

  } catch (err) {
    // error status
    (global as any).AGENT_JOIN_STATUS = {
      joined    : false,
      roomName  : config.room_name,
      agentName : config.agent_name,
      status    : 'error',
    };
    console.error('AGENT failed to join room:', err);
    throw err;
  }
}

export default { entry };
