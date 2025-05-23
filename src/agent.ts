import {
  pipeline,
  llm,
} from '@livekit/agents';
import { Room } from '@livekit/rtc-node';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

async function entry(config: {
  room_name: string;
  agent_name: string;
  join_token: string;
  admin_token?: string;
  initial_prompt?: string;
  user_metadata?: Record<string, unknown>;
}) {
  console.log('AGENT ENTRY STARTED');
  console.log('CONFIG:', config);

  // Set default status
  (global as any).AGENT_JOIN_STATUS = {
    joined: false,
    roomName: config.room_name,
    agentName: config.agent_name,
    status: 'waiting',
  };

  try {
    // Load pipeline modules
    const vad = await silero.VAD.load();
    const stt = new deepgram.STT();
    const tts = new elevenlabs.TTS();
    const llmModel = new openai.LLM();
    const initialContext = new llm.ChatContext().append({
      role: llm.ChatRole.SYSTEM,
      text:
        'You are a voice assistant created by LiveKit. Your interface with users will be voice. ' +
        'You should use short and concise responses, and avoid usage of unpronounceable punctuation.',
    });

    // 1. Create and connect Room
    const serverUrl = process.env.LIVEKIT_WS_URL!;
    const token = config.join_token;
    const room = new Room();
    await room.connect(serverUrl, token);

    // 2. Create agent and start it
    const agent = new pipeline.VoicePipelineAgent(
      vad,
      stt,
      llmModel,
      tts,
      { chatCtx: initialContext }
    );
    agent.start(room);

    // Mark as joined
    (global as any).AGENT_JOIN_STATUS = {
      joined: true,
      roomName: config.room_name,
      agentName: config.agent_name,
      status: 'joined',
    };

    console.log('AGENT is now in the room! (joined: true)');

    return { status: 'success' };
  } catch (err) {
    (global as any).AGENT_JOIN_STATUS = {
      joined: false,
      roomName: config.room_name,
      agentName: config.agent_name,
      status: 'error',
    };
    console.error('AGENT failed to join room:', err);
    throw err;
  }
}

export default { entry };
