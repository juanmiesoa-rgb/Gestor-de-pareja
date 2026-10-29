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

export async function callApi(action, payload = {}) {
  const idToken = getToken();
  if (!idToken) {
    const err = new Error('No hay sesión activa. Por favor, inicia sesión.');
    err.code = 'NO_AUTH';
    throw err;
  }

  const requestData = {
    action,
    request_id: generateUUID(),
    id_token: idToken,
    payload
  };

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const err = new Error(errorData.message || 'Error de red al conectar con el servidor.');
      err.code = errorData.code || 'NETWORK_ERROR';
      throw err;
    }

    const data = await response.json();

    if (!data.ok) {
      const err = new Error(data.error?.message || 'El servidor devolvió un error.');
      err.code = data.error?.code || 'BACKEND_ERROR';
      throw err;
    }

    return data.data;
  } catch (error) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      const err = new Error('Error de conexión. Verifica tu conexión a internet.');
      err.code = 'NETWORK_ERROR';
      throw err;
    }
    throw error;
  }
}
