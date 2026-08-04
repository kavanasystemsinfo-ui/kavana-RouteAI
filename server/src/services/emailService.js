// Servicio de email transaccional para KAVANA RouteFleet.
// Usa Nodemailer con SMTP (agnostico de proveedor). En produccion se apunta
// a Resend (SMTP_HOST=smtp.resend.com) con dominio verificado propio para no
// caer en spam. Si no hay credenciales SMTP configuradas, registra el email en
// consola (modo dev) en lugar de enviarlo.
import nodemailer from 'nodemailer';

// URL base del producto (donde vive el APK y la PWA).
const SITE_BASE = process.env.SITE_BASE || 'https://routefleet.kavanasystems.com';

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass }
  });
}

// Plantilla HTML profesional de bienvenida al repartidor.
export function buildWelcomeHtml({ name, pin, appUrl, apkUrl, downloadUrl }) {
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(downloadUrl)}`;
  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a2230;">
    <div style="background:#0f1115;padding:22px 26px;border-radius:10px 10px 0 0;">
      <span style="color:#fff;font-size:20px;font-weight:700;">KAVANA <span style="color:#FF3D00;">RouteFleet</span></span>
    </div>
    <div style="background:#f4f6f8;padding:26px;border-radius:0 0 10px 10px;">
      <h2 style="margin:0 0 12px;color:#1a2230;">¡Hola ${name}!</h2>
      <p style="margin:0 0 16px;line-height:1.55;">Tu aplicacion de reparto esta lista. Usala para escanear albaranes, entregar con firma y reportar incidencias.</p>

      <div style="background:#fff;border:1px solid #d9dee3;border-radius:8px;padding:16px;margin-bottom:18px;">
        <p style="margin:0 0 6px;font-weight:600;">Tu acceso</p>
        <p style="margin:0;font-size:15px;">PIN: <strong style="font-size:18px;color:#2563eb;letter-spacing:2px;">${pin}</strong><br>
        App: <a href="${appUrl}" style="color:#2563eb;">${appUrl}</a></p>
      </div>

      <p style="margin:0 0 10px;font-weight:600;">Descarga la app</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <a href="${apkUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:600;">Descargar APK (Android)</a>
          </td>
        </tr>
      </table>
      <p style="margin:10px 0 0;font-size:13px;color:#6b7682;">iPhone/iPad: abre <a href="${appUrl}" style="color:#2563eb;">${appUrl}</a> y pulsa "Anadir a pantalla de inicio".</p>

      <div style="text-align:center;margin:20px 0 6px;">
        <img src="${qr}" alt="QR descarga" width="160" height="160" style="border:1px solid #d9dee3;border-radius:8px;">
        <p style="font-size:12px;color:#6b7682;margin:6px 0 0;">Escanea para descargar desde el movil</p>
      </div>

      <p style="font-size:12px;color:#6b7682;margin:18px 0 0;border-top:1px solid #d9dee3;padding-top:12px;">
        Instala el APK desde fuera de Google Play: en tu movil, ajustes → permite "instalar apps desconocidas" para el navegador y pulsa el enlace.
      </p>
    </div>
  </div>`;
}

// Envia el email de bienvenida al repartidor. Devuelve {sent:boolean, dev:boolean}.
export async function sendDriverWelcome({ name, email, pin }) {
  if (!email) return { sent: false, dev: false, reason: 'no-email' };
  const appUrl = `${SITE_BASE}/app`;
  const apkUrl = `${SITE_BASE}/download/routefleet.apk`;
  const downloadUrl = `${SITE_BASE}/download`;
  const html = buildWelcomeHtml({ name, pin, appUrl, apkUrl, downloadUrl });
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@routefleet.kavanasystems.com';

  const transporter = buildTransporter();
  if (!transporter) {
    console.log('[DEV email] bienvenida repartidor ->', email, '\n', html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200));
    return { sent: false, dev: true };
  }
  await transporter.sendMail({
    from: `KAVANA RouteFleet <${from}>`,
    to: email,
    subject: 'KAVANA RouteFleet - tu app de reparto esta lista',
    html
  });
  return { sent: true };
}
