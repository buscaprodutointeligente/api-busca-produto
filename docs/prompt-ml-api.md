# Prompt para Claude (terminal)

Cole o conteúdo abaixo no Claude via terminal:

---

Crie uma API completa em Node.js para busca de produtos no Mercado Livre com comparação por especificações técnicas. O objetivo é ajudar um comprador de licitações a encontrar o menor preço para um produto com especificações específicas.

## Contexto de negócio

O usuário participa de licitações públicas. Cada licitação exige produtos com especificações técnicas precisas. Hoje ele busca manualmente no Google e em marketplaces, abrindo produto por produto para conferir specs. Essa API vai automatizar isso: receber o título + especificações do produto da licitação e retornar os resultados do Mercado Livre ordenados por relevância (match de specs) e preço.

## Stack

- **Runtime**: Node.js (versão 18+)
- **Framework**: Fastify
- **Banco**: Supabase (PostgreSQL via @supabase/supabase-js)
- **Deploy**: Render (preparar com Dockerfile ou start script no package.json)
- **API externa**: Mercado Livre API pública (não autenticada)

## Endpoints do Mercado Livre a usar

1. `GET https://api.mercadolibre.com/sites/MLB/search?q={query}&limit=50&offset=0` — busca por texto
2. `GET https://api.mercadolibre.com/items/{item_id}` — detalhes completos de um item (incluindo atributos)
3. `GET https://api.mercadolibre.com/sites/MLB/search?q={query}&category={category_id}` — busca filtrada por categoria
4. `GET https://api.mercadolibre.com/sites/MLB/categories/{category_id}/attributes` — atributos disponíveis na categoria

Obs: A API do ML tem rate limit. Implementar controle para não ultrapassar ~30 requests por minuto nas chamadas de detalhes de item. Usar Promise pool com concorrência limitada (máximo 5 simultâneas).

## Estrutura do projeto

```
/src
  /routes
    search.js        — rotas de busca
    history.js       — rotas de histórico
  /services
    mercadolivre.js  — client da API do ML
    comparator.js    — lógica de comparação de specs
    cache.js         — lógica de cache com Supabase
  /utils
    textMatch.js     — funções de matching textual
    specParser.js    — parser de especificações
  server.js          — setup do Fastify
  config.js          — variáveis de ambiente
package.json
Dockerfile
.env.example
README.md
```

## Schema do Supabase (criar estas tabelas)

```sql
-- Cache de buscas para evitar chamadas repetidas à API do ML
CREATE TABLE search_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  query_params JSONB NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_search_cache_hash ON search_cache(query_hash);
CREATE INDEX idx_search_cache_expires ON search_cache(expires_at);

-- Histórico de buscas do usuário (útil para licitações recorrentes)
CREATE TABLE search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo_produto TEXT NOT NULL,
  specs_buscadas JSONB,
  melhor_resultado JSONB,
  menor_preco NUMERIC(10,2),
  total_resultados INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache de detalhes de itens individuais do ML
CREATE TABLE item_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ml_item_id TEXT NOT NULL UNIQUE,
  item_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_item_cache_ml_id ON item_cache(ml_item_id);
```

## Endpoint principal: POST /api/search

### Request body:

```json
{
  "titulo": "Câmera Inteligente Vigilância Externa Segurança IP66 Câmera Dupla",
  "specs": {
    "resolucao": "3MP",
    "conectividade": "WiFi 2.4GHz",
    "protecao": "IP66",
    "lente": "3.6mm",
    "voltagem": "Bivolt",
    "aplicativo": "iCSee",
    "visao_noturna": "Infravermelho 10m",
    "antenas": "2"
  },
  "preco_maximo": 350.00,
  "ordenar_por": "relevancia_preco",
  "usar_cache": true
}
```

### Fluxo interno:

1. **Verificar cache**: gerar hash do request e verificar no Supabase se já existe resultado válido (não expirado, TTL de 2 horas). Se existir, retornar direto.

2. **Buscar no ML**: Construir query inteligente a partir do título. Remover palavras genéricas (de, da, com, para, etc.). Manter termos técnicos e discriminantes. Fazer a busca com limit=50.

3. **Buscar detalhes**: Para cada item retornado, buscar os detalhes completos via `/items/{id}` para obter os atributos técnicos. Usar cache do Supabase (tabela item_cache, TTL 24h) para não repetir chamadas. Controlar concorrência (máximo 5 requests simultâneas com p-limit).

4. **Comparar specs**: Para cada item com detalhes, comparar as especificações da licitação com os atributos do item. A comparação deve funcionar assim:

   **Matching de atributos do ML**: Os atributos vêm no formato `item.attributes = [{id, name, value_name}]`. Comparar os values com as specs fornecidas.

   **Matching textual (fallback)**: Quando o vendedor não preenche atributos, buscar as specs no título e na descrição do item usando matching textual. As funções de matching devem:
   - Normalizar texto (remover acentos, lowercase)
   - Buscar valores numéricos com unidades (ex: "3MP", "3.6mm", "IP66")
   - Considerar variações comuns (ex: "Wi-Fi" = "WiFi" = "Wifi", "Bivolt" = "110v/220v" = "110/220V")
   - Gerar um score de 0 a 1 para cada spec (1 = match exato, 0.5 = match parcial, 0 = não encontrado)

5. **Calcular score final**: Cada item recebe um score composto:
   - `spec_score` (0 a 1): média dos scores de matching de cada spec individual
   - `price_score` (0 a 1): normalizado pelo menor preço encontrado (menor preço = 1.0)
   - `score_final` = (spec_score * 0.7) + (price_score * 0.3)

   O peso maior vai para specs porque em licitação o produto precisa atender as especificações primeiro, preço é secundário.

6. **Filtrar e ordenar**: Remover itens com spec_score abaixo de 0.3 (muito diferentes). Ordenar por score_final decrescente.

7. **Salvar cache e histórico**: Salvar resultado no search_cache. Salvar no search_history com o melhor resultado e menor preço.

### Response body:

```json
{
  "query_usada": "Câmera Inteligente Vigilância Externa IP66 Dupla 3MP WiFi",
  "total_encontrados": 50,
  "total_relevantes": 12,
  "cache_hit": false,
  "resultados": [
    {
      "titulo": "Câmera Dupla Ip66 Externa Wifi 3mp Visão Noturna Icsee",
      "preco": 189.90,
      "preco_original": 250.00,
      "link": "https://www.mercadolivre.com.br/...",
      "thumbnail": "https://http2.mlstatic.com/...",
      "vendedor": "TECH_STORE",
      "reputacao_vendedor": "green",
      "frete_gratis": true,
      "quantidade_vendas": 1523,
      "score_final": 0.92,
      "spec_score": 0.95,
      "price_score": 0.85,
      "specs_encontradas": {
        "resolucao": {"valor": "3MP", "match": "exato", "score": 1.0},
        "protecao": {"valor": "IP66", "match": "exato", "score": 1.0},
        "conectividade": {"valor": "WiFi 2.4GHz", "match": "exato", "score": 1.0},
        "lente": {"valor": "3.6mm", "match": "exato", "score": 1.0},
        "aplicativo": {"valor": "iCSee", "match": "exato", "score": 1.0},
        "voltagem": {"valor": "Bivolt", "match": "parcial", "score": 0.5},
        "visao_noturna": {"valor": "Infravermelho", "match": "parcial", "score": 0.5},
        "antenas": {"valor": null, "match": "nao_encontrado", "score": 0.0}
      }
    }
  ]
}
```

## Endpoints adicionais

### GET /api/history
Retorna o histórico de buscas salvas no Supabase. Aceita query params: `?limit=20&offset=0`.

### GET /api/health
Retorna status da API, conexão com Supabase, e status da API do ML.

### DELETE /api/cache
Limpa cache expirado do Supabase.

## Arquivo de variações comuns (utils/specParser.js)

Incluir um dicionário de equivalências técnicas para melhorar o matching:

```javascript
const EQUIVALENCIAS = {
  conectividade: [
    ['WiFi', 'Wi-Fi', 'Wifi', 'WIFI', 'Wireless'],
    ['Bluetooth', 'BT'],
    ['Ethernet', 'RJ45', 'Cabo de rede'],
  ],
  voltagem: [
    ['Bivolt', '110v/220v', '110/220V', '110-220V', 'Automático'],
    ['110v', '110V', '127V', '127v'],
    ['220v', '220V'],
  ],
  protecao: [
    ['IP66', 'IP 66'],
    ['IP67', 'IP 67'],
    ['IP68', 'IP 68'],
  ],
  resolucao: [
    ['3MP', '3 MP', '3 Megapixels', '3 Megapixel'],
    ['2MP', '2 MP', '2 Megapixels', '1080p', 'Full HD'],
    ['5MP', '5 MP', '5 Megapixels'],
    ['4MP', '4 MP', '4 Megapixels', '2K'],
    ['8MP', '8 MP', '8 Megapixels', '4K'],
  ],
};
```

## Requisitos técnicos

- Usar ESModules (type: "module" no package.json)
- Tratar todos os erros com try/catch e retornar respostas adequadas
- Usar variáveis de ambiente para todas as configs (SUPABASE_URL, SUPABASE_KEY, PORT)
- Incluir .env.example com todas as variáveis necessárias
- Incluir README.md com instruções de setup, criação das tabelas no Supabase, e deploy no Render
- Incluir Dockerfile otimizado para Node.js
- Usar p-limit para controlar concorrência de requests ao ML
- Logs estruturados com timestamps nas operações principais
- CORS habilitado

## Importante

- NÃO usar IA/LLM para nada. Toda comparação é algorítmica.
- NÃO fazer scraping de páginas. Usar apenas a API oficial do ML.
- O foco é: funcionar, ser prático, e economizar tempo do usuário de licitações.
