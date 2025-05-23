import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import agent from './agent.js'; // Use .js for ESM, .ts for TS-node

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
    user_metadata = {},
  } = req.body as CallRequestBody;

  if (!room_name || !agent_name || !join_token) {
    return res.status(400).json({
      error: 'room_name, agent_name, and join_token are required',
    });
  }

  console.log('CALL RECEIVED → Starting agent:', {
    room_name,
    agent_name,
    has_join_token: !!join_token,
    has_admin_token: !!admin_token,
    initial_prompt,
    user_metadata,
  });

  try {
    // Call the agent entry directly!
    const result = await agent.entry({
      room_name,
      agent_name,
      join_token,
      admin_token,
      initial_prompt,
      user_metadata,
    });

    // Log result to Supabase
    await supabase.from('agent_logs').insert([
      {
        room_name,
        agent_name,
        user_metadata,
        result_status: result?.status || 'success',
        log_time: new Date().toISOString(),
      },
    ]);

    res.json({ status: 'Agent completed', result });
  } catch (err: any) {
    console.error('Agent error:', err);
    // Log error to Supabase
    await supabase.from('jobs').insert([
      {
        room_name,
        agent_name,
        user_metadata,
        status: 'error',
        error_message: err.message || String(err),
        created_at: new Date().toISOString(),
      },
    ]);
    res.status(500).json({ error: 'Agent failed', details: err.message || String(err) });
  }
});

app.get('/agent-status', (req: Request, res: Response) => {
  res.json(
    (global as any).AGENT_JOIN_STATUS || {
      joined: false,
      roomName: null,
      agentName: null,
      status: 'unknown',
    }
  );
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`/call endpoint listening on port ${PORT}`);
  console.log(`/agent-status endpoint available on port ${PORT}`);
});
