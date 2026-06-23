const express = require('express');
const promClient = require('prom-client');
const path = require('path');
const { Worker } = require('worker_threads');
const os = require('os');
const crypto = require('crypto');
const { createLogger, requestLoggerMiddleware } = require('./logger');

const app = express();
const logger = createLogger('app');

// ─── JWT Helpers (crypto nativo, sem dependência extra) ─────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'obs-lab-secret-change-in-production';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas

function base64url(buf) { return buf.toString('base64url'); }
function base64urlDecode(str) { return Buffer.from(str, 'base64url'); }

function generateToken(payload) {
    const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const body = base64url(Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + TOKEN_EXPIRY, iat: Date.now() })));
    const signature = base64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
    return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
    try {
        const [headerB64, bodyB64, sigB64] = token.split('.');
        const expectedSig = base64url(crypto.createHmac('sha256', JWT_SECRET).update(`${headerB64}.${bodyB64}`).digest());
        if (expectedSig !== sigB64) return null;
        const payload = JSON.parse(base64urlDecode(bodyB64).toString('utf8'));
        if (payload.exp < Date.now()) return null;
        return payload;
    } catch { return null; }
}

app.use(express.json());
app.set('json spaces', 2); // Deixa o output do JSON formatado e com quebra de linha no curl
app.use(express.static(path.join(__dirname, 'public')));

// ─── Middleware de Autenticação JWT ─────────────────────────────────────────
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // rotas públicas continuam sem autenticação
    }
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (payload) {
        req.userId = payload.id;
        req.userRole = payload.role;
        req.username = payload.username;
    }
    next();
};

const requireAuth = (req, res, next) => {
    if (!req.userId) {
        return res.status(401).json({ error: 'Token de autenticação inválido ou expirado' });
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.userId) {
        return res.status(401).json({ error: 'Autenticação necessária' });
    }
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }
    next();
};

app.use(authMiddleware);

// ─── Middleware de Log Estruturado ──────────────────────────────────────────
app.use(requestLoggerMiddleware(logger));

// ─── Módulo de Catálogo (Produtos & Categorias) ───────────────────────────
const catalogRouter = require('./catalog').router;
app.use('/api', catalogRouter);

// ─── Módulo de Carrinho, Checkout e Pedidos ───────────────────────────────
const checkoutRouter = require('./checkout').router;
app.use('/api', checkoutRouter);

// ─── Métricas de Negócio ───────────────────────────────────────────────────
const bizMetrics = require('./metrics');
setInterval(() => {
    const { products } = require('./catalog');
    bizMetrics.updateStockMetrics(products);
    bizMetrics.trackUserActivity(null);
}, 30000);

// Registro de métricas Prometheus
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'node_app_' });

// Métrica customizada: requisições HTTP
const httpRequestsTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total de requisições HTTP',
    labelNames: ['method', 'route', 'status_code']
});

// Métrica de Latência: Tempo de resposta (Histogram)
const httpRequestDurationSeconds = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duração das requisições HTTP em segundos',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 15] // Buckets de tempo em segundos
});

// Middleware para contar requisições e medir latência (Prometheus)
app.use((req, res, next) => {
    const startEpoch = Date.now();
    res.on('finish', () => {
        const responseTimeInSeconds = (Date.now() - startEpoch) / 1000;
        
        httpRequestsTotal.inc({
            method: req.method,
            route: req.path,
            status_code: res.statusCode
        });
        
        httpRequestDurationSeconds.observe({
            method: req.method,
            route: req.path,
            status_code: res.statusCode
        }, responseTimeInSeconds);
    });
    next();
});

// Rota de métricas pro Prometheus
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

// Banco em memória
const users = [];
let currentId = 1;

// Rotas CRUD e Login
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        logger.error('Falha ao registrar usuário: dados incompletos', {
            correlation_id: req.correlationId,
            method: req.method,
            route: req.path
        });
        return res.status(400).json({ error: 'Dados incompletos' });
    }
    const role = users.length === 0 ? 'admin' : 'user'; // primeiro usuário é admin
    const user = { id: currentId++, username, password, role };
    users.push(user);
    logger.info(`Usuário registrado com sucesso: ${username} (${role})`, {
        correlation_id: req.correlationId,
        method: req.method,
        route: req.path,
        user_id: user.id
    });
    res.status(201).json({ id: user.id, username, role: user.role });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        logger.error('Falha ao efetuar login: dados incompletos', {
            correlation_id: req.correlationId,
            method: req.method,
            route: req.path
        });
        return res.status(400).json({ error: 'Dados incompletos' });
    }
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        const token = generateToken({ id: user.id, username: user.username, role: user.role });
        logger.info(`Login efetuado com sucesso para o usuário: ${username}`, {
            correlation_id: req.correlationId,
            method: req.method,
            route: req.path,
            user_id: user.id
        });
        res.status(200).json({
            message: 'Login efetuado com sucesso',
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } else {
        logger.error('Login falhou para o usuário: ' + username, {
            correlation_id: req.correlationId,
            method: req.method,
            route: req.path
        });
        res.status(401).json({ error: 'Credenciais inválidas' });
    }
});

app.get('/users', requireAuth, (req, res) => {
    logger.info('Listando usuários', {
        correlation_id: req.correlationId,
        method: req.method,
        route: req.path
    });
    res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role })));
});

app.put('/users/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;
    const user = users.find(u => u.id == id);
    if (user) {
        if (username) user.username = username;
        if (password) user.password = password;
        logger.info(`Usuário ${id} atualizado com sucesso`, {
            correlation_id: req.correlationId,
            method: req.method,
            route: req.path,
            user_id: user.id
        });
        res.json({ id: user.id, username: user.username });
    } else {
        logger.error(`Falha ao atualizar: Usuário ${id} não encontrado`, {
            correlation_id: req.correlationId,
            method: req.method,
            route: req.path
        });
        res.status(404).json({ error: 'Usuário não encontrado' });
    }
});

app.delete('/users/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const index = users.findIndex(u => u.id == id);
    if (index !== -1) {
        users.splice(index, 1);
        logger.info(`Usuário ${id} deletado com sucesso`, {
            correlation_id: req.correlationId,
            method: req.method,
            route: req.path,
            user_id: parseInt(id, 10)
        });
        res.status(204).send();
    } else {
        logger.error(`Falha ao deletar: Usuário ${id} não encontrado`, {
            correlation_id: req.correlationId,
            method: req.method,
            route: req.path
        });
        res.status(404).json({ error: 'Usuário não encontrado' });
    }
});

// Gatilhos de Incidentes
app.get('/incidente-erro', (req, res) => {
    const err = new Error('Simulação de incidente de alta taxa de erro');
    logger.error('Simulação de incidente de alta taxa de erro disparada!', {
        correlation_id: req.correlationId,
        method: req.method,
        route: req.path,
        error: err
    });
    res.status(500).json({ error: 'Internal Server Error Simulado' });
});

app.get('/incidente-cpu', (req, res) => {
    const numCores = os.cpus().length;
    logger.info(`Iniciando simulação de pico de CPU em ${numCores} núcleos...`, {
        correlation_id: req.correlationId,
        method: req.method,
        route: req.path
    });
    
    let completedWorkers = 0;
    for (let i = 0; i < numCores; i++) {
        const worker = new Worker(path.join(__dirname, 'cpu-worker.js'));
        worker.on('exit', () => {
            completedWorkers++;
            if (completedWorkers === numCores) {
                logger.info('Simulação de pico de CPU finalizada.', {
                    correlation_id: req.correlationId,
                    method: req.method,
                    route: req.path
                });
            }
        });
    }
    res.status(200).json({ message: `Pico de CPU gerado em ${numCores} núcleos` });
});

app.get('/incidente-delay', (req, res) => {
    logger.info('Iniciando simulação de instabilidade (delay de 10s)...', {
        correlation_id: req.correlationId,
        method: req.method,
        route: req.path
    });
    setTimeout(() => {
        logger.info('Resposta atrasada enviada.', {
            correlation_id: req.correlationId,
            method: req.method,
            route: req.path
        });
        res.status(200).json({ message: 'Resposta com delay de 10 segundos' });
    }, 10000);
});

// Inicialização
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    logger.info(`Aplicação rodando na porta ${PORT}`);
});
