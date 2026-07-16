import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getPreferences,
  updatePreferences,
  savePushSubscription,
  removePushSubscription,
  getVapidPublicKey,
} from '../controllers/notificationController';

const router = Router();

router.get('/vapid-public-key', authenticate, getVapidPublicKey);
router.get('/preferences', authenticate, getPreferences);
router.put('/preferences', authenticate, updatePreferences);
router.post('/push-subscription', authenticate, savePushSubscription);
router.delete('/push-subscription', authenticate, removePushSubscription);

export default router;
