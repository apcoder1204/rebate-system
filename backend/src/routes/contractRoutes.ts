import express from 'express';
import * as contractController from '../controllers/contractController';
import { exportContractsCSV } from '../controllers/exportController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, contractController.listContracts);
router.get('/filter', authenticate, contractController.filterContracts);
router.get('/export/csv', authenticate, exportContractsCSV);
router.get('/:id', authenticate, contractController.getContract);
router.post('/', authenticate, contractController.createContract);
router.put('/:id', authenticate, contractController.updateContract);
router.delete('/:id', authenticate, contractController.deleteContract);

export default router;

