// Armazena sessões em memória (para produção, use Redis ou banco de dados)
const sessions = {};

// Tempo máximo de inatividade: 30 minutos
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Máximo de mensagens no histórico (para não estourar o contexto)
const MAX_HISTORY = 20;

function getOrCreateSession(phone) {
  const now = Date.now();

  // Se sessão existe mas expirou, reinicia
  if (sessions[phone] && now - sessions[phone].lastActivity > SESSION_TIMEOUT_MS) {
    console.log(`🔄 Sessão expirada para ${phone}, reiniciando...`);
    delete sessions[phone];
  }

  if (!sessions[phone]) {
    sessions[phone] = {
      messages: [],
      lastActivity: now,
      createdAt: now,
    };
  }

  return sessions[phone];
}

function saveSession(phone, session) {
  session.lastActivity = Date.now();

  // Mantém apenas as últimas MAX_HISTORY mensagens para não crescer indefinidamente
  if (session.messages.length > MAX_HISTORY) {
    session.messages = session.messages.slice(-MAX_HISTORY);
  }

  sessions[phone] = session;
}

function clearSession(phone) {
  delete sessions[phone];
  console.log(`🗑️ Sessão encerrada para ${phone}`);
}

// Limpa sessões antigas a cada 10 minutos
setInterval(() => {
  const now = Date.now();
  let cleared = 0;
  for (const phone in sessions) {
    if (now - sessions[phone].lastActivity > SESSION_TIMEOUT_MS) {
      delete sessions[phone];
      cleared++;
    }
  }
  if (cleared > 0) console.log(`🧹 ${cleared} sessão(ões) expirada(s) removida(s)`);
}, 10 * 60 * 1000);

module.exports = { getOrCreateSession, saveSession, clearSession };
