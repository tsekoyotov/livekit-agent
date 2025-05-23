// SPDX-FileCopyrightText: 2024 LiveKit, Inc.
//
// SPDX-License-Identifier: Apache-2.0
import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
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

// Supabase SDK
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

// Supabase init (if you need it in the agent itself for logging, etc.)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ----------- AGENT DEFINITION ------------

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    // All config comes from env vars (set per-process)
    const roomName = process.env.AGENT_ROOM_NAME!;
    const agentName = process.env.AGENT_AGENT_NAME!;
    const joinToken = process.env.AGENT_JOIN_TOKEN!;
    const adminToken = process.env.AGENT_ADMIN_TOKEN || '';
    const initialPrompt = process.env.AGENT_INITIAL_PROMPT || '';
    let userMetadata = {};
    if (process.env.AGENT_USER_METADATA) {
      try {
        userMetadata = JSON.parse(process.env.AGENT_USER_METADATA);
      } catch (e) {
        userMetadata = {};
      }
    }

    const vad = ctx.proc.userData.vad! as silero.VAD;
    const initialContext = new llm.ChatContext().append({
      role: llm.ChatRole.SYSTEM,
      text:
        'You are a voice assistant created by LiveKit. Your interface with users will be voice. ' +
        'You should use short and concise responses, and avoid usage of unpronounceable ' +
        'punctuation.',
    });

    await ctx.connect();
    console.log('waiting for participant');
    const participant = await ctx.waitForParticipant();
    console.log(`starting assistant agent for ${participant.identity}`);

    // EXAMPLE: You can log to Supabase if you want!
    // await supabase.from('calls').insert([
    //   { agent: agentName, participant: participant.identity, started_at: new Date().toISOString() }
    // ]);

    const fncCtx: llm.FunctionContext = {
      weather: {
        description: 'Get the weather in a location',
        parameters: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => {
          console.debug(`executing weather function for ${location}`);
          const response = await fetch(`https://wttr.in/${location}?format=%C+%t`);
          if (!response.ok) {
            throw new Error(`Weather API returned status: ${response.status}`);
          }
          const weather = await response.text();
          return `The weather in ${location} right now is ${weather}.`;
        },
      },
    };

    const agent = new pipeline.VoicePipelineAgent(
      vad,
      new deepgram.STT(),
      new openai.LLM(),
      new elevenlabs.TTS(),
      { chatCtx: initialContext, fncCtx },
    );
    agent.start(ctx.room, participant);

    await agent.say('Hey, how can I help you today', true);
  },
});

// ----------- SUPABASE JOB POLLER (MAIN PROCESS) ------------

// This function will ONLY run in the main process, not in the worker/agent child process
async function pollJobs() {
  while (true) {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .limit(1);

    if (error) {
      console.error('Supabase error:', error);
    }

    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      try {
        // Pass each value as an ENV variable to the agent process
        const env: Record<string, string> = {
          ...process.env, // inherit all existing env vars!
          AGENT_ROOM_NAME: job.room_name || '',
          AGENT_AGENT_NAME: job.agent_name || '',
          AGENT_JOIN_TOKEN: job.join_token || '',
          AGENT_ADMIN_TOKEN: job.admin_token || '',
          AGENT_INITIAL_PROMPT: job.initial_prompt || '',
          AGENT_USER_METADATA: job.user_metadata ? JSON.stringify(job.user_metadata) : '{}',
        };

        // Launch the agent worker as a new process with per-job config
        cli.runApp(
          new WorkerOptions({
            agent: fileURLToPath(import.meta.url),
          })
        );        
        // Mark job as completed
        await supabase
          .from('jobs')
          .update({ status: 'completed' })
          .eq('id', job.id);
        console.log(`Processed job: ${job.id}`);
      } catch (err) {
        console.error('Error running agent for job', job.id, err);
      }
    }

    await new Promise((res) => setTimeout(res, 2000)); // Wait 2s before polling again
  }
}

// Only start polling in the main process
if (!process.env.AGENT_ROOM_NAME) {
  pollJobs();
}
