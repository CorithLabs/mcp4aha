import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { configRouter } from './api/config.js';
import { tokenRouter } from './api/token.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORTAL_PORT = parseInt(process.env.PORTAL_PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.options('*', cors());

// API routes
app.use('/api/config', configRouter);
app.use('/api/token', tokenRouter);

// Serve React SPA static files (built by Vite to portal/dist)
const distPath = path.resolve(__dirname, '../../portal/dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start portal server
const server = app.listen(PORTAL_PORT, HOST, () => {
  console.error(`🌐 Portal server running at http://${HOST}:${PORTAL_PORT}`);
});

export { app, server };
