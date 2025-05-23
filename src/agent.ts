import {
  type JobContext,
  defineAgent,
  llm,
  pipeline,
} from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

// This function acts like the "entry" for every call
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

  // Here, you would create a context similar to LiveKit's agent worker
  // For demo, we just log and simulate work
  try {
    // For real agent logic, use actual LiveKit SDK context
    // This is placeholder logic!
    // Example: connect to room, wait for participant, interact...

    // Set status (global for /agent-status)
    (global as any).AGENT_JOIN_STATUS = {
      joined: false,
      roomName: config.room_name,
      agentName: config.agent_name,
      status: 'waiting',
    };

    // Simulate agent doing work
    await new Promise(res => setTimeout(res, 3000)); // Fake delay

    // Set status to joined
    (global as any).AGENT_JOIN_STATUS = {
      joined: true,
      roomName: config.room_name,
      agentName: config.agent_name,
      status: 'joined',
    };

    console.log('AGENT finished successfully');
    return { status: 'success' };
  } catch (err) {
    (global as any).AGENT_JOIN_STATUS = {
      joined: false,
      roomName: config.room_name,
      agentName: config.agent_name,
      status: 'error',
    };
    console.error('AGENT failed:', err);
    throw err;
  }
}

// Export "entry" so server.ts can import and call it
export default { entry };
