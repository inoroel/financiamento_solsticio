# Bilheteria Solstício

Sistema de bilheteria virtual para venda de ingressos online.

## 🚀 Início Rápido

### 1. Instalar dependências

```bash
cd bilheteria
npm install
```

### 2. Configurar ambiente

Copie o arquivo `.env.template` para `.env` e configure as variáveis:

```bash
cp .env.template .env
```

Edite o `.env` com suas credenciais do banco de dados PostgreSQL.

### 3. Inicializar banco de dados

```bash
npm run init-db
```

### 4. (Opcional) Carregar dados de demonstração

```bash
node scripts/seed-demo.js
```

### 5. Executar servidor

```bash
npm run dev
```

Acesse: http://localhost:3001

## 📋 Endpoints da API

### Eventos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/eventos` | Lista eventos ativos |
| GET | `/api/eventos/:slug` | Detalhes do evento |

### Pedidos

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/pedidos` | Cria novo pedido |
| GET | `/api/pedidos/:codigo` | Status do pedido |
| POST | `/api/pedidos/:codigo/pagar` | Gera pagamento |

### Ingressos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/ingressos/:codigo` | Valida ingresso |
| POST | `/api/ingressos/:codigo/checkin` | Realiza check-in |

### Usuários

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/usuarios/registro` | Criar conta |
| POST | `/api/usuarios/login` | Login |
| GET | `/api/usuarios/perfil` | Ver perfil (auth) |

## 🛠️ Tecnologias

- **Backend**: Node.js, Express
- **Banco de dados**: PostgreSQL
- **Autenticação**: JWT
- **Deploy**: Vercel

## 📁 Estrutura

```
bilheteria/
├── api/              # Handler Vercel
├── config/           # Configurações
├── middleware/       # Auth, segurança, erros
├── public/           # Frontend (HTML, CSS, JS)
├── routes/           # Rotas da API
├── scripts/          # Scripts SQL e seeds
├── services/         # Lógica de negócio
├── utils/            # Validações
├── server.js         # Servidor Express
└── vercel.json       # Config Vercel
```
