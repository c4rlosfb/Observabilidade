/**
 * Catálogo de Produtos — E-Commerce
 * Dados em memória, CRUD completo, categorias e estoque.
 */

const { Router } = require('express');
const metrics = require('./metrics');

// ─── Dados em Memória ──────────────────────────────────────────────────────
let nextCategoryId = 1;
let nextProductId = 1;

const categories = [
    { id: nextCategoryId++, nome: 'Eletrônicos', descricao: 'Gadgets, dispositivos e tecnologia' },
    { id: nextCategoryId++, nome: 'Roupas', descricao: 'Moda masculina e feminina' },
    { id: nextCategoryId++, nome: 'Casa & Cozinha', descricao: 'Utensílios e decoração' },
    { id: nextCategoryId++, nome: 'Livros', descricao: 'Livros físicos e digitais' }
];

const products = [
    { id: nextProductId++, nome: 'Smartphone XYZ Pro', descricao: 'Smartphone top de linha 256GB, 5G, câmera 108MP', preco: 3999.99, categoriaId: 1, estoque: 25, imagemUrl: 'https://placehold.co/200x200?text=Smartphone', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Fone Bluetooth MaxSound', descricao: 'Headphone wireless com cancelamento de ruído ativo', preco: 599.90, categoriaId: 1, estoque: 50, imagemUrl: 'https://placehold.co/200x200?text=Fone', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Notebook Ultra 15"', descricao: 'Notebook 15.6" i7, 16GB RAM, SSD 512GB', preco: 5499.00, categoriaId: 1, estoque: 12, imagemUrl: 'https://placehold.co/200x200?text=Notebook', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Smartwatch FitTrack', descricao: 'Relógio inteligente com GPS, monitor cardíaco e sono', preco: 899.00, categoriaId: 1, estoque: 3, imagemUrl: 'https://placehold.co/200x200?text=Smartwatch', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Camiseta Algodão Premium', descricao: 'Camiseta 100% algodão penteado, conforto e durabilidade', preco: 79.90, categoriaId: 2, estoque: 100, imagemUrl: 'https://placehold.co/200x200?text=Camiseta', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Jaqueta Corta-Vento Esportiva', descricao: 'Jaqueta leve, impermeável e resistente para atividades ao ar livre', preco: 249.90, categoriaId: 2, estoque: 35, imagemUrl: 'https://placehold.co/200x200?text=Jaqueta', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Tênis Runner Air', descricao: 'Tênis de corrida com amortecimento Air e solado antiderrapante', preco: 399.90, categoriaId: 2, estoque: 40, imagemUrl: 'https://placehold.co/200x200?text=Tenis', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Calça Jeans Slim Fit', descricao: 'Calça jeans moderno, corte slim, confortável', preco: 189.90, categoriaId: 2, estoque: 60, imagemUrl: 'https://placehold.co/200x200?text=Calca', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Kit Panelas Antiaderentes', descricao: 'Jogo de panelas 5 peças em alumínio forjado com revestimento cerâmico', preco: 349.90, categoriaId: 3, estoque: 18, imagemUrl: 'https://placehold.co/200x200?text=Panelas', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Luminária LED Inteligente', descricao: 'Lâmpada smart RGB com controle por app e Alexa', preco: 129.90, categoriaId: 3, estoque: 45, imagemUrl: 'https://placehold.co/200x200?text=Luminaria', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Jogo de Cama King Size', descricao: 'Conjunto 4 peças: lençol, fronhas e edredom em microfibra', preco: 219.90, categoriaId: 3, estoque: 20, imagemUrl: 'https://placehold.co/200x200?text=Cama', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Cafeteira Express Gourmet', descricao: 'Cafeteira espresso automática 15 BARs com reservatório 1.5L', preco: 599.00, categoriaId: 3, estoque: 2, imagemUrl: 'https://placehold.co/200x200?text=Cafeteira', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Livro — Código Limpo', descricao: 'Robert C. Martin — Um guia prático para código sustentável', preco: 79.90, categoriaId: 4, estoque: 30, imagemUrl: 'https://placehold.co/200x200?text=CodLimpo', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Livro — Entendendo Algoritmos', descricao: 'Aditya Bhargava — Guia ilustrado para programadores', preco: 69.90, categoriaId: 4, estoque: 25, imagemUrl: 'https://placehold.co/200x200?text=Algoritmos', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Livro — Domain-Driven Design', descricao: 'Eric Evans — Modelagem de domínios complexos', preco: 129.90, categoriaId: 4, estoque: 15, imagemUrl: 'https://placehold.co/200x200?text=DDD', criadoEm: new Date().toISOString() },
    { id: nextProductId++, nome: 'Livro — A Arte da Guerra', descricao: 'Sun Tzu — Estratégia clássica aplicada aos negócios', preco: 34.90, categoriaId: 4, estoque: 8, imagemUrl: 'https://placehold.co/200x200?text=Guerra', criadoEm: new Date().toISOString() }
];

// Initialize stock metrics
metrics.updateStockMetrics(products);

function log(level, msg) { console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] [Catalogo] ${msg}`); }

const router = Router();

// CATEGORIAS
router.get('/categories', (_req, res) => { log('info', 'Listando categorias'); res.json(categories); });
router.post('/categories', (req, res) => {
    const { nome, descricao } = req.body;
    if (!nome || !descricao) return res.status(400).json({ error: 'nome e descricao são obrigatórios' });
    const c = { id: nextCategoryId++, nome, descricao };
    categories.push(c);
    log('info', `Categoria criada: ${nome}`);
    res.status(201).json(c);
});

// PRODUTOS
router.get('/products', (req, res) => {
    let r = [...products];
    if (req.query.categoria) r = r.filter(p => p.categoriaId === parseInt(req.query.categoria, 10));
    if (req.query.busca) {
        const t = req.query.busca.toLowerCase();
        r = r.filter(p => p.nome.toLowerCase().includes(t) || p.descricao.toLowerCase().includes(t));
    }
    res.json(r);
});

router.get('/products/:id', (req, res) => {
    const p = products.find(x => x.id === parseInt(req.params.id, 10));
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    // Métrica: visualização de produto
    metrics.productViewsTotal.inc({ product_id: String(p.id) });
    metrics.trackUserActivity(req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null);
    res.json(p);
});

router.post('/products', (req, res) => {
    const { nome, descricao, preco, categoriaId, estoque, imagemUrl } = req.body;
    if (!nome || descricao === undefined || preco === undefined || !categoriaId)
        return res.status(400).json({ error: 'nome, descricao, preco e categoriaId obrigatórios' });
    if (!categories.find(c => c.id === parseInt(categoriaId, 10)))
        return res.status(400).json({ error: 'Categoria não existe' });
    const p = { id: nextProductId++, nome, descricao, preco: parseFloat(preco), categoriaId: parseInt(categoriaId, 10), estoque: estoque !== undefined ? parseInt(estoque, 10) : 0, imagemUrl: imagemUrl || `https://placehold.co/200x200?text=${encodeURIComponent(nome.slice(0,10))}`, criadoEm: new Date().toISOString() };
    products.push(p);
    metrics.stockLevel.set({ product_id: String(p.id), product_name: p.nome }, p.estoque);
    log('info', `Produto criado: ${p.nome}`);
    res.status(201).json(p);
});

router.put('/products/:id', (req, res) => {
    const p = products.find(x => x.id === parseInt(req.params.id, 10));
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    const { nome, descricao, preco, categoriaId, estoque, imagemUrl } = req.body;
    if (nome !== undefined) p.nome = nome;
    if (descricao !== undefined) p.descricao = descricao;
    if (preco !== undefined) p.preco = parseFloat(preco);
    if (categoriaId !== undefined) {
        if (!categories.find(c => c.id === parseInt(categoriaId, 10)))
            return res.status(400).json({ error: 'Categoria não existe' });
        p.categoriaId = parseInt(categoriaId, 10);
    }
    if (estoque !== undefined) {
        p.estoque = parseInt(estoque, 10);
        metrics.stockLevel.set({ product_id: String(p.id), product_name: p.nome }, p.estoque);
        metrics.checkLowStock(p);
    }
    if (imagemUrl !== undefined) p.imagemUrl = imagemUrl;
    log('info', `Produto atualizado: ${p.nome}`);
    res.json(p);
});

router.delete('/products/:id', (req, res) => {
    const idx = products.findIndex(p => p.id === parseInt(req.params.id, 10));
    if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado' });
    products.splice(idx, 1);
    res.status(204).send();
});

router.patch('/products/:id/stock', (req, res) => {
    const p = products.find(x => x.id === parseInt(req.params.id, 10));
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    const { quantidade } = req.body;
    if (quantidade === undefined || !Number.isInteger(quantidade) || quantidade < 0)
        return res.status(400).json({ error: 'quantidade inválida' });
    p.estoque = quantidade;
    metrics.stockLevel.set({ product_id: String(p.id), product_name: p.nome }, p.estoque);
    metrics.checkLowStock(p);
    res.json({ id: p.id, nome: p.nome, estoque: p.estoque });
});

module.exports = { router, categories, products, log };
