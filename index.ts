import { Duration, SecretValue, Stack, StackProps, App } from 'aws-cdk-lib';
import { AuroraPostgresEngineVersion, ClusterInstance, DatabaseCluster, DatabaseClusterEngine, DatabaseProxy } from 'aws-cdk-lib/aws-rds';
import { IVpc, Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs';
import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Secret, } from 'aws-cdk-lib/aws-secretsmanager';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { ManagedPolicy, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

export class VpcRdsSqsStack extends Stack {
  public vpc: Vpc;
  public cluster: DatabaseCluster;
  public defaultDbName: string = 'banco_lab';
  public secret: Secret;
  constructor(scope: Construct, id: string, props?: StackProps & { enableProxy?: boolean }) {
    super(scope, id, {
      ...props
    });

    // SQS
    //new Queue(this, 'MyQueue', {
    //  visibilityTimeout: Duration.seconds(30),
    //  receiveMessageWaitTime: Duration.seconds(0),
    //});

    // VPC / SG
    this.vpc = new Vpc(this, 'MyVpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'private-subnet',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: SubnetType.PUBLIC,
        },
      ],
    });

    const rdsSecurityGroup = new SecurityGroup(this, 'RdsSG', {
      vpc: this.vpc,
      description: 'Allow Lambda access to RDS',
      allowAllOutbound: true,
    });

    rdsSecurityGroup.addIngressRule(
      Peer.ipv4(this.vpc.vpcCidrBlock),
      Port.tcp(5432)
    );

    // RDS
    const cluster = new DatabaseCluster(this, 'MyRDSCluster', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_17_5,
      }),
      //credentials: Credentials.fromGeneratedSecret('banco_lab'),
      defaultDatabaseName: this.defaultDbName,
      writer: ClusterInstance.serverlessV2('writer'),
      serverlessV2MaxCapacity: 1,
      securityGroups: [rdsSecurityGroup],
      serverlessV2MinCapacity: 0.5,
      vpc: this.vpc,
    });

    this.cluster = cluster;
    const password = cluster.secret?.secretValueFromJson('password').unsafeUnwrap();
    const username = cluster.secret?.secretValueFromJson('username').unsafeUnwrap();
    let secretStringObject: any = {
      dbArn: cluster.clusterArn,
      dbInstanceIdentifier: cluster.clusterIdentifier,
      host: cluster.clusterEndpoint.hostname,
      port: cluster.clusterEndpoint.port,
      dbname: this.defaultDbName,
      password,
      username
    }

    if (props?.enableProxy ?? false) {
      const proxy = cluster.addProxy('MyRdsProxy', {
        secrets: [cluster.secret!],
        vpc: this.vpc,
        securityGroups: [rdsSecurityGroup],
        requireTLS: false,
      });
      secretStringObject.proxyEndpoint = proxy.endpoint
    }

    const secretStringValue = SecretValue.unsafePlainText(
      JSON.stringify(secretStringObject, null, 2)
    )

    this.secret = new Secret(this, 'RdsSecret', {
      secretName: 'RdsSecret',
      secretStringValue
    })
  }
}

interface LambdaStackProps extends StackProps {
  vpc: IVpc;
  cluster: DatabaseCluster;
  secret: Secret;
}

export class LambdaStack extends Stack {
  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, {
      ...props
    });

    const lambdaSG = new SecurityGroup(this, 'LambdaSG', {
      vpc: props.vpc,
      description: 'Lambda SG',
      allowAllOutbound: true,
    });

    lambdaSG.addIngressRule(
      Peer.ipv4(props.vpc.vpcCidrBlock),
      Port.allTraffic()
    );

    const myLambda = new NodejsFunction(this, 'MyLambda', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'lambdaCode.handler',
      code: Code.fromAsset('dist'),
      timeout: Duration.seconds(30),
      entry: 'lambda/lambdaCode.mjs',
      vpc: props.vpc,
      securityGroups: [lambdaSG],
      environment: {
        DB_NAME: 'banco_lab',
        DB_SECRET_ARN: props.secret.secretArn || '',
      },
    });
    props.secret.grantRead(myLambda);
  }
}

const app = new App();
const vpcRdsSqsStack = new VpcRdsSqsStack(app, 'VpcRdsSqsStack', {
  enableProxy: true,
  env
})

const lambdaStack = new LambdaStack(app, 'LambdaStack', {
  vpc: vpcRdsSqsStack.vpc,
  cluster: vpcRdsSqsStack.cluster,
  secret: vpcRdsSqsStack.secret,
  env
});

lambdaStack.addDependency(vpcRdsSqsStack)