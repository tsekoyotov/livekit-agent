import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// REMOVE agent and cli imports, not used here
// import agent from './agent.js';
// import { cli } from '@livekit/agents';

import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

// Supabase init
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(express.json());

interface CallRequestBody {
  room_name: string;
  agent_name: string;
  join_token: string;
  admin_token?: string;
  initial_prompt?: string;
  user_metadata?: Record<string, unknown>;
}

app.post('/call', async (req: Request, res: Response) => {
  const {
    room_name,
    agent_name,
    join_token,
    admin_token,
    initial_prompt,
    user_metadata = {}
  } = req.body as CallRequestBody;

  if (!room_name || !agent_name || !join_token) {
    return res.status(400).json({
      error: 'room_name, agent_name, and join_token are required'
    });
  }

  console.log('CONFIG FROM N8N →', {
    room_name,
    agent_name,
    has_join_token: !!join_token,
    has_admin_token: !!admin_token,
    initial_prompt,
    user_metadata
  });

  // Insert job in Supabase
  const { data, error } = await supabase
    .from('jobs')
    .insert([
      {
        room_name,
        agent_name,
        join_token,
        admin_token,
        initial_prompt,
        user_metadata,
        status: 'pending'
      }
    ])
    .select(); // Returns the inserted row

  if (error) {
    console.error('Failed to insert job:', error);
    return res.status(500).json({ error: 'Failed to insert job', details: error.message });
  }

  res.json({
    status: 'Job accepted',
    job_id: data?.[0]?.id
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`/call endpoint listening on port ${PORT}`);
});
