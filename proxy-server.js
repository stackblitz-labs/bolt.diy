const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// O endereço real da API para a qual você está tentando fazer a chamada
const targetApiUrl = 'https://api.externa.com'; // <-- MUITO IMPORTANTE: SUBSTITUA PELA URL REAL DA API

const app = express();

const apiProxy = createProxyMiddleware({
  target: targetApiUrl,
  changeOrigin: true, // Necessário para que o servidor de destino não reclame
  secure: false,      // ★★★ A MÁGICA ACONTECE AQUI ★★★
                      // Diz ao proxy para ignorar certificados SSL inválidos/autoassinados.
  logLevel: 'debug',  // Mostra no console o que o proxy está fazendo, útil para depurar.
});

app.use('/', apiProxy);

app.listen(8080, () => {
  console.log('★★ Proxy local rodando na porta 8080 ★★');
  console.log(`Encaminhando chamadas para: ${targetApiUrl}`);
});