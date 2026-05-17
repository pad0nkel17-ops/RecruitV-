import express from 'express';
import axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const router = express.Router();

// Simple in-memory cache for Jotform requests
const jotformCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache

const getCached = (key: string) => {
  const entry = jotformCache.get(key);
  if (entry && (Date.now() - entry.timestamp) < CACHE_TTL) return entry.data;
  return null;
};

const setCached = (key: string, data: any) => {
  jotformCache.set(key, { data, timestamp: Date.now() });
};

// Jotform Proxy Routes (Local Dev Only - Vercel use api/*.ts)
router.get('/jotform-forms', async (req, res) => {
  try {
    const apiKey = req.headers['x-jotform-api-key']?.toString() || process.env.JOTFORM_API_KEY;
    if (!apiKey) return res.json({ content: [] });
    
    const cacheKey = `forms_${apiKey}`;
    const cached = getCached(cacheKey);
    if (cached && !req.query.t) return res.json(cached);

    let response;
    try {
      response = await axios.get('https://eu-api.jotform.com/user/forms', { params: { apiKey, limit: 100 } });
    } catch (e) {
      response = await axios.get('https://api.jotform.com/user/forms', { params: { apiKey, limit: 100 } });
    }
    setCached(cacheKey, response.data);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

router.get('/jotform-submissions', async (req, res) => {
  try {
    const { formId, filter, offset, limit, t } = req.query;
    const apiKey = req.headers['x-jotform-api-key']?.toString() || process.env.JOTFORM_API_KEY;
    if (!formId || !apiKey) return res.status(400).json({ error: 'Data missing' });
    
    const cacheKey = `subs_${formId}_${offset}_${limit}_${apiKey}`;
    const cached = getCached(cacheKey);
    if (cached && !t) return res.json(cached);

    const params: any = { apiKey, limit: limit || 2000 };
    if (filter) params.filter = filter;
    if (offset) params.offset = offset;

    let response;
    try {
      response = await axios.get(`https://eu-api.jotform.com/form/${formId}/submissions`, { params });
    } catch (e) {
      response = await axios.get(`https://api.jotform.com/form/${formId}/submissions`, { params });
    }
    setCached(cacheKey, response.data);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

router.get('/jotform-questions', async (req, res) => {
  try {
    const { formId } = req.query;
    const apiKey = req.headers['x-jotform-api-key']?.toString() || process.env.JOTFORM_API_KEY;
    if (!formId || !apiKey) return res.status(400).json({ error: 'Data missing' });
    
    let response;
    try {
      response = await axios.get(`https://eu-api.jotform.com/form/${formId}/questions`, { 
        params: { apiKey } 
      });
    } catch (e) {
      response = await axios.get(`https://api.jotform.com/form/${formId}/questions`, { 
        params: { apiKey } 
      });
    }
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

app.use(express.json());
app.use('/api', router);

const startServer = async () => {
  // Vite middleware for local development
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer } = await import('vite');
    const vite = await createServer({ 
      server: { middlewareMode: true }, 
      appType: 'spa' 
    });
    app.use(vite.middlewares);
    
    app.listen(3000, '0.0.0.0', () => {
      console.log('Dev server running on http://localhost:3000');
    });
  } else {
    // Production serving for local tests (Vercel uses its own deployment layer)
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
    
    if (!process.env.VERCEL) {
      app.listen(3000, '0.0.0.0', () => {
        console.log('Production preview running on http://localhost:3000');
      });
    }
  }
};

startServer();

export { app };
