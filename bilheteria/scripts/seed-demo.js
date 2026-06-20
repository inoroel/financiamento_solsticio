// Script para inserir dados de demonstração no banco
// Execute após criar o banco: node scripts/seed-demo.js
require('dotenv').config();
const { sql, testConnection, initializeDatabase } = require('../config/database');

async function seedDemo() {
    console.log('🌱 Iniciando seed de demonstração...\n');

    // Testa conexão
    const connected = await testConnection();
    if (!connected.success) {
        console.error('❌ Não foi possível conectar ao banco de dados');
        process.exit(1);
    }

    // Inicializa tabelas
    await initializeDatabase();

    try {
        // Limpa dados existentes (cuidado em produção!)
        console.log('🧹 Limpando dados existentes...');
        await sql`DELETE FROM ingressos`;
        await sql`DELETE FROM pedidos`;
        await sql`DELETE FROM setores`;
        await sql`DELETE FROM eventos`;
        await sql`DELETE FROM usuarios`;

        // Cria eventos de demonstração
        console.log('🎫 Criando eventos...');

        const evento1 = await sql`
      INSERT INTO eventos (
        slug, titulo, descricao, local_nome, local_endereco, local_cidade, local_uf,
        data_evento, imagem_url, banner_url, organizador_nome, classificacao_etaria
      ) VALUES (
        'festival-solsticio-2024',
        'Festival Solstício 2024',
        'O maior festival de música eletrônica e cultura alternativa do Brasil. Três dias de música, arte e experiências transformadoras no coração da natureza.

Lineup confirmado:
• Headliners internacionais
• Palcos temáticos
• Instalações artísticas
• Área de camping
• Food trucks selecionados',
        'Fazenda Sol Nascente',
        'Rodovia SP-123, Km 45',
        'São Paulo',
        'SP',
        '2024-12-21 18:00:00',
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400',
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200',
        'Solstício Produções',
        '18 anos'
      )
      RETURNING id
    `;

        const evento2 = await sql`
      INSERT INTO eventos (
        slug, titulo, descricao, local_nome, local_cidade, local_uf,
        data_evento, imagem_url, organizador_nome, classificacao_etaria
      ) VALUES (
        'show-rock-classico',
        'Rock Clássico - Tributo às Lendas',
        'Uma noite épica celebrando os maiores clássicos do rock mundial. Bandas cover de Led Zeppelin, Pink Floyd, Queen e muito mais!',
        'Arena Multiuso',
        'Rio de Janeiro',
        'RJ',
        '2024-11-15 20:00:00',
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
        'Rock Forever',
        '16 anos'
      )
      RETURNING id
    `;

        const evento3 = await sql`
      INSERT INTO eventos (
        slug, titulo, descricao, local_nome, local_cidade, local_uf,
        data_evento, imagem_url, organizador_nome, classificacao_etaria
      ) VALUES (
        'stand-up-comedy-night',
        'Stand Up Comedy Night',
        'Os melhores comediantes do Brasil em uma noite de muitas risadas. Humor inteligente e diversão garantida!',
        'Teatro Municipal',
        'Belo Horizonte',
        'MG',
        '2024-11-08 21:00:00',
        'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400',
        'Cia do Riso',
        'Livre'
      )
      RETURNING id
    `;

        console.log('✅ Eventos criados:', evento1.rows[0].id, evento2.rows[0].id, evento3.rows[0].id);

        // Cria setores
        console.log('🎟️ Criando setores...');

        // Setores Festival
        await sql`
      INSERT INTO setores (evento_id, nome, descricao, preco, quantidade_total, max_por_pedido, ordem)
      VALUES 
        (${evento1.rows[0].id}, 'Passaporte 3 Dias', 'Acesso aos 3 dias do festival', 450.00, 1000, 4, 1),
        (${evento1.rows[0].id}, 'Passaporte VIP', 'Área VIP com open bar e camarins', 890.00, 200, 2, 2),
        (${evento1.rows[0].id}, 'Camping', 'Área de camping + passaporte 3 dias', 550.00, 500, 4, 3)
    `;

        // Setores Rock
        await sql`
      INSERT INTO setores (evento_id, nome, descricao, preco, quantidade_total, max_por_pedido, ordem)
      VALUES 
        (${evento2.rows[0].id}, 'Pista', 'Acesso à pista geral', 80.00, 2000, 6, 1),
        (${evento2.rows[0].id}, 'Cadeira Numerada', 'Poltrona confortável com visão privilegiada', 150.00, 500, 4, 2),
        (${evento2.rows[0].id}, 'Camarote', 'Área exclusiva com serviço de bebidas', 280.00, 100, 4, 3)
    `;

        // Setores Comedy
        await sql`
      INSERT INTO setores (evento_id, nome, descricao, preco, quantidade_total, max_por_pedido, ordem)
      VALUES 
        (${evento3.rows[0].id}, 'Plateia', 'Assentos na plateia principal', 60.00, 300, 6, 1),
        (${evento3.rows[0].id}, 'Mezanino', 'Vista panorâmica do palco', 45.00, 150, 6, 2)
    `;

        console.log('✅ Setores criados');

        // Cria usuário demo
        console.log('👤 Criando usuário demo...');
        const bcrypt = require('bcryptjs');
        const senhaHash = await bcrypt.hash('demo123', 10);

        await sql`
      INSERT INTO usuarios (email, nome, cpf, telefone, senha_hash)
      VALUES ('demo@bilheteria.com', 'Usuário Demo', '12345678901', '11999999999', ${senhaHash})
    `;

        console.log('✅ Usuário demo criado (email: demo@bilheteria.com, senha: demo123)');

        console.log('\n🎉 Seed concluído com sucesso!');
        console.log('\nPróximos passos:');
        console.log('1. Execute: npm run dev');
        console.log('2. Acesse: http://localhost:3001');

    } catch (error) {
        console.error('❌ Erro no seed:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

seedDemo();
