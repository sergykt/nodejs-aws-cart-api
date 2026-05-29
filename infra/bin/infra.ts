#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { NestStack } from '../lib/nest-stack';

const app = new cdk.App();
new NestStack(app, 'NestStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
