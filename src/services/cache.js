import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import config from '../config.js';

let supabase = null;

function getSupabase() {
  if (!supabase) {
    if (!config.supabaseUrl || !config.supabaseKey) {
      return null;
    }
    supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }
  return supabase;
}

/**
 * Gera um hash determinístico para os parâmetros de busca.
 */
export function gerarHash(params) {
  const str = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Busca resultado no cache de buscas.
 */
export async function buscarCacheSearch(queryHash) {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from('search_cache')
      .select('results')
      .eq('query_hash', queryHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;
    return data.results;
  } catch {
    return null;
  }
}

/**
 * Salva resultado no cache de buscas.
 */
export async function salvarCacheSearch(queryHash, queryParams, results) {
  const db = getSupabase();
  if (!db) return;

  try {
    const expiresAt = new Date(Date.now() + config.ml.searchCacheTTLHours * 60 * 60 * 1000).toISOString();
    await db
      .from('search_cache')
      .upsert({
        query_hash: queryHash,
        query_params: queryParams,
        results,
        expires_at: expiresAt,
      }, { onConflict: 'query_hash' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro ao salvar cache de busca:`, err.message);
  }
}

/**
 * Busca item no cache de itens individuais.
 */
export async function buscarCacheItem(mlItemId) {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from('item_cache')
      .select('item_data')
      .eq('ml_item_id', mlItemId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;
    return data.item_data;
  } catch {
    return null;
  }
}

/**
 * Salva item no cache.
 */
export async function salvarCacheItem(mlItemId, itemData) {
  const db = getSupabase();
  if (!db) return;

  try {
    const expiresAt = new Date(Date.now() + config.ml.itemCacheTTLHours * 60 * 60 * 1000).toISOString();
    await db
      .from('item_cache')
      .upsert({
        ml_item_id: mlItemId,
        item_data: itemData,
        expires_at: expiresAt,
      }, { onConflict: 'ml_item_id' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro ao salvar cache de item:`, err.message);
  }
}

/**
 * Salva no histórico de buscas.
 */
export async function salvarHistorico(titulo, specs, melhorResultado, menorPreco, totalResultados) {
  const db = getSupabase();
  if (!db) return;

  try {
    await db
      .from('search_history')
      .insert({
        titulo_produto: titulo,
        specs_buscadas: specs,
        melhor_resultado: melhorResultado,
        menor_preco: menorPreco,
        total_resultados: totalResultados,
      });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro ao salvar histórico:`, err.message);
  }
}

/**
 * Lista histórico de buscas.
 */
export async function listarHistorico(limit = 20, offset = 0) {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from('search_history')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro ao listar histórico:`, err.message);
    return [];
  }
}

/**
 * Limpa cache expirado.
 */
export async function limparCacheExpirado() {
  const db = getSupabase();
  if (!db) return { search_cache: 0, item_cache: 0 };

  try {
    const now = new Date().toISOString();

    const { count: searchCount } = await db
      .from('search_cache')
      .delete({ count: 'exact' })
      .lt('expires_at', now);

    const { count: itemCount } = await db
      .from('item_cache')
      .delete({ count: 'exact' })
      .lt('expires_at', now);

    return {
      search_cache: searchCount || 0,
      item_cache: itemCount || 0,
    };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro ao limpar cache:`, err.message);
    return { search_cache: 0, item_cache: 0 };
  }
}

/**
 * Verifica conexão com Supabase.
 */
export async function verificarConexao() {
  const db = getSupabase();
  if (!db) return { status: 'não configurado' };

  try {
    const { error } = await db.from('search_history').select('id').limit(1);
    if (error) return { status: 'erro', mensagem: error.message };
    return { status: 'conectado' };
  } catch (err) {
    return { status: 'erro', mensagem: err.message };
  }
}
