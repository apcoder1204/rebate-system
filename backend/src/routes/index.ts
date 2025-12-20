import express from 'express';
import userRoutes from './userRoutes';
import contractRoutes from './contractRoutes';
import orderRoutes from './orderRoutes';
import uploadRoutes from './uploadRoutes';

const router = express.Router();

router.use('/users', userRoutes);
router.use('/contracts', contractRoutes);
router.use('/orders', orderRoutes);
router.use('/upload', uploadRoutes);

export default router;

