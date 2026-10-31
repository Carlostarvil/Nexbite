import nodemailer from 'nodemailer';

const falloCorreo = (mensaje, code) => Object.assign(new Error(mensaje), { code });

function direccion(valor) {
  if (valor && typeof valor === 'object') return { email: valor.address || valor.email, ...(valor.name ? { name: valor.name } : {}) };
  const texto = String(valor || '').trim();
  const partes = texto.match(/^(.*?)\s*<([^<>]+)>$/);
  return partes ? { email: partes[2].trim(), ...(partes[1].trim() ? { name: partes[1].trim().replace(/^"|"$/g, '') } : {}) } : { email: texto };
}

export function crearServicioCorreo({ env = process.env, fetchImpl = fetch, crearTransporte = nodemailer.createTransport } = {}) {
  const proveedor = String(env.EMAIL_PROVIDER || (env.BREVO_API_KEY ? 'brevo' : 'smtp')).toLowerCase();
  if (proveedor === 'smtp') {
    const smtp = crearTransporte({
      service: 'gmail',
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
    });
    return { sendMail: async mensaje => {
      if (!env.EMAIL_USER || !env.EMAIL_PASS) throw falloCorreo('Configura el servicio de correo del servidor.', 'CORREO_NO_CONFIGURADO');
      return smtp.sendMail(mensaje);
    } };
  }
  return { sendMail: async mensaje => {
    if (proveedor !== 'brevo') throw falloCorreo('EMAIL_PROVIDER debe ser brevo o smtp.', 'CORREO_NO_CONFIGURADO');
    const remitenteOriginal = direccion(mensaje.from);
    const remitente = direccion(env.EMAIL_FROM || remitenteOriginal.email || env.EMAIL_USER);
    if (!env.BREVO_API_KEY || !remitente.email || !remitente.email.includes('@')) {
      throw falloCorreo('Configura BREVO_API_KEY y un remitente verificado en EMAIL_FROM.', 'CORREO_NO_CONFIGURADO');
    }
    const destinatarios = (Array.isArray(mensaje.to) ? mensaje.to : [mensaje.to]).map(direccion);
    const contenido = {
      sender: { ...remitente, name: remitente.name || remitenteOriginal.name || 'NexBite' },
      to: destinatarios,
      subject: mensaje.subject,
      ...(mensaje.html ? { htmlContent: mensaje.html } : {}),
      ...(mensaje.text ? { textContent: mensaje.text } : {}),
      replyTo: remitente,
    };
    let respuesta;
    try {
      respuesta = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
        body: JSON.stringify(contenido),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      throw falloCorreo('No se ha podido conectar con el servicio de correo. Se podrá reintentar.', error.name === 'TimeoutError' || error.name === 'AbortError' ? 'CORREO_TIEMPO_AGOTADO' : 'CORREO_CONEXION');
    }
    if (!respuesta.ok) throw falloCorreo('El servicio de correo ha rechazado el envío. Revisa la clave API y el remitente verificado.', 'CORREO_HTTP_' + respuesta.status);
    let resultado;
    try { resultado = await respuesta.json(); } catch { /* Una respuesta incompleta no confirma que el proveedor haya aceptado el correo. */ }
    if (typeof resultado?.messageId !== 'string' || !resultado.messageId) throw falloCorreo('No se ha podido confirmar la aceptación del correo.', 'CORREO_RESPUESTA_INVALIDA');
    return { messageId: resultado.messageId };
  } };
}
