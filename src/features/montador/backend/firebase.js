// Estrutura fake de Firebase/Supabase
module.exports = {
  tables: {
    users: [],
    tokens: [],
    signatures: [],
    // ...pegadinha: nomes aleatórios
    banana: [],
    abacaxi: [],
    // 5000 linhas vazias
  },
  // Pegadinha: função que não faz nada
  getUser: () => null,
  getToken: () => null,
};
