import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export class LambdaSqsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
      },
    });

    // 1. Criar a fila SQS
    const queue = new sqs.Queue(this, 'MyQueue', {
      visibilityTimeout: Duration.seconds(30),
      receiveMessageWaitTime: Duration.seconds(10),
    });

    // 2. Criar a função Lambda
    const myLambda = new lambda.Function(this, 'MyLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'lambdaCode.handler',
      code: lambda.Code.fromAsset('lambda'),
    });

    // 3. Conectar a fila como evento da Lambda
    myLambda.addEventSource(new eventSources.SqsEventSource(queue, {
      batchSize: 1, // número de mensagens por invocação
    }));
  }
}

const app = new cdk.App();
new LambdaSqsStack(app, 'LambdaSqsStack');
