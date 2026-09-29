/**
 * Health check route.
 *
 * GET /api/health — returns 200 with service status
 *
 * Used by ECS Fargate, ALB target group health checks, and monitoring.
 *
 * Deliberately minimal: this endpoint is public and unauthenticated by design
 * (load balancers and uptime monitors need to hit it without a token), so it
 * must not become a fingerprinting oracle. It previously returned the exact
 * Node.js runtime version and app version on every request — free reconnaissance
 * for anyone checking whether this deployment is vulnerable to a specific,
 * version-pinned CVE. A monitor only needs to know "is this process up and
 * responding", which `status` + `uptime` already answers.
 */
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
