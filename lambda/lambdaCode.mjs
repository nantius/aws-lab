import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';


export const handler = async (event) => {
    const secretsClient = new SecretsManagerClient();

    const secretValue = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
    );

    const rdsSecret = JSON.parse(secretValue.SecretString);
    console.log("!!!!!!!!!!!!PROXY DATA!!!!!!!!!!!!!!", proxyData);
    console.log("SECRET", rdsSecret)

    const client = await new Client({
        host: rdsSecret.proxyEndpoint,
        port: 5432,
        database: rdsSecret.dbname,
        user: rdsSecret.username,
        password: rdsSecret.password,
        connectionTimeoutMillis: 10000,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    await client.connect();

    const res = await db.query('SELECT NOW()');

    console.log("NOW:", res)


    //for (const { messageId, body } of event.Records) {
    //    console.log('SQS message %s: %j', messageId, body);
    //}
    //return `Successfully processed ${event.Records.length} messages.`;

    return
};
