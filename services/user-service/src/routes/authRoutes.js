import { Router } from 'express';
import authController from '../controllers/authController.js';
import authenticateJwt from '../middleware/auth.js';

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Protected routes
router.get('/me', authenticateJwt, authController.getMe);
router.post('/logout', authenticateJwt, authController.logout);

export default router;
