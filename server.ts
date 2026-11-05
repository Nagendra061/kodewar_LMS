import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from './server/auth.ts';
import { apiRouter } from './server/api.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Attach auth context to every request
  app.use(authMiddleware);

  // Mount API router
  app.use('/api', apiRouter);

  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // In dev mode, mount Vite middleware as required by AI Studio guidelines
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Kodewar LMS] Server running on port ${PORT} (isProduction: ${isProduction})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
