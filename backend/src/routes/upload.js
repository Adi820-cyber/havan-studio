/**
 * Upload routes.
 *
 * GET /api/upload/presigned-url — generate an S3 presigned URL for cover uploads
 *
 * S3 is optional: if AWS credentials are not configured, this route returns a
 * friendly 503 instead of crashing the server at startup.
 */
import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import env from '../config/env.js';

const router = Router();

/* ── Lazy S3 client — only created when AWS is configured ── */

let _s3Client = null;
let _S3Loaded = false;

async function getS3Client() {
  if (!env.AWS_CONFIGURED) return null;
  if (_s3Client) return _s3Client;

  if (!_S3Loaded) {
    const { S3Client } = await import('@aws-sdk/client-s3');
    _s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
    _S3Loaded = true;
  }
  return _s3Client;
}

/**
 * GET /api/upload/presigned-url
 * Query: ?contentType=image/jpeg (optional)
 * Returns: { signedUrl, publicUrl }
 */
router.get(
  '/presigned-url',
  uploadLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    /* ── Guard: AWS not configured ── */
    const s3 = await getS3Client();
    if (!s3) {
      return res.status(503).json({
        error: 'Image uploads are not configured yet. The host is setting up S3 storage.',
      });
    }

    if (req.user.isAnonymous) {
      return res.status(403).json({ error: 'Please create an account to upload images.' });
    }

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const contentType = req.query.contentType || 'image/jpeg';
    const rand = crypto.randomUUID();
    const objectKey = `${req.user.id}/${rand}.jpg`;

    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
      CacheControl: 'max-age=31536000',
    });

    // URL valid for 2 minutes
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 120 });
    const publicUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${objectKey}`;

    console.log(`✅ Presigned URL generated for user ${req.user.id.slice(0, 8)}...`);
    res.json({ signedUrl, publicUrl });
  })
);

export default router;

