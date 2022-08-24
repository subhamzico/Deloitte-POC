import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as path from "path";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as sqs from '@aws-cdk/aws-sqs';
import { SqsDestination } from '@aws-cdk/aws-lambda-destinations';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import * as iam from '@aws-cdk/aws-iam';

export class CdkPocStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps, config?:any) {
    super(scope, id, config);

    //Import IAM role
    const lambdarole = iam.Role.fromRoleArn(this,
      'Import Role',
      config.RoleArn,
      {
      mutable: false
      }
    )
    
    //Creating RestAPI Gateway
    const RestAPIG = new apigateway.RestApi(this, 'Deloitte-APIG',{
      restApiName: "deloitte-restapig-"+config.Env,
      deployOptions:{
        stageName: config.Stage,
        dataTraceEnabled: true,
        metricsEnabled: true,
        throttlingBurstLimit : 4000,
        throttlingRateLimit: 8000,
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
      },
      deploy: true,
      description: "Rest API to invoke Deloitte Lambda",
      cloudWatchRole: false
    })

    //Creating Two SQS Queue for Success and Failure
    const successQueue = new sqs.Queue(this, 'Success-Lambda-SQS',{
      queueName: "On-Success-lambda-sqs-queue-"+config.Env
    })

    const failureQueue = new sqs.Queue(this, 'Failed-Lambda-SQS',{
      queueName: "On-Failure-lambda-sqs-queue-"+config.Env
    })

    //DDB Table for Second Lambda
    const ddbtable = new dynamodb.Table(this, 'Lambda-DDB-Table',{
      tableName: 'Lambda-DDB-Table'+config.Env,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'employeeid',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'employeename',
        type: dynamodb.AttributeType.STRING
      },
    })
    
    //Creating a GSI for the DDB
    ddbtable.addGlobalSecondaryIndex({
      indexName: 'lambda-gsi-ddb-'+config.Env,
      partitionKey: {
        name: 'employeeage',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'employeedesignation',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    })


    //Creating Lambda Function to be invoked by RestAPIG
    const DeloitteFunction1 = new lambda.Function(this, 'Deloitte-POC-Function1',{
      code: lambda.Code.fromAsset(path.join(__dirname,"../src")),
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "sample1.handler",
      role: lambdarole,
      functionName: "Deloitte-POC-Lambda-"+config.Env,
      description: "Deloitte POC Lambda",
      timeout: cdk.Duration.seconds(20),
      memorySize: 160,
      onSuccess: new SqsDestination(successQueue),
      onFailure: new SqsDestination(failureQueue)
    })

    //Creating Lambda Function to be invoked by SQS Queue
    const DeloitteFunction2 = new lambda.Function(this, 'Deloitte-POC-Function2',{
      code: lambda.Code.fromAsset(path.join(__dirname,"../src")),
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "sample2.handler",
      role: lambdarole,
      functionName: "Deloitte-POC-Second-Lambda-"+config.Env,
      description: "Deloitte POC Second Lambda",
      timeout: cdk.Duration.seconds(20),
      memorySize: 160,
    })

    DeloitteFunction2.addEventSource(new SqsEventSource(successQueue,{
      batchSize: 5,
      enabled : true
    }))

    const AuthLambda = 
    new lambda.Function(this, 'Deloitte-POC-Function3',{
      code: lambda.Code.fromAsset(path.join(__dirname,"../src")),
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "sample3.handler",
      role: lambdarole,
      functionName: "Deloitte-POC-Auth-Lambda-"+config.Env,
      description: "Deloitte POC Lambda",
      timeout: cdk.Duration.seconds(20),
      memorySize: 160,
    })

    //Token Authorizer 
    const restapiauth = new apigateway.TokenAuthorizer(this,'RestAPI-Auth',{
      handler: AuthLambda,
      authorizerName: `RestAPI-Auth-${config.Env}`,
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.seconds(0)
    })
    restapiauth._attachToApi(RestAPIG)

    //Create APIG Deployment
    const apigdeployment = new apigateway.Deployment(this,'APIG-Deployment',{
      api: RestAPIG,
      description: `Auto Deployment of RestAPIG`,
      retainDeployments: false
    })

    //Create API Key
    const apikey = new apigateway.ApiKey(this,'RestAPI-Key',{
      apiKeyName: `RestAPI-Key-${config.Env}`,
      description: `RestAPI-Key in ${config.Env} env`,
      enabled: true,
    })

    //Create Usage Plan
    const apigusageplan = new apigateway.UsagePlan(this,'RestApi-UsagePlan',{
      name: `RestAPIG-Usage-Plan-${config.Env}`,
    })

    apigusageplan.addApiKey(apikey)
    apigusageplan.addApiStage({
      api: RestAPIG,
      stage: RestAPIG.deploymentStage
    })


    //RestAPI Routes
    const firstroute = RestAPIG.root.addResource("new")
    const secondroute = firstroute.addResource("route")
    const thirdroute = secondroute.addResource("{date}")

    //RestAPI-Lambda Integration
    thirdroute.addMethod('GET',
    new apigateway.LambdaIntegration(DeloitteFunction1),{
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer:{
        authorizerId: restapiauth.authorizerId,
        authorizationType: apigateway.AuthorizationType.CUSTOM
      }
    }
    )

    thirdroute.addCorsPreflight({
      allowOrigins: ['*']
    })

}
}