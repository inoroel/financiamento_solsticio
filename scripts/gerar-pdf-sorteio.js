#!/usr/bin/env node

/**
 * Script para gerar PDF com nomes para sorteio de pré-bilheteria
 * Cada doador aparece N vezes, onde N = número de tickets (1 ticket a cada R$ 50)
 * 
 * Uso: node scripts/gerar-pdf-sorteio.js
 * Saída: scripts/sorteio-YYYY-MM-DD.pdf
 */

require('dotenv').config();

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getDoadoresComTickets } = require('../services/dbService');

// Configurações do PDF
const TITULO = 'SORTEIO PRÉ-BILHETERIA SOLSTÍCIO';
const FONTE_TAMANHO = 20;

// Configurações das caixas (retângulos)
const CAIXA_LARGURA = 495;  // Largura fixa da caixa (página A4 - margens)
const CAIXA_ALTURA = 40;    // Altura fixa da caixa
const CAIXA_MARGEM_Y = 5;   // Espaço entre caixas
const MARGEM_ESQUERDA = 50;
const MARGEM_TOPO = 50;
const AREA_UTIL_ALTURA = 742; // 842 (A4) - 50 (topo) - 50 (rodapé)

/**
 * Gera array de nomes expandidos (cada nome repetido N vezes)
 */
function expandirNomes(doadores) {
    const nomesExpandidos = [];

    for (const doador of doadores) {
        for (let i = 0; i < doador.tickets; i++) {
            nomesExpandidos.push({
                nome: doador.nome,
                ticketNum: i + 1,
                totalTickets: doador.tickets
            });
        }
    }

    return nomesExpandidos;
}

/**
 * Embaralha array usando Fisher-Yates
 */
function embaralhar(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Desenha uma caixa com borda contendo o nome
 */
function desenharCaixa(doc, x, y, nome) {
    // Desenhar retângulo com borda
    doc.strokeColor('#333333')
        .lineWidth(1.5)
        .rect(x, y, CAIXA_LARGURA, CAIXA_ALTURA)
        .stroke();

    // Centralizar texto verticalmente e horizontalmente na caixa
    const textY = y + (CAIXA_ALTURA - FONTE_TAMANHO) / 2;

    doc.fontSize(FONTE_TAMANHO)
        .font('Helvetica')
        .fillColor('#000000')
        .text(nome, x, textY, {
            width: CAIXA_LARGURA,
            align: 'center',
            lineBreak: false
        });
}

/**
 * Gera o PDF com todos os tickets
 */
async function gerarPDF() {
    console.log('📄 Iniciando geração do PDF de sorteio...\n');

    try {
        // Buscar doadores com tickets (limite alto para pegar todos)
        console.log('🔍 Buscando doadores com tickets...');
        const doadores = await getDoadoresComTickets(10000, 0);

        if (!doadores || doadores.length === 0) {
            console.log('❌ Nenhum doador com tickets encontrado.');
            console.log('   Certifique-se de ter doadores identificados com pelo menos R$ 50 em doações.');
            process.exit(1);
        }

        console.log(`✅ Encontrados ${doadores.length} doadores com tickets.`);

        // Expandir nomes (repetir por quantidade de tickets)
        const ticketsExpandidos = expandirNomes(doadores);
        console.log(`🎫 Total de tickets para sorteio: ${ticketsExpandidos.length}`);

        // Embaralhar para sorteio justo
        const ticketsEmbaralhados = embaralhar(ticketsExpandidos);

        // Gerar nome do arquivo com data
        const dataAtual = new Date().toISOString().split('T')[0];
        const nomeArquivo = `sorteio-${dataAtual}.pdf`;
        const caminhoArquivo = path.join(__dirname, nomeArquivo);

        // Calcular quantas caixas cabem por página
        const alturaTotal = CAIXA_ALTURA + CAIXA_MARGEM_Y;
        const caixasPorPagina = Math.floor(AREA_UTIL_ALTURA / alturaTotal);

        // Criar documento PDF
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: MARGEM_TOPO, bottom: 50, left: MARGEM_ESQUERDA, right: 50 },
            info: {
                Title: TITULO,
                Author: 'Financiamento Solstício',
                Subject: 'Sorteio Pré-Bilheteria',
                CreationDate: new Date()
            }
        });

        // Stream para arquivo
        const stream = fs.createWriteStream(caminhoArquivo);
        doc.pipe(stream);

        // Variáveis de controle de posição
        let currentY = MARGEM_TOPO;
        let caixasNaPagina = 0;
        let paginaAtual = 1;

        // Desenhar todas as caixas
        for (let i = 0; i < ticketsEmbaralhados.length; i++) {
            const ticket = ticketsEmbaralhados[i];

            // Verificar se precisa nova página
            if (caixasNaPagina >= caixasPorPagina) {
                doc.addPage();
                paginaAtual++;
                currentY = MARGEM_TOPO;
                caixasNaPagina = 0;
            }

            // Desenhar a caixa com o nome
            desenharCaixa(doc, MARGEM_ESQUERDA, currentY, ticket.nome);

            // Avançar posição Y
            currentY += alturaTotal;
            caixasNaPagina++;
        }

        // Finalizar PDF
        doc.end();

        // Aguardar finalização da escrita
        await new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        console.log(`\n✅ PDF gerado com sucesso!`);
        console.log(`📂 Arquivo: ${caminhoArquivo}`);
        console.log(`\n📊 Resumo:`);
        console.log(`   - Doadores únicos: ${doadores.length}`);
        console.log(`   - Total de tickets: ${ticketsExpandidos.length}`);
        console.log(`   - Páginas: ${paginaAtual}`);
        console.log(`   - Valor por ticket: R$ 50,00`);

        // Mostrar top 5 doadores
        console.log(`\n🏆 Top 5 doadores por tickets:`);
        const top5 = [...doadores].sort((a, b) => b.tickets - a.tickets).slice(0, 5);
        top5.forEach((d, i) => {
            console.log(`   ${i + 1}. ${d.nome}: ${d.tickets} tickets (R$ ${d.tickets * 50},00)`);
        });

    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error.message);
        console.error(error.stack);
        process.exit(1);
    }

    process.exit(0);
}

// Executar
gerarPDF();
