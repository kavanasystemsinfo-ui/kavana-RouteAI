// Rutas de almacenamiento de artefactos (PODs PDF + fotos de incidencias).
// Centralizado para Fly.io (volumen montado en DATA_DIR) — antes cada módulo
// calculaba su propia ruta (cwd vs __dirname) y en producción los archivos
// caían en el FS efímero. Un solo punto de verdad.
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
export const PODS_DIR = path.join(DATA_DIR, 'pods');
export const INCIDENTS_DIR = path.join(DATA_DIR, 'incidents');
export default { DATA_DIR, PODS_DIR, INCIDENTS_DIR };
