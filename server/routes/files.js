import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticate } from '../middleware/auth.js';
import { setupLogger } from '../config/logger.js';

const router = express.Router();
const logger = setupLogger();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow only CSV, JSON, and Excel files
  const allowedTypes = [
    'text/csv',
    'application/json',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV, JSON, and Excel files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 // 100MB default
  }
});

// @route   POST /api/files/upload
// @desc    Upload a file for data processing
// @access  Private
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path,
      uploadedAt: new Date()
    };

    logger.info(`File uploaded: ${req.file.originalname} by user ${req.user.email}`);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        file: fileInfo
      }
    });
  } catch (error) {
    logger.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

// @route   GET /api/files/download/:filename
// @desc    Download a generated file
// @access  Private
router.get('/download/:filename', authenticate, async (req, res) => {
  try {
    const filename = req.params.filename;
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stats.size);

    // Stream the file
    const fileStream = await fs.readFile(filePath);
    res.send(fileStream);

    logger.info(`File downloaded: ${filename} by user ${req.user.email}`);
  } catch (error) {
    logger.error('File download error:', error);
    res.status(500).json({
      success: false,
      message: 'File download failed'
    });
  }
});

// @route   DELETE /api/files/:filename
// @desc    Delete an uploaded file
// @access  Private
router.delete('/:filename', authenticate, async (req, res) => {
  try {
    const filename = req.params.filename;
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete the file
    await fs.unlink(filePath);

    logger.info(`File deleted: ${filename} by user ${req.user.email}`);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    logger.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'File deletion failed'
    });
  }
});

// @route   GET /api/files/preview/:filename
// @desc    Preview file contents (first few rows)
// @access  Private
router.get('/preview/:filename', authenticate, async (req, res) => {
  try {
    const filename = req.params.filename;
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, filename);
    const limit = parseInt(req.query.limit) || 10;

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const ext = path.extname(filename).toLowerCase();
    let preview = [];

    if (ext === '.json') {
      // Handle JSON files
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      preview = Array.isArray(data) ? data.slice(0, limit) : [data];
    } else if (ext === '.csv') {
      // Handle CSV files
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const headers = lines[0] ? lines[0].split(',') : [];
      
      preview = lines.slice(0, Math.min(limit + 1, lines.length)).map(line => {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index] ? values[index].trim() : '';
        });
        return row;
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'File preview not supported for this file type'
      });
    }

    res.json({
      success: true,
      data: {
        filename,
        preview,
        totalRows: preview.length,
        previewLimit: limit
      }
    });
  } catch (error) {
    logger.error('File preview error:', error);
    res.status(500).json({
      success: false,
      message: 'File preview failed'
    });
  }
});

export default router;
