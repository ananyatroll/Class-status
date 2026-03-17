import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  // API Routes
  app.post('/api/send-otp', async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    if (!resend) {
      console.warn('RESEND_API_KEY is not set. OTP will only be logged to console.');
      console.log(`[DEV] OTP for ${email}: ${otp}`);
      return res.json({ 
        success: true, 
        message: 'OTP logged to console (RESEND_API_KEY missing)',
        demo: true 
      });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'Class Status <onboarding@resend.dev>',
        to: [email],
        subject: 'Your Verification Code - Class Status Tracker',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 16px;">
            <h2 style="color: #1a1a1a; margin-bottom: 16px;">Verify your email</h2>
            <p style="color: #666; font-size: 16px; line-height: 24px;">
              Use the following code to complete your sign-in to Class Status Tracker:
            </p>
            <div style="background-color: #f5f5f5; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
              <span style="font-family: monospace; font-size: 32px; font-bold; letter-spacing: 8px; color: #000;">${otp}</span>
            </div>
            <p style="color: #999; font-size: 12px;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend error:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json({ success: true, data });
    } catch (err: any) {
      console.error('Failed to send email:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
