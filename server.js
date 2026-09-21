/**
 * Backend API server for HAVAN Studio.
 *
 * Responsibilities:
 *   1. Serve the built React app (dist/) in production.
 *   2. Provide /api/s3-presigned-url so the browser can upload cover images
 *      directly to AWS S3 without exposing the AWS secret key.
 *
 * Auth: We decode the Supabase JWT locally (no Supabase SDK needed server-side)
 * to extract the user id. This avoids the Node 22 requirement of @supabase/supabase-js.
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path so dotenv finds .env.local wherever node is invoked from.
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.resolve(__dirname, 'dist');

app.disable('x-powered-by');
app.use(express.json());

// --- Startup diagnostics ---
const REQUIRED_ENV = {
  AWS_REGION:            process.env.AWS_REGION,
  AWS_S3_BUCKET:         process.env.AWS_S3_BUCKET,
  AWS_ACCESS_KEY_ID:     process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
};
const MISSING = Object.entries(REQUIRED_ENV).filter(([, v]) => !v).map(([k]) => k);
if (MISSING.length) {
  console.error(`\n❌  Missing environment variables: ${MISSING.join(', ')}`);
  console.error('   Make sure .env.local exists and contains these keys.\n');
} else {
  console.log('✅  All required environment variables loaded.');
}

// --- AWS S3 client ---
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});
const S3_BUCKET = process.env.AWS_S3_BUCKET || 'havan-studio';

// --- Static files (production) ---
app.use(
  express.static(distPath, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

// --- API: generate a short-lived S3 presigned upload URL ---
app.get('/api/s3-presigned-url', async (req, res) => {
  try {
    // 1. Extract + decode the Supabase JWT locally (no SDK needed)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }
    const token = authHeader.split(' ')[1];

    let userId, isAnon;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('malformed JWT');
      // base64url decode the payload section
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8')
      );
      userId = payload.sub;
      isAnon = payload.is_anonymous === true;
      if (!userId) throw new Error('missing sub claim');
    } catch (jwtErr) {
      console.error('JWT decode failed:', jwtErr.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid session token.' });
    }

    if (isAnon) {
      return res.status(403).json({ error: 'Forbidden: Please create an account to upload images.' });
    }

    // 2. Generate S3 presigned URL
    const contentType = req.query.contentType || 'image/jpeg';
    const rand = crypto.randomUUID();
    const objectKey = `${userId}/${rand}.jpg`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
      CacheControl: 'max-age=31536000',
    });

    // URL valid for 2 minutes
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 120 });
    const publicUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${objectKey}`;

    console.log(`✅ Presigned URL generated for user ${userId.slice(0, 8)}...`);
    res.json({ signedUrl, publicUrl });

  } catch (error) {
    console.error('Error generating presigned URL:', error.message || error);
    res.status(500).json({ error: 'Failed to generate presigned URL.' });
  }
});

// SPA fallback for deep links (production)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🪔 HAVAN Studio backend listening on port ${PORT}`);
  console.log(`   → API: http://localhost:${PORT}/api/s3-presigned-url`);
  console.log(`   → Node: ${process.version}\n`);
});
