import 'dotenv/config';
import express from 'express';
import { dbManager } from '../server/db.ts';
import { isSupabaseConnected } from '../server/supabase.ts';
import { authMiddleware } from '../server/auth.ts';
import { apiRouter } from '../server/api.ts';

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Vercel Production: Connect Supabase as primary cloud storage system
app.use(async (req, res, next) => {
  if (isSupabaseConnected()) {
    try {
      await dbManager.ensureSupabaseLoaded();
    } catch (err) {
      console.warn('[Vercel Supabase Loader Warn]:', err);
    }
  }

  // Intercept res.json to flush state to Supabase before Lambda execution environment freezes
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (isSupabaseConnected() && dbManager.isDirty()) {
      dbManager
        .flushToSupabase()
        .catch((err) => console.error('[Vercel Supabase Flush Error]:', err))
        .finally(() => {
          originalJson(body);
        });
      return res;
    }
    return originalJson(body);
  };

  next();
});

// Attach auth context to every request
app.use(authMiddleware);

// Handle routes both with and without /api prefix for Vercel Serverless Function rewrites
app.use('/api', apiRouter);
app.use(apiRouter);

export default app;

