import { CONFIG } from './config.js';
import { getToken } from './auth.js';

function generateUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// api.js
export async function callApi(action, payload) {
  const requestId = crypto.randomUUID(); // Genera un ID único
  const token = sessionStorage.getItem('id_token');

  if (!token) {
    throw new Error('No hay sesión activa');
  }

  const requestData = {
    action: action,
    request_id: requestId,
    id_token: token,
    payload: payload || {}
  };

  // ⚠️ LA CLAVE: Content-Type DEBE SER text/plain
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8' // <-- ESTO EVITA EL ERROR CORS
    },
    body: JSON.stringify(requestData) // <-- Enviamos el JSON como string
  });

  if (!response.ok) {
    throw new Error('Error de conexión. Verifica tu conexión a internet.');
  }

  const result = await response.json();

  if (!result.ok) {
    // Si el backend devuelve un error de negocio, lo lanzamos para que la UI lo muestre
    throw new Error(result.error.message || 'Error en el servidor');
  }

  return result.data;
} catch (error) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      const err = new Error('Error de conexión. Verifica tu conexión a internet.');
      err.code = 'NETWORK_ERROR';
      throw err;
    }
    throw error;
  }
}
