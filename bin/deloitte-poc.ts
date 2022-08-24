#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkPocStack } from '../lib/deloitte-poc-stack';
import { Configuration } from '../lib/config';
import { Tags } from '@aws-cdk/core';

let config= new Configuration();
const app = new cdk.App();

async function Main() {
  let buildconfig = config.getConfig(app);
  let awsaccountdetails = {
    account : String(buildconfig.AWSAccountID),
    region : String(buildconfig.Region)
  }

  const DeloittePOCstack = new CdkPocStack(app,'deloitte-first-poc-template-'+buildconfig.Env,{
    env: awsaccountdetails
  },buildconfig)

  Tags.of(DeloittePOCstack).add('Owner','Deloitte')
  Tags.of(DeloittePOCstack).add('Project','Deloitte-POC')
  
}
Main();