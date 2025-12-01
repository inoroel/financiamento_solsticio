# 🚀 Como Rodar o Mock de Pagamentos

## Opção 1: Criar um projeto SvelteKit mínimo (Recomendado)

### 1. Criar o projeto SvelteKit

```bash
# Na pasta Sites (ou onde preferir)
cd /Users/igor/Documents/Trabalho/Sites
npm create svelte@latest mock-pagamentos-solsticio
```

**Escolhas durante a criação:**
- Template: **Skeleton project**
- Type checking: **TypeScript** (ou JavaScript, como preferir)
- Adicionar ESLint: **Sim** (opcional)
- Adicionar Prettier: **Sim** (opcional)

### 2. Copiar o arquivo mock

```bash
# Copiar o arquivo mock para o projeto SvelteKit
cp financiamento_solsticio/MOCK_PAGAMENTOS.svelte mock-pagamentos-solsticio/src/routes/+page.svelte
```

### 3. Configurar variável de ambiente

Crie um arquivo `.env.local` na raiz do projeto SvelteKit:

```bash
cd mock-pagamentos-solsticio
echo "VITE_API_URL=https://financiamentosolsticio.vercel.app" > .env.local
```

**Substitua pela URL real do seu backend na Vercel se for diferente.**

### 4. Instalar dependências e rodar

```bash
npm install
npm run dev
```

Acesse: `http://localhost:5173`

---

## Opção 2: Usar Svelte puro (sem SvelteKit)

### 1. Criar projeto Vite + Svelte

```bash
cd /Users/igor/Documents/Trabalho/Sites
npm create vite@latest mock-pagamentos-solsticio -- --template svelte
cd mock-pagamentos-solsticio
npm install
```

### 2. Copiar o arquivo mock

```bash
# Substituir o App.svelte pelo mock
cp ../financiamento_solsticio/MOCK_PAGAMENTOS.svelte src/App.svelte
```

### 3. Configurar variável de ambiente

Crie `.env.local`:

```bash
echo "VITE_API_URL=https://financiamentosolsticio.vercel.app" > .env.local
```

### 4. Rodar

```bash
npm run dev
```

Acesse: `http://localhost:5173`

---

## Opção 3: Rodar direto no projeto backend (HTML estático)

Se você quiser testar rapidamente sem criar um projeto Svelte, pode converter o componente para HTML puro + JavaScript. Mas a **Opção 1 ou 2 são recomendadas**.

---

## ⚙️ Configuração da URL do Backend

**Importante:** Configure a variável `VITE_API_URL` no `.env.local` do projeto Svelte:

```env
# .env.local
VITE_API_URL=https://financiamentosolsticio.vercel.app
```

Se não configurar, o mock tentará usar `http://localhost:3000` (backend local).

---

## 🧪 Testando

1. **PIX**: Gera cobrança → mostra QR Code → consulta status
2. **Cartão**: Gera cobrança com token mock → mostra resposta
3. **Cripto**: Gera cobrança → mostra endereço + memo → confirma via hash ou memo

---

## 📝 Notas

- O mock salva pagamentos cripto no `localStorage` para simular o fluxo de "página fechada"
- Todos os endpoints chamam o backend na Vercel (ou local, se configurado)
- O mock não valida dados - apenas testa os fluxos de API

