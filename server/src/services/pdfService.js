// Generación de POD (Proof of Delivery) en PDF con firma y geolocalización.
// Usa pdfkit. Devuelve la ruta del archivo generado.

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PODS_DIR = path.join(__dirname, '../../pods');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// stop: { id, address, receiver_name, status }
// signature: dataURL ("data:image/png;base64,....")
// geo: { lat, lng } opcional
export async function generatePOD(stop, signature, geo = null) {
  ensureDir(PODS_DIR);
  const fileName = `pod_${stop.id}_${Date.now()}.pdf`;
  const filePath = path.join(PODS_DIR, fileName);
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(20).text('KAVANA RouteFleet', { align: 'center' });
  doc.fontSize(12).text('Proof of Delivery (POD)', { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).text(`Parada #${stop.id}`);
  doc.text(`Dirección: ${stop.address || 'N/A'}`);
  doc.text(`Receptor: ${stop.receiver_name || 'No especificado'}`);
  doc.text(`Fecha: ${new Date().toLocaleString('es-ES')}`);
  if (geo && geo.lat && geo.lng) {
    doc.text(`Geolocalización: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
  }
  doc.moveDown();

  if (signature && signature.startsWith('data:image')) {
    const base64 = signature.split(',')[1];
    const imgPath = path.join(PODS_DIR, `sig_${stop.id}_${Date.now()}.png`);
    fs.writeFileSync(imgPath, Buffer.from(base64, 'base64'));
    doc.text('Firma del receptor:');
    doc.image(imgPath, { fit: [250, 120] });
    fs.unlinkSync(imgPath);
  } else {
    doc.text('Firma: (no disponible)');
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return filePath;
}

export default { generatePOD };
