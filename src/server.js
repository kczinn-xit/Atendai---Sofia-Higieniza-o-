const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, OWNER_PHONE } = require("../config/env");
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const { getOrCreateSession, saveSession, clearSession } = require("./sessions");
const { buildSystemPrompt } = require("./prompt");

// ── Webhook recebe mensagens da Evolution API ──────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // responde imediatamente para não dar timeout
  try {
    const body = req.body;

    // Filtra apenas mensagens de texto recebidas (não enviadas pelo bot)
    if (body.event !== "messages.upsert") return;
    const msg = body.data;
    if (!msg || msg.key?.fromMe) return;

    const from = msg.key.remoteJid; // ex: 244923000000@s.whatsapp.net
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) return;

    const phone = from.replace("@s.whatsapp.net", "").replace("@g.us", "");
    console.log(`📩 [${phone}] ${text}`);

    // Comando especial: cliente pede para falar com humano
    if (/humano|atendente|pessoa|operador/i.test(text)) {
      await sendMessage(from, "⏳ Entendido! Estou transferindo você para um atendente humano. Aguarde um momento...");
      await notifyOwner(phone, text);
      clearSession(phone);
      return;
    }

    // Monta histórico de conversa da sessão
    const session = getOrCreateSession(phone);
    session.messages.push({ role: "user", content: text });

    // Chama Groq
    const reply = await askGroq(session.messages);

    // Salva resposta no histórico
    session.messages.push({ role: "assistant", content: reply });
    saveSession(phone, session);

    // Envia resposta ao cliente
    await sendMessage(from, reply);
    console.log(`📤 [${phone}] ${reply.substring(0, 80)}...`);
  } catch (err) {
    console.error("Erro no webhook:", err.message, err.response?.data);
  }
});

// ── Envia mensagem via Evolution API ──────────────────────────────────────
async function sendMessage(to, text) {
  await axios.post(
    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    { number: to, text },
    { headers: { apikey: EVOLUTION_API_KEY } }
  );
}

// ── Notifica dono quando cliente pede humano ──────────────────────────────
async function notifyOwner(clientPhone, lastMessage) {
  const ownerJid = `${OWNER_PHONE}@s.whatsapp.net`;
  const msg = `🔔 *Transferência solicitada!*\n\nCliente: *${clientPhone}*\nÚltima mensagem: "${lastMessage}"\n\nResponda diretamente para ${clientPhone}`;
  await sendMessage(ownerJid, msg);
}

// ── Chama a API do Groq ───────────────────────────────────────────────────
async function askGroq(messages) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "mixtral-8x7b-32768",
      max_tokens: 1024,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        ...messages
      ],
    },
    {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.choices[0].message.content;
}

// ── Health check ──────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "ok", bot: "Higienização a Seco" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Bot rodando na porta ${PORT}`));
