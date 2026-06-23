/**
 * Carrinho de Compras, Checkout e Pedidos — E-Commerce
 * Dados em memória vinculados ao userId.
 */

const { Router } = require('express');
const { products } = require('./catalog');
const metrics = require('./metrics');

// ─── Dados em Memória ──────────────────────────────────────────────────────
// carts: { [userId]: [{ cartItemId, productId, productName, price, quantity }] }
const carts = {};

// orders: { [userId]: [{ id, items, total, status, createdAt, updatedAt }] }
const orders = {};
let nextOrderId = 1;
let nextCartItemId = 1;

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];

// ─── Helpers ───────────────────────────────────────────────────────────────
function log(level, message) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] [${level.toUpperCase()}] [Checkout] ${message}`);
}

function getCart(userId) {
    if (!carts[userId]) {
        carts[userId] = [];
    }
    return carts[userId];
}

function calcCartTotal(cart) {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function formatCartResponse(cart) {
    const items = cart.map(item => ({
        cartItemId: item.cartItemId,
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        subtotal: parseFloat((item.price * item.quantity).toFixed(2))
    }));
    return {
        items,
        total: parseFloat(calcCartTotal(cart).toFixed(2)),
        totalItems: cart.reduce((sum, i) => sum + i.quantity, 0)
    };
}

// ─── Router ────────────────────────────────────────────────────────────────
const router = Router();

// Middleware: extrai userId do header ou body
router.use((req, _res, next) => {
    req.userId = req.headers['x-user-id']
        ? parseInt(req.headers['x-user-id'], 10)
        : (req.body && req.body.userId ? parseInt(req.body.userId, 10) : null);
    next();
});

// ─── CARRINHO ──────────────────────────────────────────────────────────────

// GET /api/cart — Visualizar carrinho
router.get('/cart', (req, res) => {
    if (!req.userId) {
        return res.status(400).json({ error: 'Informe o userId via header X-User-Id' });
    }
    const cart = getCart(req.userId);
    metrics.trackUserActivity(req.userId);
    log('info', `Visualizando carrinho do usuário ${req.userId}: ${cart.length} itens`);
    metrics.cartItemsGauge.set(cart.reduce((s, i) => s + i.quantity, 0));
    res.json(formatCartResponse(cart));
});

// POST /api/cart/add — Adicionar item ao carrinho
router.post('/cart/add', (req, res) => {
    if (!req.userId) {
        return res.status(400).json({ error: 'Informe o userId via body ou header X-User-Id' });
    }

    metrics.trackUserActivity(req.userId);

    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity < 1) {
        log('error', `Falha ao adicionar item: productId ou quantity inválidos`);
        return res.status(400).json({ error: 'productId e quantity (>= 1) são obrigatórios' });
    }

    // Verificar se o produto existe
    const produto = products.find(p => p.id === parseInt(productId, 10));
    if (!produto) {
        log('warn', `Falha ao adicionar: produto ${productId} não encontrado`);
        return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Verificar estoque
    if (produto.estoque < parseInt(quantity, 10)) {
        log('warn', `Falha ao adicionar: estoque insuficiente para produto ${productId}`);
        return res.status(400).json({ error: `Estoque insuficiente. Disponível: ${produto.estoque}` });
    }

    const cart = getCart(req.userId);
    const qtd = parseInt(quantity, 10);

    // Verificar se item já existe no carrinho
    const existingItem = cart.find(item => item.productId === produto.id);
    if (existingItem) {
        existingItem.quantity += qtd;
        log('info', `Carrinho (user ${req.userId}): quantidade atualizada do produto ${produto.nome} para ${existingItem.quantity}`);
    } else {
        const newItem = {
            cartItemId: nextCartItemId++,
            productId: produto.id,
            productName: produto.nome,
            price: produto.preco,
            quantity: qtd
        };
        cart.push(newItem);
        log('info', `Carrinho (user ${req.userId}): adicionado ${produto.nome} x${qtd}`);
    }

    metrics.cartItemsGauge.set(cart.reduce((s, i) => s + i.quantity, 0));
    res.status(200).json(formatCartResponse(cart));
});

// PUT /api/cart/update/:itemId — Atualizar quantidade de item
router.put('/cart/update/:itemId', (req, res) => {
    if (!req.userId) {
        return res.status(400).json({ error: 'Informe o userId via header X-User-Id' });
    }

    const cart = getCart(req.userId);
    const item = cart.find(i => i.cartItemId === parseInt(req.params.itemId, 10));

    if (!item) {
        log('warn', `Falha ao atualizar: item ${req.params.itemId} não encontrado no carrinho do user ${req.userId}`);
        return res.status(404).json({ error: 'Item não encontrado no carrinho' });
    }

    const { quantity } = req.body;
    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ error: 'quantity (>= 0) é obrigatório' });
    }

    const qtd = parseInt(quantity, 10);
    if (qtd === 0) {
        // Remove item se quantidade for 0
        const idx = cart.findIndex(i => i.cartItemId === item.cartItemId);
        cart.splice(idx, 1);
        log('info', `Carrinho (user ${req.userId}): removido ${item.productName} (qtd=0)`);
    } else {
        item.quantity = qtd;
        log('info', `Carrinho (user ${req.userId}): ${item.productName} quantidade atualizada para ${qtd}`);
    }

    metrics.cartItemsGauge.set(cart.reduce((s, i) => s + i.quantity, 0));
    res.json(formatCartResponse(cart));
});

// DELETE /api/cart/remove/:itemId — Remover item do carrinho
router.delete('/cart/remove/:itemId', (req, res) => {
    if (!req.userId) {
        return res.status(400).json({ error: 'Informe o userId via header X-User-Id' });
    }

    const cart = getCart(req.userId);
    const idx = cart.findIndex(i => i.cartItemId === parseInt(req.params.itemId, 10));

    if (idx === -1) {
        log('warn', `Falha ao remover: item ${req.params.itemId} não encontrado no carrinho do user ${req.userId}`);
        return res.status(404).json({ error: 'Item não encontrado no carrinho' });
    }

    const removido = cart.splice(idx, 1)[0];
    log('info', `Carrinho (user ${req.userId}): ${removido.productName} removido`);

    metrics.cartItemsGauge.set(cart.reduce((s, i) => s + i.quantity, 0));
    res.json(formatCartResponse(cart));
});

// ─── CHECKOUT ──────────────────────────────────────────────────────────────

// POST /api/checkout — Finalizar compra
router.post('/checkout', (req, res) => {
    if (!req.userId) {
        return res.status(400).json({ error: 'Informe o userId via body ou header X-User-Id' });
    }

    metrics.trackUserActivity(req.userId);
    const startTime = Date.now();

    const cart = getCart(req.userId);

    if (cart.length === 0) {
        log('warn', `Checkout (user ${req.userId}): carrinho vazio`);
        return res.status(400).json({ error: 'Carrinho vazio' });
    }

    // Validar estoque de todos os itens
    for (const item of cart) {
        const produto = products.find(p => p.id === item.productId);
        if (!produto) {
            log('error', `Checkout (user ${req.userId}): produto ${item.productId} não existe mais`);
            return res.status(400).json({ error: `Produto "${item.productName}" não está mais disponível` });
        }
        if (produto.estoque < item.quantity) {
            log('warn', `Checkout (user ${req.userId}): estoque insuficiente para ${item.productName} (disp:${produto.estoque}, req:${item.quantity})`);
            return res.status(400).json({
                error: `Estoque insuficiente para "${item.productName}". Disponível: ${produto.estoque}`
            });
        }
    }

    // Simular pagamento (delay 500ms-2s)
    const delay = 500 + Math.random() * 1500;

    // 10% de chance de falha
    const falhaPagamento = Math.random() < 0.1;

    if (falhaPagamento) {
        log('error', `Checkout (user ${req.userId}): pagamento recusado (simulação)`);
        metrics.paymentErrorsTotal.inc({ reason: 'payment_declined' });
        metrics.cartAbandonmentTotal.inc();
        return res.status(402).json({ error: 'Pagamento recusado. Tente novamente.' });
    }

    // Processar pedido
    const orderItems = cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        subtotal: parseFloat((item.price * item.quantity).toFixed(2))
    }));

    const total = parseFloat(calcCartTotal(cart).toFixed(2));

    const order = {
        id: nextOrderId++,
        userId: req.userId,
        items: orderItems,
        total,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Guardar pedido
    if (!orders[req.userId]) orders[req.userId] = [];
    orders[req.userId].push(order);

    // Abater estoque
    for (const item of cart) {
        const produto = products.find(p => p.id === item.productId);
        if (produto) {
            produto.estoque -= item.quantity;
            metrics.stockLevel.set({ product_id: String(produto.id), product_name: produto.nome }, produto.estoque);
            metrics.checkLowStock(produto);
            log('info', `Estoque abaixado: ${produto.nome} (${produto.estoque + item.quantity} → ${produto.estoque})`);
        }
    }

    // Limpar carrinho
    carts[req.userId] = [];

    // Métricas de negócio
    metrics.ordersTotal.inc({ status: 'pending' });
    metrics.revenueTotal.inc(total);
    metrics.orderValueHistogram.observe(total);
    metrics.cartItemsGauge.set(0);

    const duration = (Date.now() - startTime) / 1000;
    metrics.checkoutDurationSeconds.observe(duration);

    log('info', `Pedido #${order.id} criado para user ${req.userId}: R$${total} (${orderItems.length} itens)`);

    // Simular delay de pagamento
    setTimeout(() => {
        log('info', `Pedido #${order.id}: pagamento confirmado`);
    }, delay);

    res.status(201).json({
        message: 'Pedido realizado com sucesso!',
        order: {
            id: order.id,
            total: order.total,
            status: order.status,
            items: orderItems.length,
            createdAt: order.createdAt
        }
    });
});

// ─── PEDIDOS ───────────────────────────────────────────────────────────────

// GET /api/orders — Listar pedidos do usuário
router.get('/orders', (req, res) => {
    if (!req.userId) {
        return res.status(400).json({ error: 'Informe o userId via header X-User-Id' });
    }

    const userOrders = orders[req.userId] || [];
    metrics.trackUserActivity(req.userId);
    log('info', `Listando ${userOrders.length} pedidos do user ${req.userId}`);

    res.json(userOrders.map(o => ({
        id: o.id,
        total: o.total,
        status: o.status,
        itemsCount: o.items.length,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt
    })));
});

// GET /api/orders/:id — Detalhe do pedido
router.get('/orders/:id', (req, res) => {
    if (!req.userId) {
        return res.status(400).json({ error: 'Informe o userId via header X-User-Id' });
    }

    const userOrders = orders[req.userId] || [];
    const pedido = userOrders.find(o => o.id === parseInt(req.params.id, 10));

    if (!pedido) {
        log('warn', `Pedido ${req.params.id} não encontrado para user ${req.userId}`);
        return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    log('info', `Detalhe do pedido #${pedido.id} (user ${req.userId})`);
    res.json(pedido);
});

// PATCH /api/orders/:id/status — Avançar status
router.patch('/orders/:id/status', (req, res) => {
    if (!req.userId) {
        return res.status(400).json({ error: 'Informe o userId via header X-User-Id' });
    }

    // Procurar pedido em todos os usuários (admin-style)
    let pedido = null;
    let userKey = null;
    for (const [uid, userOrders] of Object.entries(orders)) {
        const found = userOrders.find(o => o.id === parseInt(req.params.id, 10));
        if (found) {
            pedido = found;
            userKey = uid;
            break;
        }
    }

    if (!pedido) {
        log('warn', `Falha ao atualizar status: pedido ${req.params.id} não encontrado`);
        return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const currentIdx = ORDER_STATUSES.indexOf(pedido.status);
    if (currentIdx >= ORDER_STATUSES.length - 1) {
        log('warn', `Pedido #${pedido.id}: já está no status final (${pedido.status})`);
        return res.status(400).json({ error: `Pedido já está no status final: ${pedido.status}` });
    }

    const nextStatus = ORDER_STATUSES[currentIdx + 1];
    const oldStatus = pedido.status;
    pedido.status = nextStatus;
    pedido.updatedAt = new Date().toISOString();

    metrics.ordersTotal.inc({ status: nextStatus });
    log('info', `Pedido #${pedido.id} (user ${userKey}): status avançado para "${nextStatus}"`);

    res.json({ id: pedido.id, status: pedido.status, updatedAt: pedido.updatedAt });
});

module.exports = { router, carts, orders, ORDER_STATUSES };
