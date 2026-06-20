// Rotas da API de Ingressos
const express = require('express');
const router = express.Router();
const { consultLimiter } = require('../middleware/security');
const { authMiddleware } = require('../middleware/auth');
const orderService = require('../services/orderService');

/**
 * GET /api/ingressos/:codigo
 * Valida um ingresso (para check-in)
 */
router.get('/:codigo', consultLimiter, async (req, res) => {
    try {
        const { codigo } = req.params;

        if (!codigo || codigo.length !== 30) {
            return res.status(400).json({ success: false, error: 'Código inválido' });
        }

        const ingresso = await orderService.getTicketByCode(codigo);

        if (!ingresso) {
            return res.status(404).json({ success: false, error: 'Ingresso não encontrado' });
        }

        res.json({
            success: true,
            ingresso: {
                codigo: ingresso.codigo,
                status: ingresso.status,
                setor: ingresso.setor_nome,
                nome_titular: ingresso.nome_titular,
                evento: ingresso.evento_titulo,
                data_evento: ingresso.data_evento,
                local: ingresso.local_nome,
                pedido_status: ingresso.pedido_status,
                usado_em: ingresso.usado_em
            }
        });
    } catch (error) {
        console.error('❌ Erro ao validar ingresso:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao validar ingresso'
        });
    }
});

/**
 * POST /api/ingressos/:codigo/checkin
 * Realiza check-in de um ingresso
 */
router.post('/:codigo/checkin', consultLimiter, async (req, res) => {
    try {
        const { codigo } = req.params;

        if (!codigo || codigo.length !== 30) {
            return res.status(400).json({ success: false, error: 'Código inválido' });
        }

        const result = await orderService.checkInTicket(codigo);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            message: 'Check-in realizado com sucesso!',
            ingresso: {
                codigo,
                evento: result.evento,
                setor: result.setor,
                titular: result.titular
            }
        });
    } catch (error) {
        console.error('❌ Erro no check-in:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao realizar check-in'
        });
    }
});

/**
 * GET /api/ingressos/meus
 * Lista ingressos do usuário logado
 */
router.get('/usuario/meus', authMiddleware, async (req, res) => {
    try {
        const ingressos = await orderService.getTicketsByUser(req.user.id);

        res.json({
            success: true,
            ingressos: ingressos.map(i => ({
                codigo: i.codigo,
                status: i.status,
                setor: i.setor_nome,
                nome_titular: i.nome_titular,
                evento: i.evento_titulo,
                data_evento: i.data_evento,
                local: i.local_nome,
                imagem_url: i.imagem_url,
                pedido_codigo: i.pedido_codigo,
                pedido_status: i.pedido_status
            }))
        });
    } catch (error) {
        console.error('❌ Erro ao buscar ingressos:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar ingressos'
        });
    }
});

module.exports = router;
