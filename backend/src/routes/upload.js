/**
 * Upload routes.
 *
 * GET /api/upload/presigned-url — generate an S3 presigned URL for cover uploads
 *
 * Migrated from the old root server.js. The only thing that changed is the
 * auth mechanism: instead of decoding the JWT manually we use the auth middleware.
 */
import { Router } from 'express';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import env from '../config/env.js';

const router = Router();

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

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
    if (req.user.isAnonymous) {
      return res.status(403).json({ error: 'Please create an account to upload images.' });
    }

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
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 120 });
    const publicUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${objectKey}`;

    console.log(`✅ Presigned URL generated for user ${req.user.id.slice(0, 8)}...`);
    res.json({ signedUrl, publicUrl });
  })
);

export default router;
