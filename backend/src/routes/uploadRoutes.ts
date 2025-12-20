import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { sanitizeFilePath } from '../middleware/security';

const router = express.Router();

// Ensure upload directory exists
// Use absolute path relative to project root (consistent with server.ts)
const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads/contracts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
console.log(`📁 Upload directory: ${uploadDir}`);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `contract-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

router.post('/contract', authenticate, upload.single('file'), (req: AuthRequest, res) => {
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
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Serve uploaded files (with path traversal protection)
router.get('/contracts/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Sanitize filename to prevent directory traversal
  const sanitizedFilename = sanitizeFilePath(filename);
  
  // Validate filename format (should only contain safe characters after sanitization)
  if (!sanitizedFilename || sanitizedFilename !== filename.replace(/[^a-zA-Z0-9._-]/g, '_')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filePath = path.join(uploadDir, sanitizedFilename);
  
  // Ensure the resolved path is still within the upload directory (prevent directory traversal)
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(uploadDir);
  
  if (!resolvedPath.startsWith(resolvedDir)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (fs.existsSync(resolvedPath)) {
    res.sendFile(resolvedPath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;

