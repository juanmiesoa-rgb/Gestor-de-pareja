import { CONFIG } from './config.js';
import { callApi } from './api.js';

export function getToken() {
  return sessionStorage.getItem('id_token');
}

export function initGoogleSignIn() {
  if (document.getElementById('gis-script')) return;

  const script = document.createElement('script');
  script.id = 'gis-script';
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  
  script.onload = () => {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true
    });
    
    window.google.accounts.id.renderButton(
      document.getElementById('g_id_signin'),
      { 
        theme: 'outline', 
        size: 'large', 
        width: 320,
        text: 'signin_with',
        shape: 'rectangular'
      }
    );
  };
  
  document.head.appendChild(script);
}

export async function handleCredentialResponse(response) {
  const idToken = response.credential;
  sessionStorage.setItem('id_token', idToken);

  try {
    showNotification('Verificando sesión...', 'info');
    const user = await callApi('auth.me', {});
    
    sessionStorage.setItem('user_name', user.usuario?.nombre || user.usuario?.email || 'Usuario');
    showDashboard(user);
    showNotification(`Bienvenido/a, ${user.usuario?.nombre || 'Usuario'}`, 'success');
  } catch (error) {
    console.error('Auth error:', error);
    sessionStorage.removeItem('id_token');
    showNotification(error.message || 'Error al verificar la sesión.', 'error');
    showLogin();
  }
}

export function logout() {
  sessionStorage.removeItem('id_token');
  sessionStorage.removeItem('user_name');
  window.location.reload();
}

export function checkSession() {
  const token = getToken();
  if (token) {
    callApi('auth.me', {})
      .then(user => showDashboard(user))
      .catch(() => {
        sessionStorage.removeItem('id_token');
        showLogin();
      });
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('dashboard-screen').classList.add('hidden');
  initGoogleSignIn();
}

function showDashboard(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard-screen').classList.remove('hidden');
  
  const userNameEl = document.getElementById('user-name-display');
  if (userNameEl) {
    userNameEl.textContent = user.usuario?.nombre || user.usuario?.email || 'Usuario';
  }
  
  // Cargar datos iniciales del dashboard
  loadDashboardData();
}

async function loadDashboardData() {
  try {
    const [cuentas, resumen] = await Promise.all([
      callApi('cuentas.listar', {}),
      callApi('informes.resumen', {})
    ]);
    
    renderDashboard(cuentas, resumen);
  } catch (error) {
    console.error('Error cargando dashboard:', error);
    showNotification('Error al cargar datos: ' + error.message, 'error');
  }
}

function renderDashboard(cuentas, resumen) {
  const cuentasContainer = document.getElementById('cuentas-list');
  if (cuentasContainer) {
    cuentasContainer.innerHTML = cuentas
      .filter(c => c.estado === 'ACTIVA')
      .map(c => `
        <div class="cuenta-card">
          <div class="cuenta-header">
            <span class="cuenta-icono">${c.icono || '💳'}</span>
            <div>
              <div class="cuenta-nombre">${c.nombre}</div>
              <div class="cuenta-entidad">${c.entidad}</div>
            </div>
          </div>
          <div class="cuenta-saldo">
            <div class="saldo-label">Saldo inicial</div>
            <div class="saldo-valor">${formatMoney(c.saldo_inicial_cent)}</div>
          </div>
        </div>
      `).join('');
  }
  
  const resumenContainer = document.getElementById('resumen-data');
  if (resumenContainer) {
    resumenContainer.innerHTML = `
      <div class="resumen-item">
        <span class="resumen-label">Periodo</span>
        <span class="resumen-valor">${resumen.periodo}</span>
      </div>
      <div class="resumen-item">
        <span class="resumen-label">Gasto del mes</span>
        <span class="resumen-valor">${formatMoney(resumen.gasto_mes_cent)}</span>
      </div>
      <div class="resumen-item">
        <span class="resumen-label">Cuentas activas</span>
        <span class="resumen-valor">${resumen.cuentas?.length || 0}</span>
      </div>
    `;
  }
}

function formatMoney(centimos) {
  if (centimos === null || centimos === undefined) return '—';
  const euros = Math.abs(centimos) / 100;
  return euros.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-area');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `notification ${type === 'error' ? 'error-msg' : type === 'success' ? 'success-msg' : 'info-msg'}`;
  div.textContent = message;
  
  container.appendChild(div);

  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, 4000);
}
