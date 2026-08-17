// OCR endpoints — RouteAI (P3: extraído de api.js)
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { requireAuth } from '../auth.js';
import { processManifestImage } from '../services/ocrService.js';
import { cleanAddress } from '../services/addressCleaner.js';

export default function ocrRouter(db) {
  const q = db.queries;
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  router.post('/ocr', requireAuth(['driver', 'office']), upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
      const buffer = req.file.buffer;
      const fileType = req.file.mimetype;
      const fileTypeFlag = req.body.type || '';
      const isPdf = fileType === 'application/pdf' || fileTypeFlag === 'pdf';
      const isCsv = fileType === 'text/csv' || fileTypeFlag === 'csv';
      // Fase 1 (auditoría 2026-08-17): NO usar req.file.originalname en rutas
      // (path traversal vía nombres como ../../etc/x). Directorio temporal
      // exclusivo + nombre aleatorio; extensión de los magic bytes del contenido.
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'routeai-ocr-'));
      const tmpPath = path.join(tmpDir, `upload-${crypto.randomBytes(8).toString('hex')}`);
      fs.writeFileSync(tmpPath, buffer);
      const result = await processManifestImage(tmpPath, isPdf, isCsv);
      let addresses = [];
      const items = [];
      const stopKeywords = ['total', 'subtotal', 'iva', 'importe', 'firma', 'recibi', 'entregado', 'observaciones', 'notas', 'cliente', 'direccion', 'fecha', 'albaran', 'nº', 'telefono', 'contacto'];
      if (result.raw) {
        const allLines = result.raw.split('\n');
        for (const line of allLines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const lower = trimmed.toLowerCase();
          if (stopKeywords.some(kw => lower.startsWith(kw))) continue;
          let m = trimmed.match(/^\d+\s+([A-Z]{2,5}-\d{2,5})\s+(.+?)\s{2,}(\d{1,4})\s/i);
          if (m && parseInt(m[3]) > 0 && parseInt(m[3]) < 10000 && m[2].trim().length > 1 && !m[2].trim().match(/\d{5}/))
            items.push({ name: m[2].trim().replace(/^[-.\s]+|[-.\s]+$/g, '').replace(/\s{2,}/g, ' ').trim(), qty: parseInt(m[3]), checked: false });
          else {
            m = trimmed.match(/^\d+\s+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ][\w\sáéíóúñÁÉÍÓÚÑ()%+\-.]{3,}?)\s{2,}(\d{1,4})\s/i);
            if (m && parseInt(m[2]) > 0 && parseInt(m[2]) < 10000 && m[1].trim().length > 1 && !m[1].trim().match(/\d{5}/))
              items.push({ name: m[1].trim().replace(/^[-.\s]+|[-.\s]+$/g, '').replace(/\s{2,}/g, ' ').trim(), qty: parseInt(m[2]), checked: false });
          }
        }
      }
      if (result.raw) {
        const lines = result.raw.split('\n');
        const skipPatterns = [/^[A-Z\s]{5,}$/, /CIF|NIF|DNI/i, /^\d{4,6}\s/, /T[eé]l/i, /^\d{3}\s\d{2}/, /@/, /^www\./i, /^\d+[.,]\d{2}\s*EUR/];
        for (const line of lines) {
          const cleaned = line.trim().replace(/^\d+\s{2,}/, '');
          if (skipPatterns.some(p => p.test(cleaned))) continue;
          const addr = cleanAddress(cleaned);
          const hasStreet = /\b(Calle|C\/|Avenida|Av\.?|Avda\.?|Carrer|Ronda|Paseo|Plaza|Ctra\.?|Camino|Pol[ií]gono|Calleja|Traves[ií]a|Glorieta|Pasaje|Urbanizaci[oó]n)\b/i.test(addr);
          if (addr && addr.length > 10 && hasStreet) addresses.push(addr);
        }
        if (addresses.length === 0 && result.address && result.address.length > 5) addresses.push(result.address);
      }
      try { fs.unlinkSync(tmpPath); } catch (e) {}
      try { fs.rmdirSync(tmpDir); } catch (e) {}
      if (addresses.length > 0) res.json({ success: true, addresses, items, detectedAddress: addresses[0], totalAddresses: addresses.length, totalItems: items.length });
      else res.json({ success: false, error: 'No se detectó dirección en el archivo' });
    } catch (error) {
      console.error('Error OCR:', error);
      res.status(500).json({ error: error.message || 'Error interno procesando archivo' });
    }
  });

  // Manual OCR — usa el driverId del JWT
  router.post('/ocr_manual', requireAuth(['driver']), async (req, res) => {
    try {
      const { address, stop_number } = req.body;
      await q.addStop(db, stop_number, address, 'pending', req.user.driverId);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return router;
}
