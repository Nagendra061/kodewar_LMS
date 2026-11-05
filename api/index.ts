import 'dotenv/config';
import express from 'express';
import { authMiddleware } from '../server/auth.ts';
import { apiRouter } from '../server/api.ts';

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Attach auth context to every request
app.use(authMiddleware);

// Handle routes both with and without /api prefix for Vercel Serverless Function rewrites
app.use('/api', apiRouter);
app.use(apiRouter);

export default app;

