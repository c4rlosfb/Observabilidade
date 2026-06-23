/**
 * Catálogo de Produtos — E-Commerce
 * Dados em memória, CRUD completo, categorias e estoque.
 */

const { Router } = require('express');
const metrics = require('./metrics');
const { createLogger } = require('./logger');

const logger = createLogger('catalog');

// ─── Dados em Memória ──────────────────────────────────────────────────────
let nextCategoryId = 1;
let nextProductId = 1;

// Categorias
const categories = [
    { id: nextCategoryId++, nome: 'Eletrônicos', descricao: 'Gadgets, dispositivos e tecnologia' },
    { id: nextCategoryId++, nome: 'Roupas', descricao: 'Moda masculina e feminina' },
    { id: nextCategoryId++, nome: 'Casa & Cozinha', descricao: 'Utensílios e decoração' },
    { id: nextCategoryId++, nome: 'Livros', descricao: 'Livros físicos e digitais' }
];

// Produtos (seed com 16 itens)
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

// ─── Helper para extrair contexto da request ────────────────────────────────
function reqCtx(req) {
    return {
        correlation_id: req.correlationId,
        method: req.method,
        route: req.path
    };
}

// ─── Router ────────────────────────────────────────────────────────────────
const router = Router();

// ─── CATEGORIAS ────────────────────────────────────────────────────────────

// GET /api/categories — Listar categorias
router.get('/categories', (req, res) => {
    logger.info('Listando categorias', reqCtx(req));
    res.json(categories);
});

// POST /api/categories — Criar categoria
router.post('/categories', (req, res) => {
    const { nome, descricao } = req.body;
    if (!nome || !descricao) {
        logger.error('Falha ao criar categoria: dados incompletos', reqCtx(req));
        return res.status(400).json({ error: 'nome e descricao são obrigatórios' });
    }

    const categoria = { id: nextCategoryId++, nome, descricao };
    categories.push(categoria);
    logger.info(`Categoria criada: ${nome} (id:${categoria.id})`, reqCtx(req));
    res.status(201).json(categoria);
});

// ─── PRODUTOS ──────────────────────────────────────────────────────────────

// GET /api/products — Listar produtos (com filtros)
router.get('/products', (req, res) => {
    const { categoria, busca } = req.query;

    let resultado = [...products];

    if (categoria) {
        const catId = parseInt(categoria, 10);
        resultado = resultado.filter(p => p.categoriaId === catId);
        logger.info(`Filtrando produtos por categoriaId: ${categoria}`, reqCtx(req));
    }

    if (busca) {
        const termo = busca.toLowerCase();
        resultado = resultado.filter(p =>
            p.nome.toLowerCase().includes(termo) ||
            p.descricao.toLowerCase().includes(termo)
        );
        logger.info(`Buscando produtos por termo: "${busca}"`, reqCtx(req));
    }

    logger.info(`Listando ${resultado.length} produtos`, reqCtx(req));
    res.json(resultado);
});

// GET /api/products/:id — Detalhe do produto
router.get('/products/:id', (req, res) => {
    const produto = products.find(p => p.id === parseInt(req.params.id, 10));
    if (!produto) {
        logger.warn(`Produto ${req.params.id} não encontrado`, reqCtx(req));
        return res.status(404).json({ error: 'Produto não encontrado' });
    }
    logger.info(`Detalhe do produto: ${produto.nome} (id:${produto.id})`, reqCtx(req));
    // Métrica: visualização de produto
    metrics.productViewsTotal.inc({ product_id: String(produto.id) });
    metrics.trackUserActivity(req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null);
    res.json(produto);
});

// POST /api/products — Criar produto (admin)
router.post('/products', (req, res) => {
    const { nome, descricao, preco, categoriaId, estoque, imagemUrl } = req.body;

    if (!nome || descricao === undefined || preco === undefined || !categoriaId) {
        logger.error('Falha ao criar produto: dados incompletos', reqCtx(req));
        return res.status(400).json({ error: 'nome, descricao, preco e categoriaId são obrigatórios' });
    }

    const catExiste = categories.find(c => c.id === parseInt(categoriaId, 10));
    if (!catExiste) {
        logger.error(`Falha ao criar produto: categoria ${categoriaId} não existe`, reqCtx(req));
        return res.status(400).json({ error: 'Categoria informada não existe' });
    }

    const produto = {
        id: nextProductId++,
        nome,
        descricao,
        preco: parseFloat(preco),
        categoriaId: parseInt(categoriaId, 10),
        estoque: estoque !== undefined ? parseInt(estoque, 10) : 0,
        imagemUrl: imagemUrl || `https://placehold.co/200x200?text=${encodeURIComponent(nome.slice(0, 10))}`,
        criadoEm: new Date().toISOString()
    };

    products.push(produto);
    metrics.stockLevel.set({ product_id: String(produto.id), product_name: produto.nome }, produto.estoque);
    logger.info(`Produto criado: ${produto.nome} (id:${produto.id}, R$${produto.preco})`, reqCtx(req));
    res.status(201).json(produto);
});

// PUT /api/products/:id — Atualizar produto (admin)
router.put('/products/:id', (req, res) => {
    const produto = products.find(p => p.id === parseInt(req.params.id, 10));
    if (!produto) {
        logger.warn(`Falha ao atualizar: produto ${req.params.id} não encontrado`, reqCtx(req));
        return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const { nome, descricao, preco, categoriaId, estoque, imagemUrl } = req.body;

    if (nome !== undefined) produto.nome = nome;
    if (descricao !== undefined) produto.descricao = descricao;
    if (preco !== undefined) produto.preco = parseFloat(preco);
    if (categoriaId !== undefined) {
        const catExiste = categories.find(c => c.id === parseInt(categoriaId, 10));
        if (!catExiste) {
            return res.status(400).json({ error: 'Categoria informada não existe' });
        }
        produto.categoriaId = parseInt(categoriaId, 10);
    }
    if (estoque !== undefined) {
        produto.estoque = parseInt(estoque, 10);
        metrics.stockLevel.set({ product_id: String(produto.id), product_name: produto.nome }, produto.estoque);
        metrics.checkLowStock(produto);
    }
    if (imagemUrl !== undefined) produto.imagemUrl = imagemUrl;

    logger.info(`Produto atualizado: ${produto.nome} (id:${produto.id})`, reqCtx(req));
    res.json(produto);
});

// DELETE /api/products/:id — Remover produto (admin)
router.delete('/products/:id', (req, res) => {
    const index = products.findIndex(p => p.id === parseInt(req.params.id, 10));
    if (index === -1) {
        logger.warn(`Falha ao deletar: produto ${req.params.id} não encontrado`, reqCtx(req));
        return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const removido = products.splice(index, 1)[0];
    logger.info(`Produto removido: ${removido.nome} (id:${removido.id})`, reqCtx(req));
    res.status(204).send();
});

// PATCH /api/products/:id/stock — Atualizar estoque
router.patch('/products/:id/stock', (req, res) => {
    const produto = products.find(p => p.id === parseInt(req.params.id, 10));
    if (!produto) {
        logger.warn(`Falha ao atualizar estoque: produto ${req.params.id} não encontrado`, reqCtx(req));
        return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const { quantidade } = req.body;
    if (quantidade === undefined || !Number.isInteger(quantidade) || quantidade < 0) {
        logger.error('Falha ao atualizar estoque: quantidade inválida', reqCtx(req));
        return res.status(400).json({ error: 'quantidade deve ser um inteiro >= 0' });
    }

    const anterior = produto.estoque;
    produto.estoque = quantidade;
    metrics.stockLevel.set({ product_id: String(produto.id), product_name: produto.nome }, produto.estoque);
    metrics.checkLowStock(produto);
    logger.info(`Estoque atualizado: ${produto.nome} (id:${produto.id}) ${anterior} → ${quantidade}`, reqCtx(req));
    res.json({ id: produto.id, nome: produto.nome, estoque: produto.estoque });
});

module.exports = { router, categories, products };
