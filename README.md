# 🤖 Atendente Virtual WhatsApp — Higienização a Seco

Bot de atendimento inteligente com IA (Claude) integrado ao WhatsApp via Evolution API.

## O que ele faz

- Responde dúvidas sobre serviços e preços automaticamente
- Faz orçamentos na hora
- Coleta dados e confirma agendamentos
- Notifica você quando cliente pede para falar com humano
- Mantém histórico da conversa (memória de 30 minutos)

---

## 📋 PRÉ-REQUISITOS

- Node.js 18+ instalado
- Um servidor ou VPS (pode usar o seu PC em desenvolvimento)
- Conta na Anthropic para chave de API do Claude
- Evolution API instalada (passo 1 abaixo)

---

## 🚀 PASSO A PASSO DE INSTALAÇÃO

### Passo 1 — Instalar a Evolution API

A Evolution API é gratuita e conecta seu código ao WhatsApp.

**Opção A — Docker (recomendado):**
```bash
# Instale o Docker se não tiver: https://docs.docker.com/get-docker/

docker run -d \
  --name evolution-api \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=minha_chave_secreta \
  atendai/evolution-api:latest
```

**Opção B — Railway.app (sem servidor próprio):**
1. Acesse https://railway.app
2. Crie conta gratuita
3. Deploy do template Evolution API
4. Anote a URL pública gerada

---

### Passo 2 — Criar instância e conectar WhatsApp

1. Abra no navegador: `http://SEU_IP:8080` (ou a URL do Railway)
2. Acesse o painel Swagger ou use o comando abaixo:

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: minha_chave_secreta" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "higienizacao", "qrcode": true}'
```

3. Pegue o QR Code:
```bash
curl http://localhost:8080/instance/connect/higienizacao \
  -H "apikey: minha_chave_secreta"
```

4. Escaneie o QR Code com o WhatsApp Business da sua empresa
5. Pronto — WhatsApp conectado!

---

### Passo 3 — Obter chave da API do Claude

1. Acesse https://console.anthropic.com
2. Crie uma conta (há créditos gratuitos para testar)
3. Vá em "API Keys" → "Create Key"
4. Copie a chave (começa com `sk-ant-...`)

---

### Passo 4 — Configurar e rodar o bot

```bash
# Clone ou copie os arquivos do bot para uma pasta
cd whatsapp-bot

# Instale as dependências
npm install

# Copie o arquivo de configuração
cp .env.example .env

# Edite o .env com seus dados
nano .env
```

Preencha o `.env`:
```
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=minha_chave_secreta
EVOLUTION_INSTANCE=higienizacao
ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
OWNER_PHONE=244923000000
PORT=3000
```

Inicie o bot:
```bash
npm start
```

---

### Passo 5 — Registrar o Webhook

Diga à Evolution API para enviar mensagens para o seu bot:

```bash
curl -X POST http://localhost:8080/webhook/set/higienizacao \
  -H "apikey: minha_chave_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://SEU_IP:3000/webhook",
    "events": ["messages.upsert"]
  }'
```

> ⚠️ Se o bot estiver no seu PC local, use o **ngrok** para expor:
> ```bash
> npx ngrok http 3000
> # Use a URL https gerada como webhook
> ```

---

## ✅ TESTANDO

Envie uma mensagem para o número conectado. O bot deve responder automaticamente.

Mensagens de teste:
- "Olá"
- "Quanto custa limpar um sofá de 3 lugares?"
- "Quero agendar para amanhã"
- "Quero falar com um atendente"

---

## 🔧 PERSONALIZANDO

Para alterar preços, serviços ou comportamento do bot, edite o arquivo:
```
src/prompt.js
```

---

## 🌐 HOSPEDAGEM EM PRODUÇÃO (recomendado)

Para rodar 24/7 sem precisar deixar seu PC ligado:

| Serviço | Preço | Link |
|---------|-------|------|
| Railway.app | ~$5/mês | railway.app |
| Render.com | Grátis (dorme) / $7 ativo | render.com |
| DigitalOcean | $6/mês | digitalocean.com |
| VPS local (Angola) | Varia | - |

---

## 🆘 SUPORTE

Se tiver dúvidas, me chame no WhatsApp ou abra uma issue no repositório.
