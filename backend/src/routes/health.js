/**
 * Health check route.
 *
 * GET /api/health — returns 200 with service status
 *
 * Used by ECS Fargate, ALB target group health checks, and monitoring.
 */
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'havan-studio-api',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    node: process.version,
  });
});

export default router;
