import { Router } from 'express';
import { fetchUrlMetadata } from '../services/ytdlp';

const router = Router();

router.get('/', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    const metadata = await fetchUrlMetadata(url);
    return res.json({ metadata });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export { router as metadataRoutes };