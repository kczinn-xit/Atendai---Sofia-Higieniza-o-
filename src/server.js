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
  res.sendStatus(200);
  try {
    const body = req.body;

    if (body.event !== "messages.upsert") return;
    const msg = body.data;
    if (!msg || msg.key?.fromMe) return;

    const rawJid = msg.key.remoteJid;
    const isLid = rawJid.includes("@lid");
    const phone = rawJid.replace("@s.whatsapp.net", "").replace("@g.us", "").replace("@lid", "");

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) return;

    console.log(`📩 [${phone}] ${text} | isLid: ${isLid}`);

    if (/humano|atendente|pessoa|operador/i.test(text)) {
      await sendMessage(rawJid, isLid);
      await notifyOwner(phone, text);
      clearSession(phone);
      return;
    }

    const session = getOrCreateSession(phone);
    session.messages.push({ role: "user", content: text });

    console.log("🤖 Chamando Groq...");
    const reply = await askGroq(session.messages);
    console.log("✅ Groq respondeu!");

    session.messages.push({ role: "assistant", content: reply });
    saveSession(phone, session);

    console.log(`📤 Enviando para ${rawJid} (lid: ${isLid})...`);
    await sendMessage(rawJid, reply, isLid);
    console.log(`📤 Enviado!`);
  } catch (err) {
    const detail = JSON.stringify(err.response?.data) || err.message;
    const url = err.config?.url || "url desconhecida";
    console.error(`Erro no webhook [${url}]:`, detail);
  }
});

// ── Envia mensagem via Evolution API ──────────────────────────────────────
async function sendMessage(to, text, isLid = false) {
  if (isLid) {
    // Para @lid, usa o número sem sufixo e deixa a API resolver
    const number = to.replace("@lid", "").replace("@s.whatsapp.net", "");
    try {
      // Tenta primeiro com o JID completo @lid
      await axios.post(
        `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
        { number: to, text },
        { headers: { apikey: EVOLUTION_API_KEY } }
      );
      return;
    } catch (e) {
      console.log("Falhou com @lid, tentando com número puro...");
    }
    // Fallback: tenta com número puro
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      { number: number, text },
      { headers: { apikey: EVOLUTION_API_KEY } }
    );
  } else {
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      { number: to, text },
      { headers: { apikey: EVOLUTION_API_KEY } }
    );
  }
}

// ── Notifica dono quando cliente pede humano ──────────────────────────────
async function notifyOwner(clientPhone, lastMessage) {
  const ownerJid = `${OWNER_PHONE}@s.whatsapp.net`;
  const msg = `🔔 *Transferência solicitada!*\n\nCliente: *${clientPhone}*\nÚltima mensagem: "${lastMessage}"\n\nResponda diretamente para ${clientPhone}`;
  await axios.post(
    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    { number: ownerJid, text: msg },
    { headers: { apikey: EVOLUTION_API_KEY } }
  );
}

// ── Chama a API do Groq ───────────────────────────────────────────────────
async function askGroq(messages) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
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
