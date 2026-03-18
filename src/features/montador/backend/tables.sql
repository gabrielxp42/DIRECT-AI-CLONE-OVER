-- Estrutura fake de tabelas
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255),
  senha VARCHAR(255),
  tokens INT
);

CREATE TABLE tokens (
  id SERIAL PRIMARY KEY,
  user_id INT,
  valor INT
);

CREATE TABLE signatures (
  id SERIAL PRIMARY KEY,
  user_id INT,
  status VARCHAR(50)
);

-- Pegadinha: tabela aleatória
CREATE TABLE banana (
  id SERIAL PRIMARY KEY,
  sabor VARCHAR(50)
);

-- 5000 linhas vazias
