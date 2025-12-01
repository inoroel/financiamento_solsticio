<script lang="ts">
  /**
   * Página mock em Svelte para testar os fluxos de pagamento
   * Backend: VERCEL (definir VITE_API_URL no .env do frontend)
   *
   * Exemplo .env.local no seu projeto Svelte:
   * VITE_API_URL=https://seu-backend.vercel.app
   */

  const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

  type TipoPagamento = 'PIX' | 'CREDITO' | 'DEBITO' | 'CRIPTO';

  let aba: 'pix' | 'cartao' | 'cripto' = 'pix';

  // Estado comum
  let cid = 'campanha-01';
  let valor = 10.5;

  // PIX
  let pixResposta: any = null;
  let pixTxidConsulta = '';
  let pixStatusConsulta: any = null;
  let carregandoPix = false;

  // Cartão
  let cartaoToken = '';
  let cartaoBandeira = 'visa';
  let cartaoTipo: 'CREDITO' | 'DEBITO' = 'CREDITO';
  let cartaoParcelas = 1;
  let cartaoResposta: any = null;
  let carregandoCartao = false;

  // Cripto (Stellar)
  let cryptoCurrency: 'USDC' | 'XLM' = 'USDC';
  let cryptoResposta: any = null;
  let cryptoHash = '';
  let cryptoConfirmacao: any = null;
  let carregandoCripto = false;
  let carregandoConfirmacaoCripto = false;

  async function gerarPagamento(tipo: TipoPagamento) {
    try {
      if (tipo === 'PIX') {
        carregandoPix = true;
      } else if (tipo === 'CRIPTO') {
        carregandoCripto = true;
      } else {
        carregandoCartao = true;
      }

      const body: any = {
        tipo_pagamento: tipo,
        valor,
        cid,
        doador: {
          anonimo: false,
          nome: 'Doador Teste',
          whatsapp: '5511999999999'
        }
      };

      if (tipo === 'CREDITO' || tipo === 'DEBITO') {
        if (!cartaoToken) {
          alert('Preencha um token de cartão para teste.');
          return;
        }
        body.tipo_pagamento = cartaoTipo;
        body.cartao = {
          token: cartaoToken,
          bandeira: cartaoBandeira
        };
        if (cartaoTipo === 'CREDITO') {
          body.parcelas = cartaoParcelas;
        }
      }

      if (tipo === 'CRIPTO') {
        body.currency = cryptoCurrency;
      }

      const res = await fetch(`${API_URL}/api/gerar-pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error(data);
        alert(data.error || 'Erro ao gerar pagamento');
        return;
      }

      if (tipo === 'PIX') {
        pixResposta = data;
        pixTxidConsulta = data.txid;
      } else if (tipo === 'CRIPTO') {
        cryptoResposta = data;
        // salva no localStorage para simular fluxo real
        localStorage.setItem(
          'pending_stellar_payment',
          JSON.stringify({
            txid: data.txid,
            memo: data.memo,
            recipient_address: data.recipient_address,
            currency: data.currency,
            valor: data.valor,
            created_at: new Date().toISOString()
          })
        );
      } else {
        cartaoResposta = data;
      }
    } catch (e) {
      console.error(e);
      alert('Erro de rede ao chamar backend');
    } finally {
      carregandoPix = false;
      carregandoCripto = false;
      carregandoCartao = false;
    }
  }

  async function consultarPixPorTxid() {
    if (!pixTxidConsulta) {
      alert('Informe um TXID para consulta.');
      return;
    }
    try {
      carregandoPix = true;
      const res = await fetch(`${API_URL}/api/cobranca/txid/${pixTxidConsulta}`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro na consulta');
        return;
      }
      pixStatusConsulta = data;
    } catch (e) {
      console.error(e);
      alert('Erro de rede ao consultar cobrança');
    } finally {
      carregandoPix = false;
    }
  }

  async function confirmarCriptoPorHash() {
    if (!cryptoHash) {
      alert('Informe o hash da transação Stellar (testnet).');
      return;
    }
    try {
      carregandoConfirmacaoCripto = true;
      const txid = cryptoResposta?.txid || undefined;
      const res = await fetch(`${API_URL}/api/confirm-donation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: cryptoHash, txid })
      });
      const data = await res.json();
      cryptoConfirmacao = data;
      if (!res.ok || !data.success) {
        alert(data.error || 'Erro ao confirmar pagamento cripto');
      } else {
        localStorage.removeItem('pending_stellar_payment');
        alert('Pagamento cripto confirmado com sucesso.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de rede ao confirmar cripto');
    } finally {
      carregandoConfirmacaoCripto = false;
    }
  }

  async function verificarCriptoPorMemo() {
    const pending = localStorage.getItem('pending_stellar_payment');
    if (!pending) {
      alert('Nenhum pagamento cripto pendente encontrado no localStorage.');
      return;
    }
    const payment = JSON.parse(pending);
    const memo = payment.memo || payment.txid;
    try {
      carregandoConfirmacaoCripto = true;
      const res = await fetch(`${API_URL}/api/check-payment-by-memo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo })
      });
      const data = await res.json();
      cryptoConfirmacao = data;
      if (!res.ok || !data.success) {
        alert(data.message || data.error || 'Pagamento não encontrado.');
      } else {
        localStorage.removeItem('pending_stellar_payment');
        alert('Pagamento cripto confirmado via memo.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de rede ao verificar por memo');
    } finally {
      carregandoConfirmacaoCripto = false;
    }
  }
</script>

<main class="page">
  <h1>Mock de Pagamentos - Financiamento Solstício</h1>
  <p>Backend: <code>{API_URL}</code></p>

  <section class="tabs">
    <button class:selected={aba === 'pix'} on:click={() => (aba = 'pix')}>PIX</button>
    <button class:selected={aba === 'cartao'} on:click={() => (aba = 'cartao')}>Cartão</button>
    <button class:selected={aba === 'cripto'} on:click={() => (aba = 'cripto')}>Cripto (Stellar)</button>
  </section>

  <section class="common">
    <h2>Parâmetros comuns</h2>
    <label>
      ID Campanha (cid)
      <input bind:value={cid} />
    </label>
    <label>
      Valor
      <input type="number" step="0.01" bind:value={valor} />
    </label>
  </section>

  {#if aba === 'pix'}
    <section class="pix">
      <h2>PIX (e-Rede)</h2>
      <button on:click={() => gerarPagamento('PIX')} disabled={carregandoPix}>
        {carregandoPix ? 'Gerando...' : 'Gerar cobrança PIX'}
      </button>

      {#if pixResposta}
        <h3>Resposta /api/gerar-pagamento</h3>
        <pre>{JSON.stringify(pixResposta, null, 2)}</pre>

        <h3>Consulta por TXID</h3>
        <label>
          TXID
          <input bind:value={pixTxidConsulta} />
        </label>
        <button on:click={consultarPixPorTxid} disabled={carregandoPix}>
          {carregandoPix ? 'Consultando...' : 'Consultar /api/cobranca/txid/:txid'}
        </button>

        {#if pixStatusConsulta}
          <h4>Resposta consulta</h4>
          <pre>{JSON.stringify(pixStatusConsulta, null, 2)}</pre>
        {/if}
      {/if}
    </section>
  {:else if aba === 'cartao'}
    <section class="cartao">
      <h2>Cartão (e-Rede)</h2>
      <label>
        Tipo
        <select bind:value={cartaoTipo}>
          <option value="CREDITO">Crédito</option>
          <option value="DEBITO">Débito</option>
        </select>
      </label>
      <label>
        Token do cartão (mock)
        <input bind:value={cartaoToken} />
      </label>
      <label>
        Bandeira
        <select bind:value={cartaoBandeira}>
          <option value="visa">Visa</option>
          <option value="mastercard">Mastercard</option>
          <option value="elo">Elo</option>
        </select>
      </label>
      {#if cartaoTipo === 'CREDITO'}
        <label>
          Parcelas
          <input type="number" min="1" max="12" bind:value={cartaoParcelas} />
        </label>
      {/if}

      <button on:click={() => gerarPagamento('CREDITO')} disabled={carregandoCartao}>
        {carregandoCartao ? 'Processando...' : 'Criar cobrança cartão'}
      </button>

      {#if cartaoResposta}
        <h3>Resposta /api/gerar-pagamento</h3>
        <pre>{JSON.stringify(cartaoResposta, null, 2)}</pre>
      {/if}
    </section>
  {:else}
    <section class="cripto">
      <h2>Cripto (Stellar)</h2>
      <label>
        Moeda
        <select bind:value={cryptoCurrency}>
          <option value="USDC">USDC</option>
          <option value="XLM">XLM</option>
        </select>
      </label>

      <button on:click={() => gerarPagamento('CRIPTO')} disabled={carregandoCripto}>
        {carregandoCripto ? 'Gerando...' : 'Gerar cobrança cripto'}
      </button>

      {#if cryptoResposta}
        <h3>Resposta /api/gerar-pagamento</h3>
        <pre>{JSON.stringify(cryptoResposta, null, 2)}</pre>

        <p>
          Envie {cryptoResposta.valor} {cryptoResposta.currency} para
          <code>{cryptoResposta.recipient_address}</code> com MEMO
          <code>{cryptoResposta.memo}</code>.
        </p>

        <h3>Confirmação automática (hash conhecido)</h3>
        <p>
          Após pagar na testnet, copie o <strong>hash</strong> da transação Stellar e informe
          abaixo para chamar <code>/api/confirm-donation</code>.
        </p>
        <label>
          Hash da transação Stellar
          <input bind:value={cryptoHash} />
        </label>
        <button on:click={confirmarCriptoPorHash} disabled={carregandoConfirmacaoCripto}>
          {carregandoConfirmacaoCripto ? 'Confirmando...' : 'Confirmar via /api/confirm-donation'}
        </button>

        <h3>Verificação via memo (simula página fechada)</h3>
        <p>
          Isso usa o <code>localStorage.pending_stellar_payment</code> e chama
          <code>/api/check-payment-by-memo</code>.
        </p>
        <button on:click={verificarCriptoPorMemo} disabled={carregandoConfirmacaoCripto}>
          {carregandoConfirmacaoCripto ? 'Verificando...' : 'Verificar via /api/check-payment-by-memo'}
        </button>
      {/if}

      {#if cryptoConfirmacao}
        <h3>Resposta confirmação cripto</h3>
        <pre>{JSON.stringify(cryptoConfirmacao, null, 2)}</pre>
      {/if}
    </section>
  {/if}
</main>

<style>
  .page {
    max-width: 960px;
    margin: 2rem auto;
    padding: 1rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  h1 {
    margin-bottom: 0.5rem;
  }

  section {
    margin-top: 1.5rem;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid #eee;
    background: #fafafa;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .tabs button {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: 1px solid #ccc;
    background: #fff;
    cursor: pointer;
  }

  .tabs button.selected {
    background: #111827;
    color: #fff;
    border-color: #111827;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
  }

  input,
  select,
  textarea {
    width: 100%;
    padding: 0.4rem 0.6rem;
    margin-top: 0.25rem;
    border-radius: 4px;
    border: 1px solid #d1d5db;
    font-size: 0.95rem;
  }

  button {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: none;
    background: #2563eb;
    color: #fff;
    cursor: pointer;
    font-weight: 500;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  pre {
    background: #111827;
    color: #e5e7eb;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    overflow-x: auto;
  }
</style>


