import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

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

app.post('/call', (req: Request, res: Response) => {
  const {
    room_name,
    agent_name,
    join_token,
    admin_token,
    initial_prompt,
    user_metadata = {}
  } = req.body as CallRequestBody;

  // Validate required fields
  if (!room_name || !agent_name || !join_token) {
    return res.status(400).json({
      error: 'room_name, agent_name, and join_token are required'
    });
  }

  // Log all received fields for debugging
  console.log('CONFIG FROM N8N →', {
    room_name,
    agent_name,
    has_join_token: !!join_token,
    has_admin_token: !!admin_token,
    initial_prompt,
    user_metadata
  });

  // TODO: start agent/streaming pipeline here with all provided values

  res.json({
    status: 'Agent accepted',
    received: {
      room_name,
      agent_name,
      has_join_token: true,
      has_admin_token: !!admin_token
    }
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`/call endpoint listening on port ${PORT}`);
}); 