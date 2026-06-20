// Rotas da API de Pedidos
const express = require('express');
const router = express.Router();
const { createOrderLimiter, consultLimiter } = require('../middleware/security');
const { optionalAuthMiddleware } = require('../middleware/auth');
const orderService = require('../services/orderService');
const {
    validateEmail, validateNome, validateCPF,
    validateTelefone, validatePositiveInt
} = require('../utils/validation');

/**
 * POST /api/pedidos
 * Cria um novo pedido
 */
router.post('/', createOrderLimiter, optionalAuthMiddleware, async (req, res) => {
    try {
        const { evento_id, email, nome, cpf, telefone, itens } = req.body;

        // Validações
        const emailValidado = validateEmail(email);
        if (!emailValidado) {
            return res.status(400).json({ success: false, error: 'Email inválido' });
        }

        const nomeValidado = validateNome(nome);
        if (!nomeValidado) {
            return res.status(400).json({ success: false, error: 'Nome inválido' });
        }

        if (!evento_id || !Number.isInteger(evento_id)) {
            return res.status(400).json({ success: false, error: 'Evento inválido' });
        }

        if (!Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ success: false, error: 'Selecione ao menos um ingresso' });
        }

        // Valida itens
        const itensValidados = [];
        for (const item of itens) {
            const quantidade = validatePositiveInt(item.quantidade, 10);
            if (!quantidade || !item.setor_id) {
                return res.status(400).json({ success: false, error: 'Item inválido' });
            }
            itensValidados.push({
                setor_id: item.setor_id,
                quantidade,
                nome_titular: item.nome_titular ? validateNome(item.nome_titular) : null,
                cpf_titular: item.cpf_titular ? validateCPF(item.cpf_titular) : null
            });
        }

        const result = await orderService.createOrder({
            evento_id,
            email_comprador: emailValidado,
            nome_comprador: nomeValidado,
            cpf_comprador: cpf ? validateCPF(cpf) : null,
            telefone_comprador: telefone ? validateTelefone(telefone) : null,
            usuario_id: req.user?.id || null,
            itens: itensValidados
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(201).json({
            success: true,
            pedido: {
                codigo: result.pedido.codigo,
                valor_total: result.pedido.valor_total,
                taxa_servico: result.pedido.taxa_servico,
                expira_em: result.pedido.expira_em,
                evento_titulo: result.pedido.evento_titulo,
                itens: result.pedido.itens
            }
        });
    } catch (error) {
        console.error('❌ Erro ao criar pedido:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao processar pedido'
        });
    }
});

/**
 * GET /api/pedidos/:codigo
 * Status do pedido
 */
router.get('/:codigo', consultLimiter, async (req, res) => {
    try {
        const { codigo } = req.params;

        if (!codigo || codigo.length > 20) {
            return res.status(400).json({ success: false, error: 'Código inválido' });
        }

        const pedido = await orderService.getOrderByCode(codigo);

        if (!pedido) {
            return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
        }

        res.json({
            success: true,
            pedido: {
                codigo: pedido.codigo,
                status: pedido.status,
                valor_total: pedido.valor_total,
                taxa_servico: pedido.taxa_servico,
                tipo_pagamento: pedido.tipo_pagamento,
                evento_titulo: pedido.evento_titulo,
                data_evento: pedido.data_evento,
                local_nome: pedido.local_nome,
                pago_em: pedido.pago_em,
                expira_em: pedido.expira_em,
                ingressos: pedido.status === 'PAGO' ? pedido.ingressos.map(i => ({
                    codigo: i.codigo,
                    setor: i.setor_nome,
                    nome_titular: i.nome_titular,
                    status: i.status
                })) : []
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar pedido:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar pedido'
        });
    }
});

/**
 * POST /api/pedidos/:codigo/pagar
 * Inicia pagamento do pedido (integrar com gateway)
 */
router.post('/:codigo/pagar', createOrderLimiter, async (req, res) => {
    try {
        const { codigo } = req.params;
        const { tipo_pagamento } = req.body; // PIX, CREDITO, DEBITO

        const pedido = await orderService.getOrderByCode(codigo);

        if (!pedido) {
            return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
        }

        if (pedido.status !== 'AGUARDANDO') {
            return res.status(400).json({
                success: false,
                error: `Pedido não está aguardando pagamento (status: ${pedido.status})`
            });
        }

        // Verifica se expirou
        if (new Date(pedido.expira_em) < new Date()) {
            await orderService.updateOrderStatus(codigo, 'EXPIRADO');
            return res.status(400).json({ success: false, error: 'Pedido expirado' });
        }

        // TODO: Integrar com gateway de pagamento (e-Rede)
        // Por agora, retorna uma estrutura simulada

        const valorCentavos = Math.round(pedido.valor_total * 100);
        const txid = `BIL${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Simula resposta do gateway
        const paymentResponse = {
            tipo: tipo_pagamento || 'PIX',
            txid,
            valor: pedido.valor_total,
            // Se PIX, retorna QR Code simulado
            ...(tipo_pagamento === 'PIX' || !tipo_pagamento ? {
                qrcode: `00020126580014br.gov.bcb.pix0136${txid}5204000053039865802BR5913Bilheteria6008Sao Paulo62070503***6304`,
                qrcode_url: null
            } : {})
        };

        // Atualiza pedido com txid
        await orderService.updateOrderPayment(codigo, {
            tipo_pagamento: tipo_pagamento || 'PIX',
            provider: 'REDE',
            txid,
            dados_pagamento: paymentResponse
        });

        // Na prática, o status ainda seria AGUARDANDO até webhook confirmar
        // Mas para demo, marcamos como PAGO
        await orderService.updateOrderPayment(codigo, {
            tipo_pagamento: tipo_pagamento || 'PIX',
            provider: 'SIMULADO',
            txid,
            dados_pagamento: paymentResponse
        });

        res.json({
            success: true,
            pagamento: paymentResponse,
            message: 'Pagamento iniciado. Em ambiente de produção, aguarde confirmação do webhook.'
        });
    } catch (error) {
        console.error('❌ Erro ao processar pagamento:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao processar pagamento'
        });
    }
});

module.exports = router;
