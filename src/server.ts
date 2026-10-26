import express, { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AuthenticatedRequest extends Request {
  apiKeyData?: {
    id: string;
    user_id: string;
    credits_remaining: number;
  };
}

async function authenticateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, credits_remaining, is_active')
    .eq('key_hash', apiKey)
    .single();

  if (error || !data || !data.is_active) {
    res.status(403).json({ error: 'Invalid or inactive API Key' });
    return;
  }

  if (data.credits_remaining <= 0) {
    res.status(402).json({ error: 'Insufficient credits. Please top up.' });
    return;
  }

  req.apiKeyData = data;
  next();
}

app.post(
  '/v1/primordia/execute',
  authenticateApiKey,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { payload } = req.body;

      const result = {
        status: 'success',
        processedAt: new Date().toISOString(),
        data: payload,
      };

      if (req.apiKeyData) {
        await supabase
          .from('api_keys')
          .update({ credits_remaining: req.apiKeyData.credits_remaining - 1 })
          .eq('id', req.apiKeyData.id);
      }

      res.status(200).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PrimordiaOS Gated API running on port ${PORT}`);
});
