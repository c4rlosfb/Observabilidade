/**
 * Carrinho, Checkout e Pedidos — E-Commerce
 */
const { Router } = require('express');
const { products } = require('./catalog');
const metrics = require('./metrics');

const carts = {};
const orders = {};
let nextOrderId = 1;
let nextCartItemId = 1;
const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];

function log(level, msg) { console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] [Checkout] ${msg}`); }
function getCart(uid) { if (!carts[uid]) carts[uid] = []; return carts[uid]; }
function calcTotal(c) { return c.reduce((s, i) => s + i.price * i.quantity, 0); }
function fmtCart(c) {
    return { items: c.map(i => ({ cartItemId: i.cartItemId, productId: i.productId, productName: i.productName, price: i.price, quantity: i.quantity, subtotal: +(i.price * i.quantity).toFixed(2) })), total: +calcTotal(c).toFixed(2), totalItems: c.reduce((s, i) => s + i.quantity, 0) };
}

const router = Router();
router.use((req, _r, n) => { req.userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : (req.body && req.body.userId ? parseInt(req.body.userId, 10) : null); n(); });

// ─── CARRINHO ──────────────────────────────────────────────────────────────
router.get('/cart', (req, res) => {
    if (!req.userId) return res.status(400).json({ error: 'X-User-Id header required' });
    metrics.trackUserActivity(req.userId);
    const cart = getCart(req.userId);
    metrics.cartItemsGauge.set(cart.reduce((s, i) => s + i.quantity, 0));
    res.json(fmtCart(cart));
});

router.post('/cart/add', (req, res) => {
    if (!req.userId) return res.status(400).json({ error: 'userId required' });
    metrics.trackUserActivity(req.userId);
    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity < 1) return res.status(400).json({ error: 'productId e quantity (>=1) obrigatórios' });
    const p = products.find(x => x.id === parseInt(productId, 10));
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    if (p.estoque < parseInt(quantity, 10)) return res.status(400).json({ error: `Estoque insuficiente (disp: ${p.estoque})` });
    const cart = getCart(req.userId);
    const q = parseInt(quantity, 10);
    const ex = cart.find(i => i.productId === p.id);
    if (ex) ex.quantity += q;
    else cart.push({ cartItemId: nextCartItemId++, productId: p.id, productName: p.nome, price: p.preco, quantity: q });
    metrics.cartItemsGauge.set(cart.reduce((s, i) => s + i.quantity, 0));
    res.json(fmtCart(cart));
});

router.put('/cart/update/:itemId', (req, res) => {
    if (!req.userId) return res.status(400).json({ error: 'X-User-Id required' });
    const cart = getCart(req.userId);
    const idx = cart.findIndex(i => i.cartItemId === parseInt(req.params.itemId, 10));
    if (idx === -1) return res.status(404).json({ error: 'Item não encontrado' });
    const q = parseInt(req.body.quantity, 10);
    if (q <= 0) cart.splice(idx, 1);
    else cart[idx].quantity = q;
    metrics.cartItemsGauge.set(cart.reduce((s, i) => s + i.quantity, 0));
    res.json(fmtCart(cart));
});

router.delete('/cart/remove/:itemId', (req, res) => {
    if (!req.userId) return res.status(400).json({ error: 'X-User-Id required' });
    const cart = getCart(req.userId);
    const idx = cart.findIndex(i => i.cartItemId === parseInt(req.params.itemId, 10));
    if (idx === -1) return res.status(404).json({ error: 'Item não encontrado' });
    cart.splice(idx, 1);
    metrics.cartItemsGauge.set(cart.reduce((s, i) => s + i.quantity, 0));
    res.json(fmtCart(cart));
});

// ─── CHECKOUT ──────────────────────────────────────────────────────────────
router.post('/checkout', (req, res) => {
    if (!req.userId) return res.status(400).json({ error: 'userId required' });
    metrics.trackUserActivity(req.userId);
    const cart = getCart(req.userId);
    if (cart.length === 0) return res.status(400).json({ error: 'Carrinho vazio' });

    for (const item of cart) {
        const p = products.find(x => x.id === item.productId);
        if (!p) return res.status(400).json({ error: `Produto "${item.productName}" indisponível` });
        if (p.estoque < item.quantity) return res.status(400).json({ error: `Estoque insuficiente para "${item.productName}" (disp: ${p.estoque})` });
    }

    const startTime = Date.now();

    // 10% de falha no pagamento
    if (Math.random() < 0.1) {
        metrics.paymentErrorsTotal.inc({ reason: 'payment_declined' });
        metrics.cartAbandonmentTotal.inc();
        return res.status(402).json({ error: 'Pagamento recusado' });
    }

    const orderItems = cart.map(i => ({ productId: i.productId, productName: i.productName, price: i.price, quantity: i.quantity, subtotal: +(i.price * i.quantity).toFixed(2) }));
    const total = +calcTotal(cart).toFixed(2);
    const order = { id: nextOrderId++, userId: req.userId, items: orderItems, total, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (!orders[req.userId]) orders[req.userId] = [];
    orders[req.userId].push(order);

    for (const item of cart) {
        const p = products.find(x => x.id === item.productId);
        if (p) {
            p.estoque -= item.quantity;
            metrics.stockLevel.set({ product_id: String(p.id), product_name: p.nome }, p.estoque);
            metrics.checkLowStock(p);
        }
    }

    // Métricas
    metrics.ordersTotal.inc({ status: 'pending' });
    metrics.revenueTotal.inc(total);
    metrics.orderValueHistogram.observe(total);
    metrics.cartItemsGauge.set(0);

    const duration = (Date.now() - startTime) / 1000;
    metrics.checkoutDurationSeconds.observe(duration);

    carts[req.userId] = [];
    log('info', `Pedido #${order.id} user ${req.userId}: R$${total}`);
    res.status(201).json({ message: 'Pedido realizado!', order: { id: order.id, total, status: order.status, items: orderItems.length, createdAt: order.createdAt } });
});

// ─── PEDIDOS ───────────────────────────────────────────────────────────────
router.get('/orders', (req, res) => {
    if (!req.userId) return res.status(400).json({ error: 'X-User-Id required' });
    metrics.trackUserActivity(req.userId);
    const uo = orders[req.userId] || [];
    res.json(uo.map(o => ({ id: o.id, total: o.total, status: o.status, itemsCount: o.items.length, createdAt: o.createdAt, updatedAt: o.updatedAt })));
});

router.get('/orders/:id', (req, res) => {
    if (!req.userId) return res.status(400).json({ error: 'X-User-Id required' });
    const uo = orders[req.userId] || [];
    const o = uo.find(x => x.id === parseInt(req.params.id, 10));
    if (!o) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json(o);
});

router.patch('/orders/:id/status', (req, res) => {
    if (!req.userId) return res.status(400).json({ error: 'X-User-Id required' });
    let order = null;
    for (const uid of Object.keys(orders)) {
        const found = orders[uid].find(o => o.id === parseInt(req.params.id, 10));
        if (found) { order = found; break; }
    }
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    const idx = ORDER_STATUSES.indexOf(order.status);
    if (idx >= ORDER_STATUSES.length - 1) return res.status(400).json({ error: `Já está no status final: ${order.status}` });
    const oldStatus = order.status;
    order.status = ORDER_STATUSES[idx + 1];
    order.updatedAt = new Date().toISOString();
    metrics.ordersTotal.inc({ status: order.status });
    log('info', `Pedido #${order.id}: status ${oldStatus} → ${order.status}`);
    res.json({ id: order.id, status: order.status, updatedAt: order.updatedAt });
});

module.exports = { router, carts, orders, ORDER_STATUSES };
