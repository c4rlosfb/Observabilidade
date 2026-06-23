// ============================================================
// OBSERVABILITY LAB — E-COMMERCE FRONTEND
// ============================================================

// ─── STATE ──────────────────────────────────────────────────
let currentUser = null;
let currentUserId = null;
let currentToken = null;
let currentRole = null;
let products = [];
let categories = [];
let cart = { items: [], total: 0, totalItems: 0 };
let currentFilter = '';
let currentSearch = '';
let adminFilter = '';

// ─── API Helper ─────────────────────────────────────────────
function apiHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    return headers;
}

// ─── DOM REFS ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const loginView = $('login-view');
const dashboardView = $('dashboard-view');
const authForm = $('auth-form');
const tabLogin = $('tab-login');
const tabRegister = $('tab-register');
const authSubmitBtn = $('auth-submit-btn');
const logoutBtn = $('logout-btn');
const currentUserDisplay = $('current-user-display');
const userIdBadge = $('user-id-badge');
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page-content');
const cartBadge = $('cart-badge');
const toastContainer = $('toast-container');

// ─── AUTH ───────────────────────────────────────────────────
tabLogin.addEventListener('click', () => {
    setActiveTab(tabLogin, tabRegister);
    authSubmitBtn.querySelector('.btn-text').innerText = 'CONECTAR AO DECK';
});

tabRegister.addEventListener('click', () => {
    setActiveTab(tabRegister, tabLogin);
    authSubmitBtn.querySelector('.btn-text').innerText = 'REGISTRAR CREDENCIAIS';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('username').value.trim();
    const password = $('password').value.trim();
    if (!username || !password) return showToast('Preencha todos os campos.', 'error');

    const isLogin = tabLogin.classList.contains('active');
    const endpoint = isLogin ? '/login' : '/register';

    authSubmitBtn.disabled = true;
    const originalText = authSubmitBtn.querySelector('.btn-text').innerText;
    authSubmitBtn.querySelector('.btn-text').innerText = 'VERIFICANDO...';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            if (isLogin) {
                currentUser = data.user.username;
                currentUserId = data.user.id;
                currentToken = data.token;
                currentRole = data.user.role;
                showToast('Acesso concedido. Bem-vindo.', 'success');
                enterDashboard();
            } else {
                showToast('Credenciais registradas! Faça login.', 'success');
                tabLogin.click();
                $('username').value = username;
                $('password').value = '';
            }
        } else {
            showToast(data.error || 'Acesso negado.', 'error');
        }
    } catch (err) {
        showToast('Falha na comunicação.', 'error');
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.querySelector('.btn-text').innerText = originalText;
    }
});

logoutBtn.addEventListener('click', () => {
    currentUser = null;
    currentUserId = null;
    currentToken = null;
    currentRole = null;
    cart = { items: [], total: 0, totalItems: 0 };
    dashboardView.classList.remove('active');
    setTimeout(() => {
        dashboardView.style.display = 'none';
        loginView.style.display = 'flex';
        setTimeout(() => loginView.classList.add('active'), 50);
    }, 450);
});

function enterDashboard() {
    loginView.classList.remove('active');
    setTimeout(() => {
        loginView.style.display = 'none';
        dashboardView.style.display = 'flex';
        setTimeout(() => dashboardView.classList.add('active'), 50);
    }, 450);

    currentUserDisplay.innerText = currentUser;
    userIdBadge.innerText = `(#${currentUserId} · ${currentRole === 'admin' ? 'ADMIN' : 'USER'})`;
    // Esconder aba admin para não-admins
    const adminNavLink = document.querySelector('.nav-link[data-page="admin"]');
    if (adminNavLink) adminNavLink.style.display = currentRole === 'admin' ? '' : 'none';
    showPage('catalog');
    loadCatalog();
    loadCart();
}

// ─── NAVIGATION ─────────────────────────────────────────────
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        const page = link.dataset.page;
        showPage(page);
    });
});

function showPage(page) {
    navLinks.forEach(l => l.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));

    const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add('active');

    const activePage = $(`page-${page}`);
    if (activePage) activePage.classList.add('active');

    // Load page-specific data
    switch (page) {
        case 'catalog': loadCatalog(); break;
        case 'cart': loadCart(); break;
        case 'orders': loadOrders(); break;
        case 'admin':
            if (currentRole !== 'admin') {
                showToast('Acesso restrito a administradores.', 'error');
                return showPage('catalog');
            }
            loadAdminProducts();
            break;
    }
}

// ─── CATALOG ────────────────────────────────────────────────
async function loadCatalog() {
    try {
        const params = new URLSearchParams();
        if (currentFilter) params.set('categoria', currentFilter);
        if (currentSearch) params.set('busca', currentSearch);

        const res = await fetch(`/api/products?${params.toString()}`);
        products = await res.json();

        if (!categories.length) {
            const catRes = await fetch('/api/categories');
            categories = await catRes.json();
        }

        renderProducts();
    } catch (err) {
        showToast('Erro ao carregar produtos.', 'error');
    }
}

function renderProducts() {
    const grid = $('product-grid');
    if (!products.length) {
        grid.innerHTML = `<div class="empty-state"><span class="empty-icon">📦</span><p>Nenhum produto encontrado</p></div>`;
        return;
    }

    grid.innerHTML = products.map(p => {
        const stockClass = p.estoque === 0 ? 'out' : p.estoque <= 5 ? 'low' : '';
        const stockText = p.estoque === 0 ? 'FORA DE ESTOQUE' : `${p.estoque} em estoque`;

        return `
            <div class="product-card" onclick="openProductDetail(${p.id})">
                <div class="product-card-image">
                    <img src="${p.imagemUrl}" alt="${p.nome}" loading="lazy" onerror="this.src='https://placehold.co/200x200?text=Produto'">
                </div>
                <div class="product-card-body">
                    <div class="product-card-name">${p.nome}</div>
                    <div class="product-card-price">R$ ${formatPrice(p.preco)}</div>
                    <div class="product-card-stock ${stockClass}">${stockText}</div>
                    <div class="product-card-actions">
                        <button class="btn-outline-buy" onclick="event.stopPropagation(); quickAddToCart(${p.id})">
                            🛒 Comprar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Catalog Filters
document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn[data-category]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.category;
        loadCatalog();
    });
});

// Search
$('search-input').addEventListener('input', debounce((e) => {
    currentSearch = e.target.value.trim();
    loadCatalog();
}, 400));

// ─── PRODUCT DETAIL ─────────────────────────────────────────
async function openProductDetail(productId) {
    try {
        const res = await fetch(`/api/products/${productId}`);
        const p = await res.json();

        const modal = $('product-modal');
        const body = $('product-detail-body');

        const stockClass = p.estoque === 0 ? 'out-stock' : p.estoque <= 5 ? 'low-stock' : 'in-stock';
        const stockText = p.estoque === 0 ? 'FORA DE ESTOQUE' : `${p.estoque} UNIDADES DISPONÍVEIS`;

        body.innerHTML = `
            <div class="product-detail-layout">
                <div class="product-detail-image">
                    <img src="${p.imagemUrl}" alt="${p.nome}" onerror="this.src='https://placehold.co/200x200?text=Produto'">
                </div>
                <div class="product-detail-info">
                    <div class="product-detail-name">${p.nome}</div>
                    <div class="product-detail-desc">${p.descricao}</div>
                    <div class="product-detail-price">R$ ${formatPrice(p.preco)}</div>
                    <div class="product-detail-stock ${stockClass}">${stockText}</div>
                    ${p.estoque > 0 ? `
                    <div class="qty-control">
                        <label>QUANTIDADE:</label>
                        <input type="number" id="detail-qty" class="qty-input" value="1" min="1" max="${p.estoque}">
                    </div>
                    <button class="btn-primary" onclick="addToCartFromDetail(${p.id})">
                        🛒 Adicionar ao Carrinho
                    </button>
                    ` : `<button class="btn-primary" disabled style="opacity:0.4">Indisponível</button>`}
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    } catch (err) {
        showToast('Erro ao carregar detalhes.', 'error');
    }
}

$('modal-close').addEventListener('click', () => $('product-modal').classList.add('hidden'));
$('product-modal').addEventListener('click', (e) => {
    if (e.target === $('product-modal')) $('product-modal').classList.add('hidden');
});

function addToCartFromDetail(productId) {
    const qty = parseInt($('detail-qty').value) || 1;
    addToCart(productId, qty);
    $('product-modal').classList.add('hidden');
}

function quickAddToCart(productId) {
    addToCart(productId, 1);
}

// ─── CART ───────────────────────────────────────────────────
async function addToCart(productId, quantity) {
    if (!currentUserId) {
        showToast('Faça login primeiro.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/cart/add', {
            method: 'POST',
            headers: apiHeaders(),
            body: JSON.stringify({ productId, quantity })
        });

        if (!res.ok) {
            const err = await res.json();
            showToast(err.error || 'Erro ao adicionar ao carrinho.', 'error');
            return;
        }

        cart = await res.json();
        updateCartBadge();
        showToast('Adicionado ao carrinho!', 'success');
        loadCart();
    } catch (err) {
        showToast('Erro de rede.', 'error');
    }
}

async function loadCart() {
    if (!currentUserId) return;

    try {
        const res = await fetch('/api/cart', {
            headers: apiHeaders()
        });

        if (res.ok) {
            cart = await res.json();
        } else {
            cart = { items: [], total: 0, totalItems: 0 };
        }
    } catch (_) {
        cart = { items: [], total: 0, totalItems: 0 };
    }

    updateCartBadge();
    renderCart();
}

function updateCartBadge() {
    if (cart.totalItems > 0) {
        cartBadge.classList.remove('hidden');
        cartBadge.innerText = cart.totalItems;
    } else {
        cartBadge.classList.add('hidden');
    }
}

function renderCart() {
    const empty = $('cart-empty');
    const container = $('cart-items-container');
    const list = $('cart-items-list');
    const total = $('cart-total');
    const countLabel = $('cart-count-label');

    if (!cart.items || cart.items.length === 0) {
        empty.classList.remove('hidden');
        container.classList.add('hidden');
        countLabel.innerText = '0 ITENS';
        return;
    }

    empty.classList.add('hidden');
    container.classList.remove('hidden');
    countLabel.innerText = `${cart.totalItems} ITENS`;

    list.innerHTML = cart.items.map(item => `
        <div class="cart-item-row">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.productName}</div>
                <div class="cart-item-price">R$ ${formatPrice(item.price)}</div>
            </div>
            <div class="cart-item-controls">
                <button class="qty-btn" onclick="updateCartItem(${item.cartItemId}, ${item.quantity - 1})">−</button>
                <span class="qty-display">${item.quantity}</span>
                <button class="qty-btn" onclick="updateCartItem(${item.cartItemId}, ${item.quantity + 1})">+</button>
            </div>
            <div class="cart-item-subtotal">R$ ${formatPrice(item.subtotal)}</div>
            <button class="cart-item-remove" onclick="removeCartItem(${item.cartItemId})">✕</button>
        </div>
    `).join('');

    total.innerText = `R$ ${formatPrice(cart.total)}`;
}

async function updateCartItem(itemId, newQty) {
    if (newQty <= 0) {
        await removeCartItem(itemId);
        return;
    }

    try {
        const res = await fetch(`/api/cart/update/${itemId}`, {
            method: 'PUT',
            headers: apiHeaders(),
            body: JSON.stringify({ quantity: newQty })
        });

        if (res.ok) {
            cart = await res.json();
            updateCartBadge();
            renderCart();
        }
    } catch (_) { /* silent */ }
}

async function removeCartItem(itemId) {
    try {
        const res = await fetch(`/api/cart/remove/${itemId}`, {
            method: 'DELETE',
            headers: apiHeaders()
        });

        if (res.ok) {
            cart = await res.json();
            updateCartBadge();
            renderCart();
            showToast('Item removido do carrinho.', 'info');
        }
    } catch (_) { /* silent */ }
}

function goToCheckout() {
    showPage('checkout');
    loadCheckoutPreview();
}

// ─── CHECKOUT ───────────────────────────────────────────────
function loadCheckoutPreview() {
    const preview = $('checkout-items-preview');
    const total = $('checkout-total');

    if (!cart.items || cart.items.length === 0) {
        preview.innerHTML = '<p style="color:var(--text-muted)">Carrinho vazio</p>';
        total.innerText = 'R$ 0,00';
        return;
    }

    preview.innerHTML = cart.items.map(item => `
        <div class="checkout-item-line">
            <span>${item.productName} × ${item.quantity}</span>
            <span>R$ ${formatPrice(item.subtotal)}</span>
        </div>
    `).join('');

    total.innerText = `R$ ${formatPrice(cart.total)}`;
}

$('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const address = $('checkout-address').value.trim();
    const city = $('checkout-city').value.trim();
    const cep = $('checkout-cep').value.trim();

    if (!address || !city || !cep) {
        return showToast('Preencha todos os campos de endereço.', 'error');
    }

    if (!cart.items || cart.items.length === 0) {
        return showToast('Carrinho vazio.', 'error');
    }

    // Show loading
    $('checkout-form').classList.add('hidden');
    $('checkout-loading').classList.remove('hidden');

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: apiHeaders()
        });

        const data = await res.json();

        $('checkout-loading').classList.add('hidden');
        $('checkout-form').classList.remove('hidden');

        if (res.ok) {
            $('confirm-order-id').innerText = data.order.id;
            $('order-confirmation').classList.remove('hidden');
            cart = { items: [], total: 0, totalItems: 0 };
            updateCartBadge();
            $('checkout-address').value = '';
            $('checkout-city').value = '';
            $('checkout-cep').value = '';
            $('checkout-obs').value = '';
            showToast('Pedido realizado com sucesso!', 'success');
        } else {
            showToast(data.error || 'Falha ao processar pedido.', 'error');
        }
    } catch (err) {
        $('checkout-loading').classList.add('hidden');
        $('checkout-form').classList.remove('hidden');
        showToast('Erro de rede ao finalizar pedido.', 'error');
    }
});

function closeConfirmation() {
    $('order-confirmation').classList.add('hidden');
    showPage('orders');
    loadOrders();
}

// ─── ORDERS ─────────────────────────────────────────────────
async function loadOrders() {
    if (!currentUserId) return;

    try {
        const res = await fetch('/api/orders', {
            headers: apiHeaders()
        });

        if (!res.ok) {
            $('orders-list').classList.add('hidden');
            $('orders-empty').classList.remove('hidden');
            $('orders-count').innerText = '0 PEDIDOS';
            return;
        }

        const orders = await res.json();
        $('orders-count').innerText = `${orders.length} PEDIDO${orders.length !== 1 ? 'S' : ''}`;

        if (orders.length === 0) {
            $('orders-list').classList.add('hidden');
            $('orders-empty').classList.remove('hidden');
            return;
        }

        $('orders-empty').classList.add('hidden');
        $('orders-list').classList.remove('hidden');

        $('orders-list').innerHTML = orders.map(o => `
            <div class="order-card">
                <div class="order-card-header">
                    <span class="order-id">#${o.id}</span>
                    <span class="order-status status-${o.status}">${translateStatus(o.status)}</span>
                </div>
                <div class="order-card-body">
                    ${o.itemsCount} ${o.itemsCount === 1 ? 'item' : 'itens'} • ${formatDate(o.createdAt)}
                </div>
                <div class="order-card-footer">
                    <span>Total:</span>
                    <span class="order-total">R$ ${formatPrice(o.total)}</span>
                </div>
            </div>
        `).join('');
    } catch (_) {
        $('orders-list').classList.add('hidden');
        $('orders-empty').classList.remove('hidden');
    }
}

function translateStatus(status) {
    const map = {
        'pending': 'PENDENTE',
        'confirmed': 'CONFIRMADO',
        'preparing': 'PREPARANDO',
        'shipped': 'ENVIADO',
        'delivered': 'ENTREGUE'
    };
    return map[status] || status;
}

// ─── ADMIN ──────────────────────────────────────────────────
async function loadAdminProducts(filter) {
    if (filter !== undefined) adminFilter = filter;

    try {
        const params = new URLSearchParams();
        if (adminFilter) params.set('categoria', adminFilter);

        const res = await fetch(`/api/products?${params.toString()}`);
        const products = await res.json();

        const tbody = $('admin-products-body');
        tbody.innerHTML = products.map(p => `
            <tr class="${p.estoque === 0 ? 'out-of-stock' : ''}">
                <td>#${p.id}</td>
                <td>${p.nome}</td>
                <td>R$ ${formatPrice(p.preco)}</td>
                <td>${p.estoque}</td>
                <td>
                    <div class="admin-actions">
                        <button class="btn-admin-edit" onclick="editAdminProduct(${p.id})">Editar</button>
                        <button class="btn-admin-delete" onclick="deleteAdminProduct(${p.id})">Deletar</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (_) {
        showToast('Erro ao carregar admin.', 'error');
    }
}

// Admin category filters
document.querySelectorAll('.filter-btn[data-admin-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn[data-admin-cat]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadAdminProducts(btn.dataset.adminCat);
    });
});

function openAdminAdd() {
    $('admin-modal-title').innerText = '// NOVO_PRODUTO';
    $('admin-product-id').value = '';
    $('admin-prod-nome').value = '';
    $('admin-prod-descricao').value = '';
    $('admin-prod-preco').value = '';
    $('admin-prod-estoque').value = '';
    $('admin-prod-categoria').value = '1';
    $('admin-prod-imagem').value = '';
    $('admin-modal').classList.remove('hidden');
}

async function editAdminProduct(id) {
    try {
        const res = await fetch(`/api/products/${id}`);
        const p = await res.json();

        $('admin-modal-title').innerText = `// EDITAR: ${p.nome}`;
        $('admin-product-id').value = p.id;
        $('admin-prod-nome').value = p.nome;
        $('admin-prod-descricao').value = p.descricao;
        $('admin-prod-preco').value = p.preco;
        $('admin-prod-estoque').value = p.estoque;
        $('admin-prod-categoria').value = p.categoriaId;
        $('admin-prod-imagem').value = p.imagemUrl;
        $('admin-modal').classList.remove('hidden');
    } catch (_) {
        showToast('Erro ao carregar produto.', 'error');
    }
}

function closeAdminModal() {
    $('admin-modal').classList.add('hidden');
}

$('admin-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = $('admin-product-id').value;
    const data = {
        nome: $('admin-prod-nome').value.trim(),
        descricao: $('admin-prod-descricao').value.trim(),
        preco: parseFloat($('admin-prod-preco').value),
        categoriaId: parseInt($('admin-prod-categoria').value),
        estoque: parseInt($('admin-prod-estoque').value),
        imagemUrl: $('admin-prod-imagem').value.trim() || undefined
    };

    if (!data.nome || !data.descricao || isNaN(data.preco)) {
        return showToast('Preencha todos os campos obrigatórios.', 'error');
    }

    try {
        let res;
        if (id) {
            // Update
            res = await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: apiHeaders(),
                body: JSON.stringify(data)
            });
        } else {
            res = await fetch('/api/products', {
                method: 'POST',
                headers: apiHeaders(),
                body: JSON.stringify(data)
            });
        }

        if (res.ok) {
            showToast(id ? 'Produto atualizado!' : 'Produto criado!', 'success');
            closeAdminModal();
            loadAdminProducts();
            if ($('page-catalog').classList.contains('active')) loadCatalog();
        } else {
            const err = await res.json();
            showToast(err.error || 'Erro ao salvar.', 'error');
        }
    } catch (_) {
        showToast('Erro de rede.', 'error');
    }
});

async function deleteAdminProduct(id) {
    if (!confirm('Tem certeza que deseja remover este produto?')) return;

    try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE', headers: apiHeaders() });
        if (res.ok) {
            showToast('Produto removido.', 'info');
            loadAdminProducts();
            if ($('page-catalog').classList.contains('active')) loadCatalog();
        }
    } catch (_) {
        showToast('Erro ao deletar.', 'error');
    }
}

// ─── UTILITY FUNCTIONS ──────────────────────────────────────
function formatPrice(value) {
    return value.toFixed(2).replace('.', ',');
}

function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function setActiveTab(active, inactive) {
    active.classList.add('active');
    inactive.classList.remove('active');
}

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Toast System
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '⚡';
    if (type === 'success') icon = '🛰️';
    if (type === 'error') icon = '🚨';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 3200);
}

// ─── INIT ───────────────────────────────────────────────────
// (Nothing to init — login view is default)
