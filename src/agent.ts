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

  // Set initial status to not joined
  (global as any).AGENT_JOIN_STATUS = {
    joined: false,
    roomName: config.room_name,
    agentName: config.agent_name,
    status: 'waiting',
  };

  try {
    // Example of a real agent connect
    // You'd use actual LiveKit SDK logic here; let's simulate it:
    // For real use: let ctx = ...; await ctx.connect();

    // Simulate LiveKit connection
    // REMOVE THIS LINE and replace with actual connect logic:
    await new Promise(res => setTimeout(res, 3000)); // Simulate "connecting..."

    // After successful connection only, set joined:true!
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

// Export "entry" so server.ts can import and call it
export default { entry };
