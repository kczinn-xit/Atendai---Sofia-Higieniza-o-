const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, OWNER_PHONE } = require("../config/env");
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const { getOrCreateSession, saveSession, clearSession } = require("./sessions");
const { buildSystemPrompt } = require("./prompt");

// ── Resolve JID @lid para número real via Evolution API ───────────────────
async function resolveJid(rawJid) {
  // Se não for @lid, retorna directo
  if (!rawJid.includes("@lid")) return rawJid;

  try {
    // Tenta buscar o contacto pelo JID na Evolution API
    const lid = rawJid.replace("@lid", "");
    const res = await axios.get(
      `${EVOLUTION_API_URL}/chat/findContacts/${EVOLUTION_INSTANCE}`,
      {
        headers: { apikey: EVOLUTION_API_KEY },
        params: { where: JSON.stringify({ id: rawJid }) }
      }
    );
    const contacts = res.data;
    if (contacts && contacts.length > 0) {
      const contact = contacts[0];
      // Tenta pegar o número real do contacto
      const realNumber = contact.pushName ? contact.id : null;
      if (realNumber && !realNumber.includes("@lid")) {
        console.log(`✅ LID resolvido: ${rawJid} → ${realNumber}`);
        return realNumber;
      }
    }
  } catch (e) {
    console.log("Não conseguiu resolver LID via contacts:", e.message);
  }

  // Fallback: tenta via fetchProfile
  try {
    const res = await axios.post(
      `${EVOLUTION_API_URL}/chat/fetchProfile/${EVOLUTION_INSTANCE}`,
      { number: rawJid },
      { headers: { apikey: EVOLUTION_API_KEY } }
    );
    if (res.data?.jid && !res.data.jid.includes("@lid")) {
      console.log(`✅ LID resolvido via profile: ${rawJid} → ${res.data.jid}`);
      return res.data.jid;
    }
  } catch (e) {
    console.log("Não conseguiu resolver LID via profile:", e.message);
  }

  // Último fallback: usa o LID mesmo (pode não funcionar)
  console.log(`⚠️ Não conseguiu resolver LID ${rawJid}, usando original`);
  return rawJid;
}

// ── Webhook recebe mensagens da Evolution API ──────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;

    if (body.event !== "messages.upsert") return;
    const msg = body.data;
    if (!msg || msg.key?.fromMe) return;

    const rawJid = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) return;

    // Resolve o JID real se for @lid
    const from = await resolveJid(rawJid);
    const phone = from.replace("@s.whatsapp.net", "").replace("@g.us", "").replace("@lid", "");

    console.log(`📩 [${phone}] ${text}`);

    if (/humano|atendente|pessoa|operador/i.test(text)) {
      await sendMessage(from, "⏳ Entendido! Estou transferindo você para um atendente humano. Aguarde um momento...");
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

    console.log(`📤 Enviando para ${from}...`);
    await sendMessage(from, reply);
    console.log(`📤 Enviado!`);
  } catch (err) {
    const detail = JSON.stringify(err.response?.data) || err.message;
    const url = err.config?.url || "url desconhecida";
    console.error(`Erro no webhook [${url}]:`, detail);
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
