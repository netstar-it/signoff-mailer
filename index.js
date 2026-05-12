const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.post('/send', async (req, res) => {
  const { to, toName, subject, htmlContent, textContent } = req.body;

  if (!to || !subject) {
    return res.status(400).json({ error: 'Missing required fields: to, subject' });
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: process.env.FROM_NAME || 'IT Department',
          email: process.env.FROM_EMAIL
        },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent,
        textContent
      })
    });

    const data = await response.json();

    if (response.ok) {
      return res.json({ success: true, messageId: data.messageId });
    } else {
      return res.status(response.status).json({ error: data.message || 'Brevo error' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'Sign-off mailer running' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
