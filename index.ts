import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { aws_rds as rds, aws_ec2 as ec2, App } from 'aws-cdk-lib';
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

    // SQS
    const queue = new sqs.Queue(this, 'MyQueue', {
      visibilityTimeout: Duration.seconds(30),
      receiveMessageWaitTime: Duration.seconds(0),
    });

    // VPC / SG
    const vpc = new ec2.Vpc(this, 'MyVpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'private-subnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSG', {
      vpc,
      description: 'Allow Lambda access to RDS',
      allowAllOutbound: true,
    });


    const lambdaSG = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc,
      description: 'Security Group for Lambda',
      allowAllOutbound: true,
    });

    rdsSecurityGroup.addIngressRule(
      lambdaSG,
      ec2.Port.tcp(5432),
      'Allow Lambda SG to access RDS'
    );

    // RDS
    const cluster = new rds.DatabaseCluster(this, 'AuroraServerlessCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_17_5,
      }),
      credentials: rds.Credentials.fromGeneratedSecret('banco_lab'),
      defaultDatabaseName: 'banco_lab',
      writer: rds.ClusterInstance.serverlessV2('writer'),
      serverlessV2MaxCapacity: 1,
      securityGroups: [rdsSecurityGroup],
      serverlessV2MinCapacity: 0.5,
      vpc,
    });


    // Lambda
    const myLambda = new lambda.Function(this, 'MyLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'lambdaCode.handler',
      code: lambda.Code.fromAsset('dist'),
      timeout: Duration.seconds(30),
      vpc,
      securityGroups: [lambdaSG],
      environment: {
        DB_HOST: cluster.clusterEndpoint.hostname,
        DB_PORT: cluster.clusterEndpoint.port.toString(),
        DB_NAME: 'banco_lab',
        DB_SECRET_ARN: cluster.secret?.secretArn || '',
      },
    });
    cluster.secret?.grantRead(myLambda);

    myLambda.addEventSource(new eventSources.SqsEventSource(queue, {
      batchSize: 1
    }));
  }
}

const app = new App();
new LambdaSqsStack(app, 'LambdaSqsStack');
