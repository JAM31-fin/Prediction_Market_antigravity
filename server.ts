import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { handleApiRequest } from './src/server/apiRouter';
import { logger } from './src/server/logger';
import { runMigrations } from './src/server/migrate';
import { checkDatabaseHealth } from './src/server/db';

async function startServer() {
  logger.info('Server', 'Initializing Centra Markets application...');

  // Run PostgreSQL / Supabase Schema migrations and data import before starting listeners
  try {
    logger.info('Server', 'Executing database migrations and integrity checks...');
    await runMigrations();
    const health = await checkDatabaseHealth();
    logger.info('Server', `Database initialized successfully (${health.type})`, {
      connected: health.connected,
      type: health.type,
      urlConfigured: health.urlConfigured,
    });
  } catch (err: any) {
    logger.error('Server', 'Failed to run database migrations', err);
    // Even if initial migration has an error, do not crash the container so health endpoint can report diagnostics
  }

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Intercept all API routes first before Vite or static asset serving
  app.use(async (req, res, next) => {
    const url = req.url || '';
    if (!url.startsWith('/api/')) {
      return next();
    }
    try {
      const handled = await handleApiRequest(req as any, res);
      if (!handled) {
        next();
      }
    } catch (err) {
      logger.error('Server', 'Unhandled API exception', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        const errMessage = process.env.NODE_ENV === 'production'
          ? 'An unexpected server error occurred.'
          : (err as any)?.message || 'Internal server error';
        res.end(JSON.stringify({ success: false, error: errMessage }));
      }
    }
  });

  // Vite middleware in development vs static file serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
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
    logger.info('Server', `Centra Markets server listening on port ${PORT}`, {
      env: process.env.NODE_ENV || 'development',
      port: PORT,
    });
  });
}

startServer();
