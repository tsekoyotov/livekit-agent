// index.js  – minimal "token-from-n8n" version
require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

app.post('/call', (req, res) => {
  const {
    room_name,
    agent_name,
    join_token,    // ← MUST come from n8n
    admin_token,   // ← optional, if you need extra grants
    initial_prompt,
    user_metadata = {}
  } = req.body;

  // quick sanity-check
  if (!room_name || !agent_name || !join_token) {
    return res.status(400).json({
      error: 'room_name, agent_name, and join_token are required'
    });
  }

  // log for Railway-logs debugging
  console.log('CONFIG FROM N8N →', {
    room_name,
    agent_name,
    has_join_token:  !!join_token,
    has_admin_token: !!admin_token,
    initial_prompt,
    user_metadata
  });

  /* ------------------------------------------------------------------
     TODO: start your STT / TTS / LLM pipeline here, passing:
           • join_token / admin_token
           • initial_prompt
           • user_metadata
  ------------------------------------------------------------------ */

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

// bind to Railway-provided PORT in prod, 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ livekit-agent listening on ${PORT}`)
);
