import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class NestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the API Gateway REST API
    const apiGateway = new apigateway.RestApi(this, 'NestServiceApiGateway', {
      restApiName: 'Nest Service',
      description: 'API for the Nest Service',
    });

    // Create the Lambda function for NestJS
    const nestJsLambdaFunction = new lambdaNodejs.NodejsFunction(
      this,
      'NestJsLambdaFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '../../src/handler.ts'),
        projectRoot: path.join(__dirname, '../../'),
        handler: 'handler',
        bundling: {
          minify: true,
          sourceMap: false,
          externalModules: [
            '@nestjs/websockets',
            '@nestjs/websockets/socket-module',
            '@nestjs/microservices',
            '@nestjs/microservices/microservices-module',
            'class-transformer',
            'class-validator',
          ],
        },
      },
    );

    // Integrate the Lambda function with API Gateway
    const nestJsLambdaIntegration = new apigateway.LambdaIntegration(
      nestJsLambdaFunction,
    );

    // Set up API Gateway routes to proxy requests to the Lambda function
    apiGateway.root.addMethod('ANY', nestJsLambdaIntegration);
    apiGateway.root
      .addResource('{proxy+}')
      .addMethod('ANY', nestJsLambdaIntegration);

    new cdk.CfnOutput(this, 'NestApiGatewayUrl', {
      value: apiGateway.url,
      description: 'The URL of the Nest API Gateway',
      exportName: 'NestApiGatewayUrl',
    });
  }
}
