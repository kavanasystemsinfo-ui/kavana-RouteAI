import express from 'express';
import db from '../../db.js';
import { processManifestImage } from '../services/ocrService.js';
import { optimizeRoute } from '../services/aiService.js';
import { generatePOD } from '../services/pdfService.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// Dashboard metrics (Torre de Control)
router.get('/dashboard-data', (req, res) => {
  try {
    const stops = db.prepare('SELECT * FROM stops ORDER BY stop_number ASC').all();
    const incidents = db.prepare('SELECT * FROM incidents ORDER BY created_at DESC').all();
    
    // Recuperar configuración financiera activa
    const settingsRows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => settings[r.key] = parseFloat(r.value) || 0);
    
    // Corrección de la ruta relativa (api.js está en src/routes -> ../../pods = server/pods)
    const podsDir = path.join(__dirname, '../../pods');
    let podsFiles = [];
    if (fs.existsSync(podsDir)) {
      podsFiles = fs.readdirSync(podsDir).filter(f => f.endsWith('.pdf'));
    }

    const dashboardStops = stops.map(stop => {
      const podFile = podsFiles.find(f => f.includes(`_${stop.id}_`));
      return {
        ...stop,
        pod_url: podFile ? `http://localhost:5001/pods/${podFile}` : null,
        incidents: incidents.filter(i => i.stop_id === stop.id)
      };
    });

    const metrics = {
      total: stops.length,
      delivered: stops.filter(s => s.status === 'delivered').length,
      pending: stops.filter(s => s.status === 'pending').length,
      incidents: stops.filter(s => s.status === 'incident').length
    };

    res.json({ metrics, stops: dashboardStops, settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener configuración financiera
router.get('/settings', (req, res) => {
  try {
    const settingsRows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => settings[r.key] = parseFloat(r.value) || 0);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar configuración financiera (Tarifas OPEX)
router.put('/settings', (req, res) => {
  try {
    const { cost_per_km, cost_per_hour } = req.body;
    const update = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
    db.transaction(() => {
      if (cost_per_km !== undefined) update.run(String(cost_per_km), 'cost_per_km');
      if (cost_per_hour !== undefined) update.run(String(cost_per_hour), 'cost_per_hour');
    })();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las paradas
router.get('/stops', (req, res) => {
  try {
    const stops = db.prepare('SELECT * FROM stops ORDER BY stop_number ASC').all();
    res.json(stops);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Procesar OCR (Automático)
router.post('/ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });
    await processManifestImage(req.file.path);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Procesar OCR (Manual)
router.post('/ocr_manual', (req, res) => {
  try {
    const { address, stop_number } = req.body;
    db.prepare('INSERT INTO stops (stop_number, address, status) VALUES (?, ?, ?)').run(stop_number, address, 'pending');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optimizar Ruta (IA)
router.post('/optimize', async (req, res) => {
  try {
    const { stops } = req.body;
    await optimizeRoute(stops);
    res.json({ success: true });
  } catch (error) {
    console.error('AI Error:', error.message);
    res.status(500).json({ error: 'Error optimizando ruta: ' + error.message });
  }
});

// Actualizar estado o firma de una parada
router.patch('/stops/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, signature, address, receiverName } = req.body;
    
    if (address) {
      db.prepare('UPDATE stops SET address = ? WHERE id = ?').run(address, id);
    } else {
      // Uso de fallbacks para evitar "Bind parameter is undefined" en SQLite
      db.prepare('UPDATE stops SET status = ?, signature = ?, receiver_name = ? WHERE id = ?')
        .run(status || 'pending', signature || null, receiverName || null, id);
      
      // MÓDULO POD: Si es una entrega con firma, generar el albarán PDF
      if (status === 'delivered' && signature) {
        const stopData = db.prepare('SELECT * FROM stops WHERE id = ?').get(id);
        if (stopData) {
          stopData.receiver_name = receiverName || 'No especificado';
          generatePOD(stopData, signature)
            .then(path => console.log(`📄 POD Generado con éxito: ${path}`))
            .catch(err => console.error(`❌ Error generando POD en pdfService:`, err));
        }
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error(`💥 FATAL ERROR en PATCH /stops/${req.params.id}:`, error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Borrar una parada
router.delete('/stops/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM stops WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Borrar todas las paradas
router.delete('/stops', (req, res) => {
  try {
    db.prepare('DELETE FROM stops').run();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registrar una incidencia (Modo Combate)
router.post('/stops/:id/incident', (req, res) => {
  try {
    const { id } = req.params;
    const { type, photo_data, notes } = req.body;
    
    db.prepare('INSERT INTO incidents (stop_id, type, photo_data, notes) VALUES (?, ?, ?, ?)').run(id, type, photo_data, notes || '');
    db.prepare('UPDATE stops SET status = ? WHERE id = ?').run('incident', id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
