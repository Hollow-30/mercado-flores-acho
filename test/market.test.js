import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, setQuantity, subtotal, filterCatalog } from '../public/cart.js';
import { resolveRoute, normalizeError } from '../lib/routes.js';

const rose = {id:1,stall_id:4,name:'Rosas rosadas',category:'Rosas',stock:3,price_cents:3200,stalls:{name:'Jardín de Acho'}};
const sunflower = {id:2,stall_id:5,name:'Girasol',category:'Girasoles',stock:5,price_cents:2800,stalls:{name:'Sol'}};

test('carrito calcula el subtotal en céntimos y permite quitar productos',() => {
  const rows=addToCart([],rose,2);
  assert.equal(subtotal(rows),6400);
  assert.deepEqual(setQuantity(rows,rose,0),[]);
});
test('carrito rechaza cantidades mayores al stock y mezcla de puestos',() => {
  const rows=addToCart([],rose,2);
  assert.throws(()=>addToCart(rows,rose,2),/stock/);
  assert.throws(()=>addToCart(rows,sunflower),/solo puesto/);
  assert.equal(subtotal(rows),6400);
});
test('catálogo combina categoría, puesto y búsqueda sin tildes',() => {
  assert.deepEqual(filterCatalog([rose,sunflower],'Rosas','jardin',4),[rose]);
  assert.deepEqual(filterCatalog([rose,sunflower],'Girasoles','jardin',4),[]);
});
test('API exige sesión para consultar pedidos y actualizar pagos',() => {
  assert.equal(resolveRoute('orders','GET').status,401);
  assert.equal(resolveRoute('reviewPayment','POST',undefined,'Bearer inválido').status,401);
  assert.equal(resolveRoute('reviewPayment','POST',undefined,'Bearer a.b.c').path,'/rest/v1/rpc/review_payment');
});
test('API permite solamente operaciones definidas y rechaza parámetros ajenos',() => {
  assert.equal(resolveRoute('constructor','GET').status,404);
  assert.equal(resolveRoute('createOrder','GET').status,405);
  assert.equal(resolveRoute('saveProduct','PATCH','1&select=*','Bearer a.b.c').status,400);
  assert.match(resolveRoute('saveProduct','PATCH','10','Bearer a.b.c').path,/id=eq\.10$/);
});
test('API oculta errores internos de la base de datos',() => {
  assert.equal(normalizeError({message:'private column'},500),'Servicio temporalmente no disponible.');
  assert.equal(normalizeError({code:'P0001',message:'Stock insuficiente'},400),'Stock insuficiente');
});
