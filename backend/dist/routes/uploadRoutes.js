"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const security_1 = require("../middleware/security");
const router = express_1.default.Router();
// Ensure upload directory exists
// Use absolute path relative to project root (consistent with server.ts)
const uploadDir = process.env.UPLOAD_DIR || path_1.default.resolve(process.cwd(), 'uploads/contracts');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
console.log(`📁 Upload directory: ${uploadDir}`);
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `contract-${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
    },
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
    },
    fileFilter: (req, file, cb) => {
        // Allow PDF files
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF files are allowed'));
        }
    },
});
router.post('/contract', auth_1.authenticate, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Return the file URL (relative path that can be served statically)
        const fileUrl = `/uploads/contracts/${req.file.filename}`;
        res.json({
            url: fileUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'File upload failed' });
    }
});
// Serve uploaded files (with path traversal protection)
router.get('/contracts/:filename', (req, res) => {
    const filename = req.params.filename;
    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = (0, security_1.sanitizeFilePath)(filename);
    // Validate filename format (should only contain safe characters after sanitization)
    if (!sanitizedFilename || sanitizedFilename !== filename.replace(/[^a-zA-Z0-9._-]/g, '_')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path_1.default.join(uploadDir, sanitizedFilename);
    // Ensure the resolved path is still within the upload directory (prevent directory traversal)
    const resolvedPath = path_1.default.resolve(filePath);
    const resolvedDir = path_1.default.resolve(uploadDir);
    if (!resolvedPath.startsWith(resolvedDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    if (fs_1.default.existsSync(resolvedPath)) {
        res.sendFile(resolvedPath);
    }
    else {
        res.status(404).json({ error: 'File not found' });
    }
});
exports.default = router;
