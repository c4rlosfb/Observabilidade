let isLoginMode = true;
let currentUser = null;

// Telemetry State
let telemetryState = {
    cpu: 4.5,
    latency: 21,
    error: 0.0,
    spikes: {
        cpu: false,
        latency: false,
        error: false
    }
};

// DOM Elements
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const authForm = document.getElementById('auth-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const logoutBtn = document.getElementById('logout-btn');
const usersList = document.getElementById('users-list');
const currentUserDisplay = document.getElementById('current-user-display');
const toastContainer = document.getElementById('toast-container');

// Telemetry Elements
const telemetryCPUVal = document.getElementById('telemetry-cpu-val');
const telemetryCPUBar = document.getElementById('telemetry-cpu-bar');
const telemetryLatencyVal = document.getElementById('telemetry-latency-val');
const telemetryLatencyBar = document.getElementById('telemetry-latency-bar');
const telemetryErrorVal = document.getElementById('telemetry-error-val');
const telemetryErrorBar = document.getElementById('telemetry-error-bar');

// Tabs Toggle
tabLogin.addEventListener('click', () => {
    isLoginMode = true;
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    authSubmitBtn.querySelector('.btn-text').innerText = 'CONECTAR AO DECK';
});

tabRegister.addEventListener('click', () => {
    isLoginMode = false;
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    authSubmitBtn.querySelector('.btn-text').innerText = 'REGISTRAR CREDENCIAIS';
});

// Auth Submit
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const endpoint = isLoginMode ? '/login' : '/register';
    
    // UI state
    authSubmitBtn.disabled = true;
    const originalText = authSubmitBtn.querySelector('.btn-text').innerText;
    authSubmitBtn.querySelector('.btn-text').innerText = 'VERIFICANDO PROTOCOLO...';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showToast(isLoginMode ? 'Acesso concedido. Bem-vindo de volta.' : 'Credenciais registradas! Faça login.', 'success');
            if (isLoginMode) {
                currentUser = username;
                showDashboard();
            } else {
                tabLogin.click();
            }
        } else {
            showToast(data.error || 'Acesso negado. Revise os dados.', 'error');
        }
    } catch (err) {
        showToast('Falha na comunicação com o Security Gate', 'error');
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.querySelector('.btn-text').innerText = originalText;
    }
});

function showDashboard() {
    loginView.classList.remove('active');
    setTimeout(() => {
        loginView.style.display = 'none';
        dashboardView.style.display = 'flex';
        setTimeout(() => dashboardView.classList.add('active'), 50);
    }, 450); // Wait for fade out
    
    currentUserDisplay.innerText = currentUser;
    loadUsers();
}

logoutBtn.addEventListener('click', () => {
    currentUser = null;
    dashboardView.classList.remove('active');
    setTimeout(() => {
        dashboardView.style.display = 'none';
        loginView.style.display = 'flex';
        setTimeout(() => loginView.classList.add('active'), 50);
    }, 450);
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
});

// Load Users (CRUD)
async function loadUsers() {
    try {
        const res = await fetch('/users');
        const users = await res.json();
        
        // Update database rows count
        const dbCount = document.getElementById('db-user-count');
        if (dbCount) {
            dbCount.innerText = `${users.length} USUÁRIO${users.length !== 1 ? 'S' : ''}`;
        }

        usersList.innerHTML = users.map(u => `
            <tr>
                <td>#${u.id}</td>
                <td>${u.username}</td>
                <td style="text-align: right;">
                    <button class="btn-delete-row" onclick="deleteUser(${u.id})">DELETAR</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Falha ao puxar registros de usuários', 'error');
    }
}

async function deleteUser(id) {
    if(!confirm('Deseja mesmo remover permanentemente as credenciais deste agente?')) return;
    try {
        const res = await fetch(`/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast(`Registro #${id} removido.`, 'success');
            loadUsers();
        } else {
            showToast('Falha interna ao deletar usuário.', 'error');
        }
    } catch (err) {
        showToast('Erro de rede ao processar deleção.', 'error');
    }
}

// Incidents Control
async function triggerIncident(type) {
    const btn = document.querySelector(`.incident-card.${type} button`);
    const originalText = btn ? btn.innerText : '';
    
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'SIMULANDO...';
    }

    showToast(`Disparando sinal de incidente: ${type.toUpperCase()}`, 'info');
    
    // Spike client-side telemetry immediately
    telemetryState.spikes[type] = true;
    updateTelemetryUI();

    // Decay the spike visual after a logical duration
    const decayDuration = type === 'erro' ? 6000 : type === 'cpu' ? 5000 : 10000;
    setTimeout(() => {
        telemetryState.spikes[type] = false;
        updateTelemetryUI();
    }, decayDuration);

    try {
        const res = await fetch(`/incidente-${type}`);
        const data = await res.json();
        
        if (res.ok) {
            showToast(data.message || 'Simulação disparada.', 'warning');
        } else {
            showToast(data.error || 'Simulação gerou erro de rede (esperado).', 'error');
        }
    } catch (err) {
        showToast('Simulação de incidente concluída.', 'warning');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

// Live Telemetry UI Updates
function updateTelemetryUI() {
    if (telemetryCPUVal && telemetryCPUBar) {
        telemetryCPUVal.innerText = `${telemetryState.cpu.toFixed(1)}%`;
        telemetryCPUBar.style.width = `${telemetryState.cpu}%`;
        if (telemetryState.cpu > 80) {
            telemetryCPUBar.className = 'progress-bar-fill bg-danger';
            telemetryCPUVal.className = 'widget-value text-danger';
        } else {
            telemetryCPUBar.className = 'progress-bar-fill bg-green';
            telemetryCPUVal.className = 'widget-value text-green';
        }
    }

    if (telemetryLatencyVal && telemetryLatencyBar) {
        telemetryLatencyVal.innerText = `${telemetryState.latency} ms`;
        // Latency scaling for progress bar
        let percent = 0;
        if (telemetryState.latency > 1000) {
            percent = 85 + (telemetryState.latency - 1000) / 10000 * 15;
            telemetryLatencyBar.className = 'progress-bar-fill bg-danger';
            telemetryLatencyVal.className = 'widget-value text-danger';
        } else {
            percent = 10 + (telemetryState.latency / 1000) * 75;
            telemetryLatencyBar.className = 'progress-bar-fill bg-orange';
            telemetryLatencyVal.className = 'widget-value text-orange';
        }
        telemetryLatencyBar.style.width = `${Math.min(percent, 100)}%`;
    }

    if (telemetryErrorVal && telemetryErrorBar) {
        telemetryErrorVal.innerText = `${telemetryState.error.toFixed(1)}%`;
        telemetryErrorBar.style.width = `${telemetryState.error}%`;
        if (telemetryState.error > 0) {
            telemetryErrorBar.className = 'progress-bar-fill bg-danger';
            telemetryErrorVal.className = 'widget-value text-danger';
        } else {
            telemetryErrorBar.className = 'progress-bar-fill bg-blue';
            telemetryErrorVal.className = 'widget-value text-blue';
        }
    }
}

// Telemetry Oscillation Generator
setInterval(() => {
    // CPU oscillations
    if (telemetryState.spikes.cpu) {
        telemetryState.cpu = 91.5 + Math.random() * 7.5;
    } else {
        telemetryState.cpu = 3.5 + Math.random() * 3.8;
    }

    // Latency oscillations
    if (telemetryState.spikes.latency) {
        telemetryState.latency = 9800 + Math.round(Math.random() * 350);
    } else {
        telemetryState.latency = 16 + Math.round(Math.random() * 8);
    }

    // Error Rate
    if (telemetryState.spikes.error) {
        telemetryState.error = 100.0;
    } else {
        telemetryState.error = 0.0;
    }

    updateTelemetryUI();
}, 1000);

// UI Helpers: Custom Toast Alert
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '⚡';
    if (type === 'success') icon = '🛰️';
    if (type === 'error') icon = '🚨';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3200);
}

// Initial Telemetry Render
updateTelemetryUI();