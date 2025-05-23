import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// === MAIN CALL ENDPOINT ===
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

  console.log('CALL RECEIVED: Inserting job with config:', {
    room_name,
    agent_name,
    has_join_token: !!join_token,
    has_admin_token: !!admin_token,
    initial_prompt,
    user_metadata
  });

  // Insert job in Supabase
  try {
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

    console.log('Job inserted successfully:', data?.[0]?.id);
    res.json({
      status: 'Job accepted',
      job_id: data?.[0]?.id
    });
  } catch (err) {
    console.error('Unexpected error inserting job:', err);
    res.status(500).json({ error: 'Unexpected error', details: String(err) });
  }
});

// === AGENT STATUS ENDPOINT ===
app.get('/agent-status', (req: Request, res: Response) => {
  // This returns whatever (global as any).AGENT_JOIN_STATUS was set to by agent.ts
  res.json(
    (global as any).AGENT_JOIN_STATUS || {
      joined: false,
      roomName: null,
      agentName: null,
      status: 'unknown'
    }
  );
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`/call endpoint listening on port ${PORT}`);
  console.log(`/agent-status endpoint available on port ${PORT}`);
});
