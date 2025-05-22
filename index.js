require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

// ───────────────────────────────────────────────────────────────
//  POST  /call   –  n8n sends join/admin tokens + prompt + meta
// ───────────────────────────────────────────────────────────────
app.post('/call', (req, res) => {
  const {
    room_name,
    agent_name,
    join_token,      //  ✅ required – pre-signed JWT from n8n
    admin_token,     //  🔒 optional – for room admin actions
    initial_prompt,
    user_metadata = {}
  } = req.body;

  // 1️⃣  basic validation – fail fast if the join_token is missing
  if (!room_name || !agent_name || !join_token) {
    return res.status(400).json({ error: 'room_name, agent_name, and join_token are required' });
  }

  // 2️⃣  log the full config for observability (handy in Railway logs)
  console.log('Received from n8n →', {
    room_name,
    agent_name,
    has_join_token:  !!join_token,
    has_admin_token: !!admin_token,
    initial_prompt,
    user_metadata
  }); /* good practice for debugging :contentReference[oaicite:0]{index=0} */

  // 3️⃣  👉 TODO: launch your STT / TTS / LLM pipeline here,
  //               passing the tokens & prompt to whatever worker
  //               you’ll run (node-worker, python, etc.)

  // 4️⃣  send an acknowledgement back to n8n
  res.json({
    status: 'Agent accepted',
    received: {
      room_name,
      agent_name,
      has_join_token:  true,
      has_admin_token: !!admin_token
    }
  });
});

// Always listen on Railway-provided PORT (falls back to 3000 locally)
const PORT = process.env.PORT || 3000;              // Railway injects PORT :contentReference[oaicite:1]{index=1}
app.listen(PORT, () => console.log(`✅ Agent server listening on ${PORT}`));
