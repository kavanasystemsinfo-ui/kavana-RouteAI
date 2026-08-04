// Generación de POD (Proof of Delivery) en el navegador con jsPDF.
// Garantiza que el operario pueda descargar el justificante al instante,
// sin depender de la disponibilidad o sincronizacion del backend.
import { jsPDF } from 'jspdf';

// stop: { id, address, receiver_name, status }
// signature: dataURL ("data:image/png;base64,....")
// geo: { lat, lng } opcional
export function generatePodBlob(stop, signature, geo = null) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFontSize(20);
  doc.text('KAVANA RouteFleet', W / 2, 50, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Proof of Delivery (POD)', W / 2, 70, { align: 'center' });

  doc.setFontSize(11);
  let y = 110;
  doc.text(`Parada #${stop.id}`, 50, y); y += 20;
  doc.text(`Direccion: ${stop.address || 'N/A'}`, 50, y); y += 20;
  doc.text(`Receptor: ${stop.receiver_name || 'No especificado'}`, 50, y); y += 20;
  doc.text(`Fecha: ${new Date().toLocaleString('es-ES')}`, 50, y); y += 20;
  if (geo && geo.lat && geo.lng) {
    doc.text(`Geolocalizacion: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`, 50, y); y += 20;
  }

  y += 20;
  doc.text('Firma del receptor:', 50, y);
  if (signature && signature.startsWith('data:image')) {
    try {
      doc.addImage(signature, 'PNG', 50, y + 10, 250, 120);
    } catch (e) {
      doc.text('(firma no disponible)', 50, y + 50);
    }
  } else {
    doc.text('(firma no disponible)', 50, y + 50);
  }

  return doc.output('blob');
}

// Dispara la descarga en el navegador.
export function downloadPod(stop, signature, geo = null) {
  const blob = generatePodBlob(stop, signature, geo);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `POD_${stop.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
