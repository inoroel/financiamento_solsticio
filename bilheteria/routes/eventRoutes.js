// Rotas da API de Eventos
const express = require('express');
const router = express.Router();
const { listEventsLimiter, consultLimiter } = require('../middleware/security');
const eventService = require('../services/eventService');
const { validateSlug } = require('../utils/validation');

/**
 * GET /api/eventos
 * Lista eventos ativos com filtros
 */
router.get('/', listEventsLimiter, async (req, res) => {
    try {
        const { cidade, status, limit = 20, offset = 0 } = req.query;

        const eventos = await eventService.listEvents({
            cidade,
            status: status || 'ATIVO',
            limit: Math.min(parseInt(limit) || 20, 50),
            offset: parseInt(offset) || 0
        });

        res.json({
            success: true,
            eventos,
            total: eventos.length
        });
    } catch (error) {
        console.error('❌ Erro ao listar eventos:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar eventos'
        });
    }
});

/**
 * GET /api/eventos/:slug
 * Detalhes de um evento com setores
 */
router.get('/:slug', consultLimiter, async (req, res) => {
    try {
        const slug = validateSlug(req.params.slug);

        if (!slug) {
            return res.status(400).json({
                success: false,
                error: 'Slug inválido'
            });
        }

        const evento = await eventService.getEventBySlug(slug);

        if (!evento) {
            return res.status(404).json({
                success: false,
                error: 'Evento não encontrado'
            });
        }

        res.json({
            success: true,
            evento
        });
    } catch (error) {
        console.error('❌ Erro ao buscar evento:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar evento'
        });
    }
});

module.exports = router;
