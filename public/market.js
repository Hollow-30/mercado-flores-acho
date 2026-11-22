import { addToCart, setQuantity, subtotal, filterCatalog } from './cart.js';

const $ = id => document.getElementById(id);
const dialog = $('panel');
const content = $('panel-content');
const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const money = cents => currency.format(cents / 100);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[ch]);
const categories = ['Rosas', 'Girasoles', 'Arreglos', 'Coronas'];
// Imágenes ilustrativas exclusivas de los productos de demostración.
const pictures = {
  'Casa Rosa|Rosas carmesí': '/images/rosas-rojas.jpg',
  'Casa Rosa|Rosas rosadas': '/images/rosas-rosadas.jpg',
  'Flores del Rímac|Corona de homenaje': '/images/corona.jpg',
  'Flores del Rímac|Girasoles del valle': 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=650&q=80',
  'Jardín de Acho|Ramo jardín de temporada': 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=650&q=80',
  'Jardín de Acho|Arreglo silvestre': 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=650&q=80'
};
const statuses = {
  pending_payment:'Pendiente de pago', paid:'Pagado', preparing:'En preparación',
  ready:'Listo', picked_up:'Recogido', out_for_delivery:'En reparto', delivered:'Entregado',
  review:'Por verificar', approved:'Validado', rejected:'Rechazado'
};

let products = [];
let deliveryAreas = [];
let items = [];
let access = sessionStorage.getItem('acho.session') ?? '';
let orderToken = sessionStorage.getItem('acho.order') ?? '';
let requestId = crypto.randomUUID();
let toastTimer;
let checkoutDraft = {};

function picture(p, className = '') {
  const src = pictures[`${p.stalls.name}|${p.name}`];
  return src
    ? `<img class="${className}" loading="lazy" decoding="async" src="${src}" alt="" width="650" height="320">`
    : `<div class="product-placeholder ${className}">Imagen no disponible</div>`;
}

async function api(action, { method = 'GET', data, id, session = false } = {}) {
  const params = new URLSearchParams({ action });
  if (id) params.set('id', id);
  const headers = { 'Content-Type': 'application/json' };
  if (session) headers.Authorization = 'Bearer ' + access;
  const result = await fetch('/api/market?' + params, {
    method, headers, body: data === undefined ? undefined : JSON.stringify(data)
  });
  let body;
  try { body = await result.json(); }
  catch { throw new Error('El servicio no está disponible. Inténtalo nuevamente más tarde.'); }
  if (!result.ok) throw new Error(body.message || 'Ocurrió un error al procesar la solicitud.');
  return body;
}

function showToast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}

function panel(title, html) {
  $('panel-title').textContent = title;
  content.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}

function errorMessage(message) {
  return '<p class="error" role="alert">' + escapeHtml(message) + '</p>';
}

function bindForm(id, submit) {
  const form = $(id);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    const error = form.querySelector('[role="alert"]');
    if (button?.disabled) return;
    button.disabled = true;
    if (error) error.textContent = '';
    try { await submit(new FormData(form)); }
    catch (err) { if (error) error.textContent = err.message; else showToast(err.message); }
    finally { button.disabled = false; }
  });
}

function renderCatalog() {
  const filtered = filterCatalog(products, $('category').value, $('search').value, Number($('stall').value));
  $('catalog-status').textContent = filtered.length ? filtered.length + ' productos' : 'No hay productos que coincidan con los filtros.';
  $('products').innerHTML = filtered.map(p => `
    <article class="product">
      ${picture(p)}
      <div class="product-body">
        <div class="meta">${escapeHtml(p.stalls.name)} · ${escapeHtml(p.category)}</div>
        <h3>${escapeHtml(p.name)}</h3>
        <div class="product-header"><span class="price">${money(p.price_cents)}</span><span class="meta">${escapeHtml(p.unit)} · ${p.stock ? p.stock + ' disponibles' : 'Agotado'}</span></div>
        <p class="actions"><button type="button" data-detail="${p.id}">Ver detalle</button><button type="button" class="primary" data-buy="${p.id}" ${p.stock ? '' : 'disabled'}>Agregar</button></p>
      </div>
    </article>`).join('');
}

async function loadCatalog() {
  $('catalog-status').textContent = 'Cargando catálogo…';
  try {
    [products, deliveryAreas] = await Promise.all([api('catalog'), api('delivery')]);
    if (!items.length) {
      try {
        const saved = JSON.parse(sessionStorage.getItem('acho.cart') || '[]');
        if (Array.isArray(saved)) {
          for (const row of saved) {
            const product = products.find(p => p.id === row.id);
            if (product && Number.isInteger(row.quantity) && row.quantity > 0 && row.quantity <= product.stock) {
              try { items = addToCart(items, product, row.quantity); } catch { /* Omitir productos incompatibles. */ }
            }
          }
        }
      } catch { sessionStorage.removeItem('acho.cart'); }
      updateCount();
    }
    const currentStall = $('stall').value;
    const stalls = new Map(products.map(p => [p.stall_id, p.stalls.name]));
    $('stall').innerHTML = '<option value="">Todos</option>' + [...stalls].map(([id,name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join('');
    $('stall').value = stalls.has(Number(currentStall)) ? currentStall : '';
    renderCatalog();
  } catch (err) { $('catalog-status').textContent = err.message; }
}

function detail(id) {
  const p = products.find(row => row.id === id);
  if (!p) return;
  panel(p.name, `${picture(p, 'detail-image')}
    <p class="muted">Imagen referencial. La presentación puede variar.</p>
    <p class="muted">${escapeHtml(p.stalls.name)} · ${escapeHtml(p.stalls.location)}</p>
    <p>${escapeHtml(p.description)}</p>
    <p><strong>${money(p.price_cents)}</strong> · ${escapeHtml(p.unit)} · ${p.stock ? p.stock + ' disponibles' : 'Agotado'}</p>
    <button type="button" class="primary" data-buy="${p.id}" ${p.stock ? '' : 'disabled'}>Agregar al carrito</button>`);
}

function updateCount() {
  $('cart-count').textContent = items.reduce((n,row) => n + row.quantity,0);
  sessionStorage.setItem('acho.cart', JSON.stringify(items.map(row => ({id:row.product.id, quantity:row.quantity}))));
}

function renderCart() {
  const existingForm = $('checkout');
  if (existingForm) checkoutDraft = Object.fromEntries(new FormData(existingForm));
  if (!items.length) { panel('Carrito', '<p>Tu carrito está vacío. Explora el catálogo para agregar flores.</p>'); return; }
  const rows = items.map(({product:p, quantity}) => `<div class="line-item"><span>${escapeHtml(p.name)} <small>${money(p.price_cents)}</small></span>
    <input type="number" min="0" max="${Math.min(999,p.stock)}" value="${quantity}" data-quantity="${p.id}" aria-label="Cantidad de ${escapeHtml(p.name)}">
    <button type="button" data-remove="${p.id}" aria-label="Quitar ${escapeHtml(p.name)}">Quitar</button></div>`).join('');
  const stall = items[0].product.stalls;
  panel('Carrito', `<p class="muted">${escapeHtml(stall.name)} · ${escapeHtml(stall.location)}</p><div class="panel-card">${rows}</div>
    <form id="checkout">
      <label>Nombre de contacto <input name="name" autocomplete="name" required minlength="2" maxlength="100" placeholder="Ejemplo: Compra de prueba"></label>
      <label>Teléfono <input name="phone" type="tel" required minlength="7" maxlength="18" placeholder="999000000"></label>
      <label>Modalidad <select name="mode" id="mode"><option value="pickup">Recojo en el puesto</option><option value="delivery">Entrega a domicilio</option></select></label>
      <div id="delivery-inputs" hidden>
        <label>Distrito <select name="district" id="district"><option value="">Elige un distrito con cobertura</option>${deliveryAreas.map(x => `<option>${escapeHtml(x.district)}</option>`).join('')}</select></label>
        <label>Dirección <input name="address" id="address" minlength="5" maxlength="200" placeholder="Dirección ficticia"></label>
      </div>
      <p class="total" id="checkout-total"></p><p class="error" role="alert"></p>
      <button class="primary" type="submit">Confirmar pedido</button>
    </form>`);
  function updateTotal() {
    const isDelivery = $('mode').value === 'delivery';
    $('delivery-inputs').hidden = !isDelivery;
    $('district').required = isDelivery;
    $('address').required = isDelivery;
    const fee = isDelivery ? deliveryAreas.find(x=>x.district===$('district').value)?.fee_cents ?? 0 : 0;
    $('checkout-total').textContent = 'Subtotal ' + money(subtotal(items)) + ' · Envío ' + money(fee) + ' · Total ' + money(subtotal(items)+fee);
  }
  $('mode').addEventListener('change',updateTotal);
  $('district').addEventListener('change',updateTotal);
  for (const [name, value] of Object.entries(checkoutDraft)) {
    const field = $('checkout').elements.namedItem(name);
    if (field) field.value = value;
  }
  updateTotal();
  bindForm('checkout',async data=>{
    const order = await api('createOrder',{ method:'POST',data:{
      p_request_id:requestId,p_name:data.get('name'),p_phone:data.get('phone'),p_mode:data.get('mode'),
      p_district:data.get('district'),p_address:data.get('address'),
      p_items:items.map(x=>({product_id:x.product.id,quantity:x.quantity}))
    }});
    orderToken = order.token;
    sessionStorage.setItem('acho.order',orderToken);
    items = [];
    checkoutDraft = {};
    requestId = crypto.randomUUID();
    updateCount();
    await Promise.all([loadCatalog(),renderTracking(true)]);
  });
}

async function renderTracking(created=false) {
  panel('Mi pedido', `<form id="track-form"><label>Código privado de seguimiento <input name="token" required value="${escapeHtml(orderToken)}" placeholder="Código generado al confirmar el pedido"></label><div class="actions"><button class="primary" type="submit">Consultar</button><button id="copy-token" type="button">Copiar código</button></div><p class="error" role="alert"></p></form><div id="track-result"></div>`);
  $('copy-token').onclick = async () => {
    const input = $('track-form').elements.token;
    if (!input.value.trim()) { showToast('Ingresa primero tu código de seguimiento.'); return; }
    try { await navigator.clipboard.writeText(input.value.trim()); showToast('Código copiado. Guárdalo en un lugar seguro.'); }
    catch { input.focus(); input.select(); showToast('Selecciona y copia el código.'); }
  };
  bindForm('track-form',async data=>{
    orderToken = data.get('token').trim();
    await loadOrder(false);
    sessionStorage.setItem('acho.order',orderToken);
  });
  if (orderToken) {
    try { await loadOrder(created); }
    catch (err) { $('track-result').innerHTML = errorMessage(err.message); }
  }
}

async function loadOrder(created) {
  const order = await api('trackOrder',{method:'POST',data:{p_token:orderToken}});
  if (!order) { $('track-result').innerHTML=''; throw new Error('Pedido no encontrado. Revisa el código privado.'); }
  const payment = order.payment;
  const trackingDate = value => escapeHtml(new Date(value).toLocaleString('es-PE',{timeZone:'America/Lima'}));
  $('track-result').innerHTML = `<section class="panel-card">
    ${created ? '<p>Pedido confirmado. Guarda tu código privado para volver a consultarlo.</p>' : ''}
    <h3>${escapeHtml(statuses[order.status])}</h3>
    <p>${escapeHtml(order.stall)} · ${order.mode==='pickup'?'Recojo en el puesto':'Entrega a domicilio'} · Total ${money(order.total_cents)}</p>
    <p class="token">Pedido ${escapeHtml(order.id)}</p>
    ${order.mode==='pickup'?`<p>${escapeHtml(order.location)} · Código de recojo <strong>${escapeHtml(orderToken.slice(0,8))}</strong></p>`:''}
    <ul>${(order.items ?? []).map(i=>`<li>${i.quantity} × ${escapeHtml(i.name)} · ${money(i.price_cents)} por unidad</li>`).join('')}</ul>
    ${payment?`<p>Pago ${escapeHtml(statuses[payment.status])}${payment.reason?' · '+escapeHtml(payment.reason):''}</p>`:''}
    ${payment?.status === 'approved'?`<p>Constancia de transferencia · ${money(payment.amount_cents)} · Ref. ${escapeHtml(payment.reference)} · ${trackingDate(payment.date)}</p>`:''}
    <details><summary>Historial</summary><ul>${(order.events ?? []).map(e=>`<li>${escapeHtml(statuses[e.status])} · ${trackingDate(e.date)}</li>`).join('')}</ul></details>
  </section>
  ${order.status==='pending_payment'&&payment?.status!=='review'?`<form id="payment-form"><label>Referencia de transferencia simulada <input name="reference" required pattern="[A-Za-z0-9\\-]{6,32}" placeholder="DEMO123"></label><button class="primary" type="submit">Registrar pago de prueba</button><p class="error" role="alert"></p></form>`:''}`;
  if ($('payment-form')) bindForm('payment-form',async data=>{
    await api('submitPayment',{method:'POST',data:{p_token:orderToken,p_reference:data.get('reference')}});
    await loadOrder(false);
  });
}

function showLogin() {
  panel('Acceso para comerciantes', `<p>Administra los productos y pedidos de tu puesto desde aquí.</p>
  <p class="muted">Usa el correo y la contraseña asignados a tu puesto. Si aún no tienes una cuenta, solicita el acceso a la administración del proyecto.</p>
  <form id="login-form">
    <label>Correo <input type="email" name="email" autocomplete="username" required></label>
    <label>Contraseña <input id="merchant-password" type="password" name="password" autocomplete="current-password" required></label>
    <label class="checkbox"><input id="show-password" type="checkbox"> Mostrar contraseña</label>
    <button class="primary" type="submit">Iniciar sesión</button><p class="error" role="alert"></p>
  </form>`);
  $('show-password').onchange = event => { $('merchant-password').type = event.target.checked ? 'text' : 'password'; };
  bindForm('login-form',async data=>{
    const session = await api('login',{method:'POST',data:Object.fromEntries(data)});
    const nextAccess = session.access_token;
    access = nextAccess;
    try { await loadMerchant(); sessionStorage.setItem('acho.session',nextAccess); }
    catch (err) { access=''; throw err; }
  });
}

async function loadMerchant() {
  const [members,inventory,orders] = await Promise.all(
    ['member','inventory','orders'].map(name=>api(name,{session:true}))
  );
  const member = members[0];
  if (!member) throw new Error('Tu cuenta no tiene un puesto asignado.');
  const stock = inventory.filter(p=>p.stall_id===member.stall_id);
  const nextStatus = order => ({paid:'preparing',preparing:'ready',ready:order.mode==='pickup'?'picked_up':'out_for_delivery',out_for_delivery:'delivered'})[order.status];
  panel(member.stalls.name,`<div class="split"><span>${escapeHtml(member.stalls.location)}</span><button id="logout" type="button">Cerrar sesión</button></div>
    <h3>Productos</h3><button type="button" id="new-product">Añadir producto</button>
    <div>${stock.map(p=>`<div class="panel-card split"><span>${escapeHtml(p.name)} · ${p.stock} en stock · ${p.published?'Publicado':'Oculto'}</span><button type="button" data-edit="${p.id}">Editar</button></div>`).join('')}</div>
    <h3>Pedidos</h3>${orders.length ? '' : '<p class="muted">Aún no hay pedidos registrados.</p>'}
    ${orders.map((o,i)=>`<article class="panel-card"><strong>${escapeHtml(statuses[o.status])} · ${money(o.subtotal_cents+o.delivery_cents)}</strong><p class="token">${escapeHtml(o.id)}</p>
      <p>${escapeHtml(o.customer_name)} · ${escapeHtml(o.phone)} · ${escapeHtml(o.district ?? 'Recojo en el puesto')} ${escapeHtml(o.address ?? '')}</p>
      ${o.payments.find(p=>p.status==='review')?`<button type="button" data-review="${i}">Verificar pago</button>`:''}
      ${nextStatus(o)?`<button type="button" data-advance="${i}">Marcar ${escapeHtml(statuses[nextStatus(o)])}</button>`:''}</article>`).join('')}`);
  $('logout').onclick = () => { access=''; sessionStorage.removeItem('acho.session'); showLogin(); };
  $('new-product').onclick = () => renderProductForm(member.stall_id);
  content.querySelectorAll('[data-edit]').forEach(button=>{button.onclick=()=>renderProductForm(member.stall_id,stock.find(x=>x.id===Number(button.dataset.edit)));});
  content.querySelectorAll('[data-review]').forEach(button=>{button.onclick=()=>renderPaymentReview(orders[Number(button.dataset.review)]);});
  content.querySelectorAll('[data-advance]').forEach(button=>{button.onclick=()=>{const order=orders[Number(button.dataset.advance)];renderAdvance(order,nextStatus(order));};});
}

function backToMerchant() {
  $('merchant-back').onclick=()=>loadMerchant().catch(err=>showToast(err.message));
}

function renderProductForm(stallId,p) {
  panel(p?'Editar producto':'Añadir producto',`<form id="edit-form">
    <label>Nombre <input name="name" required minlength="2" maxlength="100" value="${escapeHtml(p?.name)}"></label>
    <label>Categoría <select name="category">${categories.map(c=>`<option ${c===p?.category?'selected':''}>${c}</option>`).join('')}</select></label>
    <label>Unidad de venta <input name="unit" required minlength="2" maxlength="50" value="${escapeHtml(p?.unit)}"></label>
    <label>Descripción <textarea name="description" maxlength="500">${escapeHtml(p?.description)}</textarea></label>
    <label>Precio en soles <input name="price" type="number" min="1" max="10000" step=".01" required value="${p?p.price_cents/100:''}"></label>
    <label>Stock <input name="stock" type="number" min="0" max="100000" step="1" required value="${p?.stock ?? 0}"></label>
    <label class="checkbox"><input type="checkbox" name="published" ${p?.published??true?'checked':''}> Publicado</label>
    <div class="actions"><button type="submit" class="primary">Guardar</button><button type="button" id="merchant-back">Volver</button></div><p class="error" role="alert"></p></form>`);
  backToMerchant();
  bindForm('edit-form',async data=>{
    const rows=await api('saveProduct',{method:p?'PATCH':'POST',id:p?.id,session:true,data:{
      stall_id:stallId,name:data.get('name').trim(),category:data.get('category'),unit:data.get('unit').trim(),
      description:data.get('description').trim(),price_cents:Math.round(Number(data.get('price'))*100),
      stock:Number(data.get('stock')),published:data.has('published')
    }});
    if (!rows.length) throw new Error('El producto no está disponible para editar.');
    await Promise.all([loadMerchant(),loadCatalog()]);
  });
}

function renderPaymentReview(order) {
  const payment=order.payments.find(x=>x.status==='review');
  panel('Conciliar pago de prueba',`<p>Referencia ${escapeHtml(payment.reference)} · Importe ${money(payment.amount_cents)}</p>
    <form id="review-form"><label>Resultado <select name="approve"><option value="yes">Aprobar</option><option value="no">Rechazar</option></select></label>
      <label>Motivo en caso de rechazo <input name="reason" maxlength="200"></label>
      <div class="actions"><button class="primary" type="submit">Guardar</button><button type="button" id="merchant-back">Volver</button></div><p class="error" role="alert"></p></form>`);
  backToMerchant();
  bindForm('review-form',async data=>{
    await api('reviewPayment',{method:'POST',session:true,data:{p_order:order.id,p_payment:payment.id,p_approve:data.get('approve')==='yes',p_reason:data.get('reason')}});
    await loadMerchant();
  });
}

function renderAdvance(order,next) {
  panel('Actualizar pedido',`<p>Nuevo estado: ${escapeHtml(statuses[next])}</p><form id="advance-form">
    ${next==='picked_up'?'<label>Código que presenta el comprador <input name="code" required pattern="[A-Fa-f0-9]{8}"></label>':''}
    <div class="actions"><button class="primary" type="submit">Confirmar</button><button type="button" id="merchant-back">Volver</button></div><p class="error" role="alert"></p></form>`);
  backToMerchant();
  bindForm('advance-form',async data=>{
    await api('advanceOrder',{method:'POST',session:true,data:{p_order:order.id,p_status:next,p_pickup_code:data.get('code')}});
    await loadMerchant();
  });
}

$('close-panel').onclick = () => dialog.close();
for (const id of ['search','category','stall']) $(id).addEventListener('input',renderCatalog);
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if (!button) return;
  const {open,buy,detail:detailId,remove}=button.dataset;
  if (detailId) detail(Number(detailId));
  if (buy) {
    const p=products.find(row=>row.id===Number(buy));
    try { items=addToCart(items,p); requestId=crypto.randomUUID(); updateCount(); showToast('Producto agregado al carrito.'); if(dialog.open)renderCart(); }
    catch(err){showToast(err.message);}
  }
  if (remove) { items=items.filter(row=>row.product.id!==Number(remove)); requestId=crypto.randomUUID(); updateCount(); renderCart(); }
  if (open==='carrito') renderCart();
  if (open==='seguimiento') void renderTracking();
  if (open==='puesto') {
    if (!access) showLogin();
    else void loadMerchant().catch(err=>{access='';sessionStorage.removeItem('acho.session');showLogin();showToast(err.message);});
  }
});
content.addEventListener('change',event=>{
  const id=Number(event.target.dataset.quantity);
  if (!id) return;
  const row=items.find(x=>x.product.id===id);
  try { items=setQuantity(items,row.product,event.target.valueAsNumber); requestId=crypto.randomUUID();updateCount();renderCart(); }
  catch(err){event.target.value=row.quantity;showToast(err.message);}
});
void loadCatalog();
