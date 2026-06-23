#!/usr/bin/env node
/**
 * Load Generator — E-Commerce Traffic Simulator
 *
 * Simula usuários reais navegando, comprando e interagindo com o E-Commerce.
 * Gera métricas e logs continuamente para testar a stack de observabilidade.
 *
 * Configuração via env vars:
 *   BASE_URL   — URL da API (default: http://localhost:3001)
 *   USERS      — Número de usuários simultâneos (default: 3)
 *   RATE       — Atraso médio entre ações em ms (default: 1500)
 *   DURATION   — Duração em segundos (default: 60, 0 = infinito)
 *   ABANDON_RATE — Taxa de abandono de carrinho 0-1 (default: 0.3)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const MAX_USERS = parseInt(process.env.USERS, 10) || 3;
const ACTION_DELAY = parseInt(process.env.RATE, 10) || 1500;
const MAX_DURATION = parseInt(process.env.DURATION, 10) || 60;
const ABANDON_RATE = parseFloat(process.env.ABANDON_RATE || '0.3');

const http = require('http');
const urlMod = require('url');

let running = true;
let totalRequests = 0;
let totalErrors = 0;
const startTime = Date.now();

function log(msg) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] [LOADGEN] ${msg}`);
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        totalRequests++;
        const url = `${BASE_URL}${path}`;
        const parsed = urlMod.parse(url);

        const options = {
            hostname: parsed.hostname,
            port: parsed.port || 80,
            path: parsed.path,
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                if (res.statusCode >= 400) totalErrors++;
                resolve({ status: res.statusCode, body: data, headers: res.headers });
            });
        });

        req.on('error', (err) => { totalErrors++; reject(err); });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// ─── User Session ──────────────────────────────────────────────────────────

async function userSession(userId) {
    const username = `loaduser_${userId}`;
    const password = 'loadtest123';

    // Register user (ignore if already exists)
    try {
        const r = await request('POST', '/register', { username, password });
        if (r.status === 201) log(`User ${username} registered`);
        else log(`User ${username} login ok`);
    } catch {
        log(`User ${username} auth error`);
        return;
    }

    // Get user ID
    let uid = userId;
    try {
        const r = await request('GET', '/users');
        const users = JSON.parse(r.body);
        const u = users.find(x => x.username === username);
        if (u) uid = u.id;
    } catch {}

    const headers = { 'Content-Type': 'application/json', 'X-User-Id': String(uid) };

    // 1. Browse catalog
    try {
        const r = await request('GET', '/api/products');
        log(`User ${username}: catalog loaded (${JSON.parse(r.body).length} products)`);
    } catch { log(`User ${username}: catalog error`); }
    await sleep(randomInt(500, ACTION_DELAY));

    // 2. Get categories and browse some products
    let categories = [];
    try {
        const r = await request('GET', '/api/categories');
        categories = JSON.parse(r.body);
    } catch {}
    if (categories.length > 0) {
        const cat = pick(categories);
        try {
            const r = await request('GET', `/api/products?categoria=${cat.id}`);
            log(`User ${username}: filtered by "${cat.nome}" (${JSON.parse(r.body).length} products)`);
        } catch {}
        await sleep(randomInt(300, ACTION_DELAY));
    }

    // 3. View 1-3 product details
    let products = [];
    try {
        const r = await request('GET', '/api/products');
        products = JSON.parse(r.body).filter(p => p.estoque > 0);
    } catch {}

    const viewCount = Math.min(randomInt(1, 3), products.length);
    const viewed = [];

    for (let i = 0; i < viewCount && products.length > 0; i++) {
        const p = pick(products);
        viewed.push(p);
        products = products.filter(x => x.id !== p.id);
        try { await request('GET', `/api/products/${p.id}`); } catch {}
        log(`User ${username}: viewed product "${p.nome}"`);
        await sleep(randomInt(300, ACTION_DELAY));
    }

    if (viewed.length === 0) return;

    // 4. Add 1-4 items to cart (from viewed products)
    const addCount = randomInt(1, Math.min(4, viewed.length));

    for (let i = 0; i < addCount; i++) {
        const p = viewed[i];
        const qty = randomInt(1, Math.min(3, p.estoque || 3));
        try {
            await request('POST', '/api/cart/add', { productId: p.id, quantity: qty });
            log(`User ${username}: added ${p.nome} x${qty} to cart`);
        } catch {}
        await sleep(randomInt(200, ACTION_DELAY));
    }

    // 5. 30% chance to abandon cart
    if (Math.random() < ABANDON_RATE) {
        log(`User ${username}: abandoned cart`);
        return;
    }

    // 6. Checkout
    try {
        const r = await request('POST', '/api/checkout', { userId: uid });
        if (r.status === 201) {
            const data = JSON.parse(r.body);
            log(`User ${username}: CHECKOUT OK — Order #${data.order.id} (R$${data.order.total})`);

            // 7. Check orders
            await sleep(randomInt(300, 500));
            try {
                const o = await request('GET', '/api/orders');
                log(`User ${username}: ${JSON.parse(o.body).length} order(s)`);
            } catch {}
        } else {
            log(`User ${username}: checkout failed (${r.status})`);
        }
    } catch {
        log(`User ${username}: checkout error`);
    }
}

// ─── Main Loop ─────────────────────────────────────────────────────────────

async function main() {
    log(`Load Generator started`);
    log(`  Target: ${BASE_URL}`);
    log(`  Users: ${MAX_USERS}`);
    log(`  Rate: ${ACTION_DELAY}ms`);
    log(`  Duration: ${MAX_DURATION > 0 ? MAX_DURATION + 's' : 'infinite'}`);
    log(`  Abandon rate: ${ABANDON_RATE * 100}%`);
    log('');

    process.on('SIGTERM', () => {
        log('SIGTERM received — shutting down gracefully...');
        running = false;
    });
    process.on('SIGINT', () => {
        log('SIGINT received — shutting down...');
        running = false;
    });

    let cycleCount = 0;
    const deadline = MAX_DURATION > 0 ? Date.now() + MAX_DURATION * 1000 : Infinity;

    while (running && Date.now() < deadline) {
        cycleCount++;
        log(`--- Cycle ${cycleCount} ---`);

        const promises = [];
        for (let i = 1; i <= MAX_USERS; i++) {
            promises.push(userSession(i).catch(() => {}));
        }
        await Promise.all(promises);

        // Report
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log(`--- Cycle ${cycleCount} complete (${elapsed}s elapsed) ---`);
        log(`  Total requests: ${totalRequests} | Errors: ${totalErrors}`);

        if (Date.now() < deadline && running) {
            const pause = randomInt(1000, 3000);
            log(`  Waiting ${pause}ms before next cycle...`);
            await sleep(pause);
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log('');
    log(`Load Generator finished — ${elapsed}s total`);
    log(`  Total requests: ${totalRequests}`);
    log(`  Total errors: ${totalErrors}`);
    process.exit(0);
}

main().catch(err => {
    console.error('Load Generator fatal error:', err);
    process.exit(1);
});
