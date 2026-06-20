// Serviço de operações de Eventos
const { sql } = require('../config/database');

/**
 * Lista eventos ativos com filtros opcionais
 */
async function listEvents(filters = {}) {
    try {
        const { cidade, status = 'ATIVO', limit = 20, offset = 0 } = filters;

        let query = `
      SELECT 
        e.id, e.slug, e.titulo, e.descricao,
        e.local_nome, e.local_cidade, e.local_uf,
        e.data_evento, e.data_fim, e.imagem_url, e.banner_url,
        e.status, e.organizador_nome, e.classificacao_etaria,
        MIN(s.preco) as preco_minimo,
        SUM(s.quantidade_total - s.quantidade_vendida) as ingressos_disponiveis
      FROM eventos e
      LEFT JOIN setores s ON s.evento_id = e.id AND s.status = 'DISPONIVEL'
      WHERE e.status = $1
        AND e.data_evento >= NOW()
    `;

        const params = [status];
        let paramIndex = 2;

        if (cidade) {
            query += ` AND LOWER(e.local_cidade) = LOWER($${paramIndex})`;
            params.push(cidade);
            paramIndex++;
        }

        query += `
      GROUP BY e.id
      ORDER BY e.data_evento ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
        params.push(limit, offset);

        const result = await sql.query(query);
        return result.rows;
    } catch (error) {
        console.error('❌ Erro ao listar eventos:', error.message);
        throw error;
    }
}

/**
 * Busca evento por slug com setores disponíveis
 */
async function getEventBySlug(slug) {
    try {
        // Busca evento
        const eventResult = await sql`
      SELECT 
        id, slug, titulo, descricao,
        local_nome, local_endereco, local_cidade, local_uf,
        data_evento, data_fim, imagem_url, banner_url,
        status, organizador_nome, classificacao_etaria,
        criado_em, atualizado_em
      FROM eventos
      WHERE slug = ${slug}
    `;

        if (eventResult.rows.length === 0) {
            return null;
        }

        const evento = eventResult.rows[0];

        // Busca setores do evento
        const setoresResult = await sql`
      SELECT 
        id, nome, descricao, preco,
        quantidade_total, quantidade_vendida,
        (quantidade_total - quantidade_vendida) as disponivel,
        max_por_pedido, status, ordem
      FROM setores
      WHERE evento_id = ${evento.id}
        AND status != 'ENCERRADO'
      ORDER BY ordem ASC, preco ASC
    `;

        evento.setores = setoresResult.rows;
        return evento;
    } catch (error) {
        console.error('❌ Erro ao buscar evento:', error.message);
        throw error;
    }
}

/**
 * Busca evento por ID
 */
async function getEventById(id) {
    try {
        const result = await sql`
      SELECT * FROM eventos WHERE id = ${id}
    `;
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erro ao buscar evento por ID:', error.message);
        throw error;
    }
}

/**
 * Cria um novo evento
 */
async function createEvent(eventData) {
    try {
        const {
            slug, titulo, descricao, local_nome, local_endereco,
            local_cidade, local_uf, data_evento, data_fim,
            imagem_url, banner_url, organizador_nome, classificacao_etaria
        } = eventData;

        const result = await sql`
      INSERT INTO eventos (
        slug, titulo, descricao, local_nome, local_endereco,
        local_cidade, local_uf, data_evento, data_fim,
        imagem_url, banner_url, organizador_nome, classificacao_etaria
      ) VALUES (
        ${slug}, ${titulo}, ${descricao}, ${local_nome}, ${local_endereco},
        ${local_cidade}, ${local_uf}, ${data_evento}, ${data_fim || null},
        ${imagem_url || null}, ${banner_url || null}, ${organizador_nome || null}, ${classificacao_etaria || null}
      )
      RETURNING *
    `;

        return result.rows[0];
    } catch (error) {
        console.error('❌ Erro ao criar evento:', error.message);
        throw error;
    }
}

/**
 * Cria um setor para um evento
 */
async function createSetor(setorData) {
    try {
        const {
            evento_id, nome, descricao, preco,
            quantidade_total, max_por_pedido, ordem
        } = setorData;

        const result = await sql`
      INSERT INTO setores (
        evento_id, nome, descricao, preco,
        quantidade_total, max_por_pedido, ordem
      ) VALUES (
        ${evento_id}, ${nome}, ${descricao || null}, ${preco},
        ${quantidade_total}, ${max_por_pedido || 10}, ${ordem || 0}
      )
      RETURNING *
    `;

        return result.rows[0];
    } catch (error) {
        console.error('❌ Erro ao criar setor:', error.message);
        throw error;
    }
}

/**
 * Busca setor por ID
 */
async function getSetorById(id) {
    try {
        const result = await sql`
      SELECT * FROM setores WHERE id = ${id}
    `;
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erro ao buscar setor:', error.message);
        throw error;
    }
}

/**
 * Atualiza quantidade vendida de um setor
 */
async function updateSetorQuantidadeVendida(setorId, quantidade) {
    try {
        const result = await sql`
      UPDATE setores 
      SET quantidade_vendida = quantidade_vendida + ${quantidade}
      WHERE id = ${setorId}
      RETURNING *
    `;
        return result.rows[0];
    } catch (error) {
        console.error('❌ Erro ao atualizar setor:', error.message);
        throw error;
    }
}

module.exports = {
    listEvents,
    getEventBySlug,
    getEventById,
    createEvent,
    createSetor,
    getSetorById,
    updateSetorQuantidadeVendida
};
