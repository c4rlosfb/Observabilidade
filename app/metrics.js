/**
 * Métricas de Negócio Customizadas — E-Commerce
 * Todas as métricas usam prefixo `ecommerce_` para o Prometheus.
 */

const promClient = require('prom-client');

// ─── VENDAS ────────────────────────────────────────────────────────────────
const ordersTotal = new promClient.Counter({
    name: 'ecommerce_orders_total',
    help: 'Total de pedidos realizados',
    labelNames: ['status']
});

const revenueTotal = new promClient.Counter({
    name: 'ecommerce_revenue_total',
    help: 'Receita acumulada total (R$)'
});

const orderValueHistogram = new promClient.Histogram({
    name: 'ecommerce_order_value_seconds',
    help: 'Distribuição do valor dos pedidos',
    labelNames: [],
    buckets: [10, 50, 100, 200, 500, 1000]
});

// ─── CARRINHO ──────────────────────────────────────────────────────────────
const cartAbandonmentTotal = new promClient.Counter({
    name: 'ecommerce_cart_abandonment_total',
    help: 'Total de carrinhos abandonados',
    labelNames: []
});

const cartItemsGauge = new promClient.Gauge({
    name: 'ecommerce_cart_items_total',
    help: 'Número total de itens nos carrinhos ativos'
});

// ─── ESTOQUE ───────────────────────────────────────────────────────────────
const stockLevel = new promClient.Gauge({
    name: 'ecommerce_stock_level',
    help: 'Nível de estoque por produto',
    labelNames: ['product_id', 'product_name']
});

const lowStockEvents = new promClient.Counter({
    name: 'ecommerce_low_stock_events_total',
    help: 'Total de eventos de estoque baixo (< 5 unidades)',
    labelNames: ['product_id', 'product_name']
});

// ─── PERFORMANCE ───────────────────────────────────────────────────────────
const checkoutDurationSeconds = new promClient.Histogram({
    name: 'ecommerce_checkout_duration_seconds',
    help: 'Duração do processo de checkout em segundos',
    labelNames: [],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const paymentErrorsTotal = new promClient.Counter({
    name: 'ecommerce_payment_errors_total',
    help: 'Total de erros de pagamento',
    labelNames: ['reason']
});

// ─── ENGAJAMENTO ───────────────────────────────────────────────────────────
const productViewsTotal = new promClient.Counter({
    name: 'ecommerce_product_views_total',
    help: 'Total de visualizações de produtos',
    labelNames: ['product_id']
});

const activeUsersGauge = new promClient.Gauge({
    name: 'ecommerce_active_users_gauge',
    help: 'Número de usuários ativos no momento'
});

// ─── MÉTRICAS DE ESTOQUE — atualizar de todos os produtos ─────────────────
function updateStockMetrics(products) {
    products.forEach(p => {
        stockLevel.set({ product_id: String(p.id), product_name: p.nome }, p.estoque);
    });
}

function checkLowStock(product) {
    if (product.estoque < 5) {
        lowStockEvents.inc({ product_id: String(product.id), product_name: product.nome });
    }
}

// ─── MÉTRICAS DE USUÁRIOS ATIVOS ─────────────────────────────────────────
const activeTimestamps = new Map(); // userId → timestamp

function trackUserActivity(userId) {
    if (userId) {
        activeTimestamps.set(userId, Date.now());
    }
    // Clean up stale entries (older than 5 minutes)
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [uid, ts] of activeTimestamps) {
        if (ts < cutoff) activeTimestamps.delete(uid);
    }
    activeUsersGauge.set(activeTimestamps.size);
}

module.exports = {
    // Vendas
    ordersTotal,
    revenueTotal,
    orderValueHistogram,
    // Carrinho
    cartAbandonmentTotal,
    cartItemsGauge,
    // Estoque
    stockLevel,
    lowStockEvents,
    updateStockMetrics,
    checkLowStock,
    // Performance
    checkoutDurationSeconds,
    paymentErrorsTotal,
    // Engajamento
    productViewsTotal,
    activeUsersGauge,
    trackUserActivity
};
