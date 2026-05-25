import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';

export class NestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a Secrets Manager secret for database credentials
    const dbCredentialsSecret = new secretsmanager.Secret(this, 'MyDBCreds', {
      secretName: 'MyDBCredsName',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'myadminuser',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    // Create a VPC for the Lambda function
    const vpc = new ec2.Vpc(this, 'MyVPC', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // Create a RDS instance for the NestJS application
    const dbInstance = new rds.DatabaseInstance(this, 'RDSInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      databaseName: 'mydb',
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      credentials: rds.Credentials.fromSecret(dbCredentialsSecret),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    // Create the API Gateway REST API
    const apiGateway = new apigateway.RestApi(this, 'NestServiceApiGateway', {
      restApiName: 'Nest Service',
      description: 'API for the Nest Service',
    });

    const projectRoot = path.join(__dirname, '../../../');

    // Create the Lambda function for NestJS
    const nestJsLambdaFunction = new lambdaNodejs.NodejsFunction(
      this,
      'NestJsLambdaFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(projectRoot, 'src/handler.ts'),
        projectRoot,
        handler: 'handler',
        bundling: {
          minify: true,
          sourceMap: false,
          externalModules: [
            '@nestjs/microservices',
            '@nestjs/websockets/socket-module',
            'cache-manager',
            'class-transformer',
            'class-validator',
            'expo-sqlite',
          ],
        },
        vpc,
        allowPublicSubnet: true,
        securityGroups: [dbInstance.connections.securityGroups[0]],
        environment: {
          DB_HOST: dbInstance.dbInstanceEndpointAddress,
          DB_PORT: dbInstance.dbInstanceEndpointPort,
          DB_NAME: 'mydb',
          DB_USERNAME: dbCredentialsSecret
            .secretValueFromJson('username')
            .unsafeUnwrap(),
          DB_PASSWORD: dbCredentialsSecret
            .secretValueFromJson('password')
            .unsafeUnwrap(),
        },
        timeout: cdk.Duration.seconds(30),
      },
    );

    // Allow the Lambda function to connect to the RDS instance and read the database credentials secret
    dbInstance.connections.allowDefaultPortFrom(nestJsLambdaFunction);
    dbCredentialsSecret.grantRead(nestJsLambdaFunction);

    // Integrate the Lambda function with API Gateway
    const nestJsLambdaIntegration = new apigateway.LambdaIntegration(
      nestJsLambdaFunction,
    );

    // Set up API Gateway routes to proxy requests to the Lambda function
    apiGateway.root.addMethod('ANY', nestJsLambdaIntegration);
    apiGateway.root
      .addResource('{proxy+}')
      .addMethod('ANY', nestJsLambdaIntegration);

    new cdk.CfnOutput(this, 'DbCredentialsSecretArn', {
      value: dbCredentialsSecret.secretArn,
      description: 'The ARN of the database credentials secret',
      exportName: 'DbCredentialsSecretArn',
    });

    new cdk.CfnOutput(this, 'RdsInstanceEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
      description: 'The endpoint address of the RDS instance',
      exportName: 'RdsInstanceEndpoint',
    });

    new cdk.CfnOutput(this, 'NestApiGatewayUrl', {
      value: apiGateway.url,
      description: 'The URL of the Nest API Gateway',
      exportName: 'NestApiGatewayUrl',
    });
  }
}
