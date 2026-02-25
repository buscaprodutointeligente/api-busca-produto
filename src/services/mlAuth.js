import config from '../config.js';

let accessToken = null;
let tokenExpiresAt = 0;

/**
 * Obtém um access token via Client Credentials (app-to-app, sem login de usuário).
 * Reutiliza o token em memória enquanto não expirar.
 */
export async function getAccessToken() {
  if (!config.ml.appId || !config.ml.clientSecret) {
    return null;
  }

  // Reutilizar token se ainda válido (com 60s de margem)
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken;
  }

  console.log(`[${new Date().toISOString()}] Renovando access token do ML...`);

  const response = await fetch(`${config.ml.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.ml.appId,
      client_secret: config.ml.clientSecret,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao obter token ML: ${response.status} - ${body}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  console.log(`[${new Date().toISOString()}] Token ML obtido. Expira em ${data.expires_in}s`);
  return accessToken;
}
