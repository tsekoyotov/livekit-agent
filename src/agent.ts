// src/agent.ts ───────────────────────────────────────────────
import { pipeline, llm } from '@livekit/agents';
import { Room }          from '@livekit/rtc-node';

import * as deepgram    from '@livekit/agents-plugin-deepgram';
import * as silero      from '@livekit/agents-plugin-silero';
import * as elevenlabs  from '@livekit/agents-plugin-elevenlabs';
import * as openai      from '@livekit/agents-plugin-openai';

import dotenv from 'dotenv';
import path   from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// LIVEKIT_URL must be set in your env / Railway variables!
const LIVEKIT_URL = process.env.LIVEKIT_URL!;

async function entry(config: {
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
    // 1. plugins / models
    const vad      = await silero.VAD.load();
    const stt      = new deepgram.STT();
    const tts      = new elevenlabs.TTS();
    const llmModel = new openai.LLM();

    // 2. system prompt
    const chatCtx = new llm.ChatContext().append({
      role: llm.ChatRole.SYSTEM,
      text: config.initial_prompt ??
            'You are a LiveKit voice assistant. Speak clearly and concisely.',
    });

    // 3. build agent
    const agent = new pipeline.VoicePipelineAgent(
      vad,
      stt,
      llmModel,
      tts,
      { chatCtx },
    );

    // 4. create and connect the Room (constructor NO args)
    const room = new Room();
    await room.connect(LIVEKIT_URL, config.join_token);

    // 5. start voice agent in that room
    await agent.start(room);

    // success
    (global as any).AGENT_JOIN_STATUS = {
      joined   : true,
      roomName : config.room_name,
      agentName: config.agent_name,
      status   : 'joined',
    };
    console.log('AGENT joined room successfully');
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
