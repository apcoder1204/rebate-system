import express from 'express';
import * as orderController from '../controllers/orderController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, orderController.listOrders);
router.get('/filter', authenticate, orderController.filterOrders);
router.get('/:id', authenticate, orderController.getOrder);
router.post('/', authenticate, orderController.createOrder);
router.put('/:id', authenticate, orderController.updateOrder);
router.delete('/:id', authenticate, orderController.deleteOrder);

export default router;

