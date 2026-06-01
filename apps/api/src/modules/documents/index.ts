import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { auditAction } from '../../lib/audit.js';
import Tesseract from 'tesseract.js';
import fs from 'fs';
// @ts-ignore
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { summarizeWithMistral } from '../ai/ai.service.js';

const router = Router();

const ALLOWED_DOCUMENT_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

const storage = multer.diskStorage({
  destination: path.join(process.cwd(), 'uploads', 'documents'),
  // Use random name — never expose originalname in the saved path (path traversal prevention)
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safe = ext && ext.length <= 6 ? ext : '';
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOCUMENT_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed') as any, false);
    }
  },
});

// POST /documents
router.post('/', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!req.file) return res.status(400).json({ ok: false, message: 'No file uploaded' });

  const { description, projectId } = req.body;
  const fileUrl = `/uploads/documents/${req.file.filename}`;
  const localFilePath = req.file.path;

  let extractedText: string | null = null;
  let aiSummary: string | null = null;

  try {
    if (req.file.mimetype === 'application/pdf') {
       const dataBuffer = fs.readFileSync(localFilePath);
       const pdfData = await pdfParse(dataBuffer);
       extractedText = pdfData.text;
    } else if (req.file.mimetype.startsWith('image/')) {
       const { data: { text } } = await Tesseract.recognize(localFilePath, 'eng');
       extractedText = text;
    }
    
    if (extractedText && extractedText.trim().length > 10) {
       aiSummary = await summarizeWithMistral(extractedText);
    }
  } catch(e) {
    console.error("OCR/Mistral Error:", e);
  }

  const doc = await prisma.document.create({
    data: {
      organizationId: user.orgId,
      uploadedById: user.id,
      projectId: projectId || null,
      name: req.file.originalname,
      fileUrl,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      description,
      extractedText,
      aiSummary
    },
  });

  await auditAction(user.id, 'DOCUMENT_UPLOADED', 'Document', doc.id, { name: doc.name });
  return res.json({ ok: true, document: doc });
});

// GET /documents
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { projectId } = req.query;
  const documents = await prisma.document.findMany({
    where: {
      organizationId: user.orgId,
      ...(projectId ? { projectId: projectId as string } : {}),
    },
    include: { uploadedBy: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return res.json({ ok: true, documents });
});

// DELETE /documents/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ ok: false, message: 'Document not found' });

  const canDelete = doc.uploadedById === user.id || ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  if (!canDelete) return res.status(403).json({ ok: false, message: 'Forbidden' });

  await prisma.document.delete({ where: { id: req.params.id } });
  await auditAction(user.id, 'DOCUMENT_DELETED', 'Document', doc.id, { name: doc.name });
  return res.json({ ok: true, message: 'Deleted' });
});

export default router;
