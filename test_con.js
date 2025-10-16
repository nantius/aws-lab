const { Client } = require('pg');

const client = new Client({
    host: 'myrdsproxy.proxy-cg7qug0u03nr.us-east-1.rds.amazonaws.com',
    port: 5432,
    database: 'banco_lab',
    user: 'postgres',
    password: '^sPS,q7KD1QcV.7GSF2qiVN.n_T8f4',
});

client.connect()
    .then(() => console.log('Conectado com sucesso!'))
    .catch(err => console.error('Erro de conexão:', err));
