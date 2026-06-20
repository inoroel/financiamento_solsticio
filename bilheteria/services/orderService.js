// Serviço de operações de Pedidos e Ingressos
const { sql } = require('../config/database');
const { generateOrderCode, generateTicketCode } = require('../utils/validation');
const eventService = require('./eventService');

/**
 * Cria um novo pedido com reserva de ingressos
 */
async function createOrder(orderData) {
    try {
        const {
            evento_id, email_comprador, nome_comprador,
            cpf_comprador, telefone_comprador, usuario_id,
            itens // Array de { setor_id, quantidade, nome_titular?, cpf_titular? }
        } = orderData;

        // Valida evento existe
        const evento = await eventService.getEventById(evento_id);
        if (!evento) {
            return { success: false, error: 'Evento não encontrado' };
        }

        // Calcula valor total e valida disponibilidade
        let valorTotal = 0;
        const itensValidados = [];

        for (const item of itens) {
            const setor = await eventService.getSetorById(item.setor_id);
            if (!setor) {
                return { success: false, error: `Setor ${item.setor_id} não encontrado` };
            }

            if (setor.evento_id !== evento_id) {
                return { success: false, error: `Setor não pertence ao evento` };
            }

            const disponivel = setor.quantidade_total - setor.quantidade_vendida;
            if (item.quantidade > disponivel) {
                return { success: false, error: `Setor "${setor.nome}": apenas ${disponivel} ingressos disponíveis` };
            }

            if (item.quantidade > setor.max_por_pedido) {
                return { success: false, error: `Setor "${setor.nome}": máximo ${setor.max_por_pedido} por pedido` };
            }

            valorTotal += setor.preco * item.quantidade;
            itensValidados.push({
                ...item,
                setor,
                preco_unitario: setor.preco
            });
        }

        // Taxa de serviço (10%)
        const taxaServico = Math.round(valorTotal * 0.10 * 100) / 100;
        valorTotal = Math.round((valorTotal + taxaServico) * 100) / 100;

        // Gera código do pedido
        const codigo = generateOrderCode();

        // Expira em 15 minutos
        const expiraEm = new Date(Date.now() + 15 * 60 * 1000);

        // Cria pedido
        const pedidoResult = await sql`
      INSERT INTO pedidos (
        codigo, usuario_id, evento_id, email_comprador, nome_comprador,
        cpf_comprador, telefone_comprador, valor_total, taxa_servico, expira_em
      ) VALUES (
        ${codigo}, ${usuario_id || null}, ${evento_id}, ${email_comprador}, ${nome_comprador},
        ${cpf_comprador || null}, ${telefone_comprador || null}, ${valorTotal}, ${taxaServico}, ${expiraEm}
      )
      RETURNING *
    `;

        const pedido = pedidoResult.rows[0];

        // Reserva ingressos nos setores
        for (const item of itensValidados) {
            await eventService.updateSetorQuantidadeVendida(item.setor_id, item.quantidade);

            // Cria ingressos individuais (status PENDENTE até pagamento)
            for (let i = 0; i < item.quantidade; i++) {
                const codigoIngresso = generateTicketCode();
                await sql`
          INSERT INTO ingressos (
            codigo, pedido_id, setor_id, nome_titular, cpf_titular, status
          ) VALUES (
            ${codigoIngresso}, ${pedido.id}, ${item.setor_id}, 
            ${item.nome_titular || nome_comprador}, ${item.cpf_titular || cpf_comprador || null},
            'VALIDO'
          )
        `;
            }
        }

        return {
            success: true,
            pedido: {
                ...pedido,
                evento_titulo: evento.titulo,
                itens: itensValidados.map(i => ({
                    setor: i.setor.nome,
                    quantidade: i.quantidade,
                    preco_unitario: i.preco_unitario
                }))
            }
        };
    } catch (error) {
        console.error('❌ Erro ao criar pedido:', error.message);
        throw error;
    }
}

/**
 * Busca pedido por código
 */
async function getOrderByCode(codigo) {
    try {
        const result = await sql`
      SELECT p.*, e.titulo as evento_titulo, e.data_evento, e.local_nome
      FROM pedidos p
      JOIN eventos e ON e.id = p.evento_id
      WHERE p.codigo = ${codigo}
    `;

        if (result.rows.length === 0) {
            return null;
        }

        const pedido = result.rows[0];

        // Busca ingressos do pedido
        const ingressosResult = await sql`
      SELECT i.*, s.nome as setor_nome, s.preco
      FROM ingressos i
      JOIN setores s ON s.id = i.setor_id
      WHERE i.pedido_id = ${pedido.id}
    `;

        pedido.ingressos = ingressosResult.rows;
        return pedido;
    } catch (error) {
        console.error('❌ Erro ao buscar pedido:', error.message);
        throw error;
    }
}

/**
 * Atualiza status do pedido e registra pagamento
 */
async function updateOrderPayment(codigo, paymentData) {
    try {
        const { tipo_pagamento, provider, txid, dados_pagamento } = paymentData;

        const result = await sql`
      UPDATE pedidos 
      SET 
        status = 'PAGO',
        tipo_pagamento = ${tipo_pagamento},
        provider = ${provider || 'REDE'},
        txid = ${txid},
        dados_pagamento = ${JSON.stringify(dados_pagamento || {})},
        pago_em = NOW()
      WHERE codigo = ${codigo}
      RETURNING *
    `;

        return result.rows[0];
    } catch (error) {
        console.error('❌ Erro ao atualizar pagamento:', error.message);
        throw error;
    }
}

/**
 * Atualiza status do pedido
 */
async function updateOrderStatus(codigo, status) {
    try {
        const result = await sql`
      UPDATE pedidos SET status = ${status}
      WHERE codigo = ${codigo}
      RETURNING *
    `;
        return result.rows[0];
    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error.message);
        throw error;
    }
}

/**
 * Busca ingresso por código (para validação/check-in)
 */
async function getTicketByCode(codigo) {
    try {
        const result = await sql`
      SELECT 
        i.*,
        s.nome as setor_nome,
        p.codigo as pedido_codigo,
        p.status as pedido_status,
        p.nome_comprador,
        e.titulo as evento_titulo,
        e.data_evento,
        e.local_nome
      FROM ingressos i
      JOIN setores s ON s.id = i.setor_id
      JOIN pedidos p ON p.id = i.pedido_id
      JOIN eventos e ON e.id = p.evento_id
      WHERE i.codigo = ${codigo}
    `;

        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Erro ao buscar ingresso:', error.message);
        throw error;
    }
}

/**
 * Realiza check-in de um ingresso
 */
async function checkInTicket(codigo) {
    try {
        const ticket = await getTicketByCode(codigo);

        if (!ticket) {
            return { success: false, error: 'Ingresso não encontrado' };
        }

        if (ticket.pedido_status !== 'PAGO') {
            return { success: false, error: 'Pedido não está pago' };
        }

        if (ticket.status === 'USADO') {
            return {
                success: false,
                error: 'Ingresso já utilizado',
                usado_em: ticket.usado_em
            };
        }

        if (ticket.status === 'CANCELADO') {
            return { success: false, error: 'Ingresso cancelado' };
        }

        const result = await sql`
      UPDATE ingressos 
      SET status = 'USADO', usado_em = NOW()
      WHERE codigo = ${codigo}
      RETURNING *
    `;

        return {
            success: true,
            ingresso: result.rows[0],
            evento: ticket.evento_titulo,
            setor: ticket.setor_nome,
            titular: ticket.nome_titular || ticket.nome_comprador
        };
    } catch (error) {
        console.error('❌ Erro no check-in:', error.message);
        throw error;
    }
}

/**
 * Lista ingressos de um usuário
 */
async function getTicketsByUser(userId) {
    try {
        const result = await sql`
      SELECT 
        i.*,
        s.nome as setor_nome,
        p.codigo as pedido_codigo,
        p.status as pedido_status,
        e.titulo as evento_titulo,
        e.data_evento,
        e.local_nome,
        e.imagem_url
      FROM ingressos i
      JOIN setores s ON s.id = i.setor_id
      JOIN pedidos p ON p.id = i.pedido_id
      JOIN eventos e ON e.id = p.evento_id
      WHERE p.usuario_id = ${userId}
      ORDER BY e.data_evento ASC
    `;

        return result.rows;
    } catch (error) {
        console.error('❌ Erro ao buscar ingressos do usuário:', error.message);
        throw error;
    }
}

/**
 * Cancela pedidos expirados
 */
async function cancelExpiredOrders() {
    try {
        // Busca pedidos expirados
        const expiredResult = await sql`
      SELECT id, codigo FROM pedidos 
      WHERE status = 'AGUARDANDO' AND expira_em < NOW()
    `;

        if (expiredResult.rows.length === 0) {
            return { cancelled: 0 };
        }

        // Atualiza status para EXPIRADO
        await sql`
      UPDATE pedidos 
      SET status = 'EXPIRADO'
      WHERE status = 'AGUARDANDO' AND expira_em < NOW()
    `;

        // TODO: Devolver ingressos ao estoque
        // Por simplicidade, não implementado nesta versão inicial

        console.log(`⏰ ${expiredResult.rows.length} pedidos expirados cancelados`);
        return { cancelled: expiredResult.rows.length };
    } catch (error) {
        console.error('❌ Erro ao cancelar pedidos expirados:', error.message);
        throw error;
    }
}

module.exports = {
    createOrder,
    getOrderByCode,
    updateOrderPayment,
    updateOrderStatus,
    getTicketByCode,
    checkInTicket,
    getTicketsByUser,
    cancelExpiredOrders
};
