import { normalizeError, resolveRoute } from '../lib/routes.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const { action, id } = req.query;
  const route = resolveRoute(action, req.method, id, req.headers.authorization);
  if (route.status) return res.status(route.status).json({ message: route.message });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return res.status(503).json({ message: 'Servicio temporalmente no disponible.' });

  const isRead = req.method === 'GET';
  if (!isRead && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) {
    return res.status(400).json({ message: 'Solicitud inválida.' });
  }
  const body = isRead ? undefined : JSON.stringify(req.body);
  if (body && Buffer.byteLength(body) > 8000) return res.status(413).json({ message: 'La solicitud es demasiado grande.' });

  try {
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (route.auth) headers.Authorization = route.auth;
    if (action === 'saveProduct') headers.Prefer = 'return=representation';
    const upstream = await fetch(new URL(route.path, url), {
      method: req.method, headers, body, signal: AbortSignal.timeout(8000)
    });
    const raw = await upstream.text();
    const content = raw ? JSON.parse(raw) : null;
    if (!upstream.ok) return res.status(upstream.status).json({ message: normalizeError(content, upstream.status) });
    if (action === 'login') {
      return res.status(200).json({ access_token: content.access_token });
    }
    return res.status(200).json(content);
  } catch {
    return res.status(502).json({ message: 'No se pudo consultar la base de datos. Inténtalo nuevamente.' });
  }
}
