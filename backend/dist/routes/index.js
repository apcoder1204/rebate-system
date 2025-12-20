"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userRoutes_1 = __importDefault(require("./userRoutes"));
const contractRoutes_1 = __importDefault(require("./contractRoutes"));
const orderRoutes_1 = __importDefault(require("./orderRoutes"));
const uploadRoutes_1 = __importDefault(require("./uploadRoutes"));
const router = express_1.default.Router();
router.use('/users', userRoutes_1.default);
router.use('/contracts', contractRoutes_1.default);
router.use('/orders', orderRoutes_1.default);
router.use('/upload', uploadRoutes_1.default);
exports.default = router;
