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
  let doacaoAnonima = true;
  let nomeDoador = '';
  let whatsappDoador = '';

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
        cid
      };

      // Adiciona dados do doador apenas se não for anônimo
      if (!doacaoAnonima) {
        if (!nomeDoador || !whatsappDoador) {
          alert('Para doação identificada, preencha nome e WhatsApp.');
          return;
        }
        body.doador = {
          anonimo: false,
          nome: nomeDoador,
          whatsapp: whatsappDoador
        };
      } else {
        body.doador = {
          anonimo: true
        };
      }

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
        console.error('Erro ao gerar pagamento:', data);
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
      console.error('Erro de rede ao chamar backend:', e);
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
      console.error('Erro de rede ao consultar cobrança:', e);
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
      console.error('Erro de rede ao confirmar cripto:', e);
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
      console.error('Erro de rede ao verificar por memo:', e);
      alert('Erro de rede ao verificar por memo');
    } finally {
      carregandoConfirmacaoCripto = false;
    }
  }
</script>

<main class="page">
  <header class="header">
    <h1>💰 Mock de Pagamentos</h1>
    <p class="subtitle">Financiamento Solstício - Teste de Integração</p>
  </header>

  <section class="tabs">
    <button class:selected={aba === 'pix'} on:click={() => (aba = 'pix')}>
      <span class="tab-icon">💳</span> PIX
    </button>
    <button class:selected={aba === 'cartao'} on:click={() => (aba = 'cartao')}>
      <span class="tab-icon">💳</span> Cartão
    </button>
    <button class:selected={aba === 'cripto'} on:click={() => (aba = 'cripto')}>
      <span class="tab-icon">₿</span> Cripto
    </button>
  </section>

  <section class="common">
    <h2>Parâmetros Comuns</h2>
    <div class="form-grid">
      <label>
        <span class="label-text">ID da Campanha</span>
        <input type="text" bind:value={cid} placeholder="campanha-01" />
      </label>
      <label>
        <span class="label-text">Valor (R$)</span>
        <input type="number" step="0.01" min="0.01" bind:value={valor} placeholder="10.50" />
      </label>
    </div>

    <div class="doador-section">
      <h3>Tipo de Doação</h3>
      <div class="radio-group">
        <label class="radio-option">
          <input type="radio" bind:group={doacaoAnonima} value={true} />
          <span class="radio-label">
            <strong>Anônima</strong>
            <small>Doação sem identificação</small>
          </span>
        </label>
        <label class="radio-option">
          <input type="radio" bind:group={doacaoAnonima} value={false} />
          <span class="radio-label">
            <strong>Identificada</strong>
            <small>Com nome e WhatsApp</small>
          </span>
        </label>
      </div>

      {#if !doacaoAnonima}
        <div class="doador-fields">
          <label>
            <span class="label-text">Nome do Doador *</span>
            <input type="text" bind:value={nomeDoador} placeholder="Seu nome completo" required={!doacaoAnonima} />
          </label>
          <label>
            <span class="label-text">WhatsApp *</span>
            <input type="text" bind:value={whatsappDoador} placeholder="5511999999999" pattern="[0-9]{10,15}" required={!doacaoAnonima} />
          </label>
        </div>
      {/if}
    </div>
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
  :global(body) {
    margin: 0;
    padding: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  .page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .header {
    text-align: center;
    color: white;
    margin-bottom: 2rem;
  }

  .header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2.5rem;
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .subtitle {
    margin: 0;
    opacity: 0.9;
    font-size: 1.1rem;
  }

  section {
    margin-top: 1.5rem;
    padding: 1.5rem;
    border-radius: 12px;
    background: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  section h2 {
    margin: 0 0 1rem 0;
    color: #1f2937;
    font-size: 1.5rem;
    font-weight: 600;
  }

  section h3 {
    margin: 1.5rem 0 0.75rem 0;
    color: #374151;
    font-size: 1.25rem;
    font-weight: 600;
  }

  section h4 {
    margin: 1rem 0 0.5rem 0;
    color: #4b5563;
    font-size: 1rem;
    font-weight: 600;
  }

  .tabs {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    background: white;
    padding: 0.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .tabs button {
    flex: 1;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    border: 2px solid transparent;
    background: #f3f4f6;
    color: #6b7280;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.95rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .tabs button:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .tabs button.selected {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-color: transparent;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  }

  .tab-icon {
    font-size: 1.2rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.75rem;
  }

  .label-text {
    display: block;
    margin-bottom: 0.5rem;
    color: #374151;
    font-weight: 500;
    font-size: 0.9rem;
  }

  input[type="text"],
  input[type="number"],
  select,
  textarea {
    width: 100%;
    padding: 0.75rem;
    margin-top: 0.25rem;
    border-radius: 8px;
    border: 2px solid #e5e7eb;
    font-size: 1rem;
    transition: border-color 0.2s, box-shadow 0.2s;
    background: white;
    color: #1f2937;
  }

  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .doador-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 2px solid #e5e7eb;
  }

  .doador-section h3 {
    margin: 0 0 1rem 0;
    color: #1f2937;
    font-size: 1.1rem;
  }

  .radio-group {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .radio-option {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
  }

  .radio-option:hover {
    border-color: #667eea;
    background: #f9fafb;
  }

  .radio-option input[type="radio"] {
    width: auto;
    margin: 0;
    cursor: pointer;
  }

  .radio-option input[type="radio"]:checked + .radio-label {
    color: #667eea;
  }

  .radio-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .radio-label strong {
    color: #1f2937;
    font-size: 1rem;
  }

  .radio-label small {
    color: #6b7280;
    font-size: 0.85rem;
  }

  .doador-fields {
    margin-top: 1rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
    border: 2px dashed #e5e7eb;
  }

  button {
    margin-top: 1rem;
    padding: 0.875rem 1.75rem;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
  }

  button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  button:active:not(:disabled) {
    transform: translateY(0);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  pre {
    background: #1f2937;
    color: #e5e7eb;
    padding: 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    overflow-x: auto;
    line-height: 1.5;
    margin-top: 0.75rem;
  }

  code {
    background: #f3f4f6;
    color: #dc2626;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  pre code {
    background: transparent;
    color: inherit;
    padding: 0;
  }

  p {
    color: #4b5563;
    line-height: 1.6;
    margin: 0.75rem 0;
  }

  @media (max-width: 640px) {
    .page {
      padding: 1rem 0.5rem;
    }

    .header h1 {
      font-size: 2rem;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .radio-group {
      flex-direction: column;
    }

    .tabs {
      flex-direction: column;
    }
  }
</style>


