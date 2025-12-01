// Handler para Vercel Serverless Functions
// Este arquivo exporta o app Express para ser usado como serverless function

// Importa o app Express
const app = require('../server');

// Exporta o handler para Vercel
// A Vercel vai chamar este handler para cada requisição
module.exports = app;

