require('dotenv').config();
const express = require('express');
const { AccessToken } = require("livekit-server-sdk");

const app = express();
app.use(express.json());

app.post('/call', (req, res) => {
  const { room_name, agent_name, initial_prompt, user_metadata } = req.body;

  // Validate required fields
  if (!room_name || !agent_name || !initial_prompt || !user_metadata) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Log the received configuration
  console.log('Received configuration:', {
    room_name,
    agent_name,
    initial_prompt,
    user_metadata
  });

  try {
    // Create access token
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: agent_name,
        name: agent_name
      }
    );

    // Add permissions to the token
    at.addGrant({
      roomJoin: true,
      room: room_name,
      canPublish: true,
      canSubscribe: true
    });

    // Generate the token
    const token = at.toJwt();

    // Send response
    res.json({
      status: "Agent dispatched",
      token
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
