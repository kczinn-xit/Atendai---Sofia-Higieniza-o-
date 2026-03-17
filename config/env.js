// config/env.js
// Carrega variáveis do arquivo .env em desenvolvimento
require("dotenv").config();

module.exports = {
  // URL da sua Evolution API (ex: http://localhost:8080 ou https://sua-evolution.com)
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || "http://localhost:8080",

  // Chave da API da Evolution (definida ao instalar)
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || "SUA_CHAVE_EVOLUTION",

  // Nome da instância criada na Evolution API
  EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE || "higienizacao",

  // Sua chave da API da Anthropic (Claude)
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "SUA_CHAVE_ANTHROPIC",

  // Seu número de WhatsApp pessoal (recebe notificações de transferência)
  // Formato: apenas números com código do país. Ex: 244923000000
  OWNER_PHONE: process.env.OWNER_PHONE || "244923000000",
};
