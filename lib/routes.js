const productFields = 'id,stall_id,name,category,unit,description,price_cents,stock,published';

const actions = {
  catalog: ['GET', '/rest/v1/products?select=' + productFields + ',stalls(name,location)&published=eq.true&order=id'],
  delivery: ['GET', '/rest/v1/delivery_areas?select=district,fee_cents&order=district'],
  login: ['POST', '/auth/v1/token?grant_type=password'],
  member: ['GET', '/rest/v1/stall_members?select=stall_id,stalls(name,location)', true],
  inventory: ['GET', '/rest/v1/products?select=' + productFields + '&order=id.desc', true],
  saveProduct: ['POST', '/rest/v1/products', true],
  orders: ['GET', '/rest/v1/orders?select=id,customer_name,phone,mode,district,address,subtotal_cents,delivery_cents,status,created_at,payments(id,reference,status,amount_cents)&order=created_at.desc&limit=100', true],
  createOrder: ['POST', '/rest/v1/rpc/create_order'],
  trackOrder: ['POST', '/rest/v1/rpc/track_order'],
  submitPayment: ['POST', '/rest/v1/rpc/submit_payment'],
  reviewPayment: ['POST', '/rest/v1/rpc/review_payment', true],
  advanceOrder: ['POST', '/rest/v1/rpc/advance_order', true]
};

export function resolveRoute(action, method, id, authorization) {
  const route = Object.hasOwn(actions, action) ? actions[action] : null;
  if (!route) return { status: 404, message: 'Operación no disponible.' };
  const [expected, path, needsSession] = route;
  if (action === 'saveProduct' && method === 'PATCH') {
    if (typeof id !== 'string' || !/^[1-9][0-9]{0,9}$/.test(id)) {
      return { status: 400, message: 'Identificador de producto inválido.' };
    }
    if (!validSessionHeader(authorization)) return unauthorized();
    return { path: path + '?id=eq.' + id, auth: authorization };
  }
  if (method !== expected) return { status: 405, message: 'Método no permitido.' };
  if (needsSession && !validSessionHeader(authorization)) return unauthorized();
  return { path, auth: needsSession ? authorization : undefined };
}

function validSessionHeader(header) {
  return typeof header === 'string' && /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(header);
}

function unauthorized() {
  return { status: 401, message: 'Inicia sesión como comerciante.' };
}

export function normalizeError(payload, status) {
  if (status === 401) return 'No se pudo iniciar o validar la sesión.';
  if (status === 403) return 'Operación sin permiso.';
  if (payload?.code === 'P0001' && typeof payload.message === 'string') return payload.message;
  return status >= 500 ? 'Servicio temporalmente no disponible.' : 'Revisa los datos ingresados y vuelve a intentar.';
}
