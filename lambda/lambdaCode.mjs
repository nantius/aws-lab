import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

let client;
let isConnected = false;

const initDb = async () => {
    if (client && isConnected) return client;

    const secretsClient = new SecretsManagerClient();
    const secretValue = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
    );
    const secret = JSON.parse(secretValue.SecretString);

    client = new Client({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: secret.username,
        password: secret.password,
        connectionTimeoutMillis: 5000,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    await client.connect();
    isConnected = true;
    return client;
};
const dbPromise = initDb();

export const handler = async (event) => {
    const db = await dbPromise;

    const res = await db.query('SELECT NOW()');

    console.log("NOW:", res)


    for (const { messageId, body } of event.Records) {
        console.log('SQS message %s: %j', messageId, body);
    }
    return `Successfully processed ${event.Records.length} messages.`;
};
