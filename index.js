import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as crypto from "crypto";

// Create a Lambda role so it can be executed
const iamForLambda = new aws.iam.Role("iamForLambda", {
  assumeRolePolicy: `{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Action": "sts:AssumeRole",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Effect": "Allow",
        "Sid": ""
      }
    ]
  }`,
});

// Create the Lambda function - define the contents of the code, as well 
// as how it is ran and triggered
const testLambda = new aws.lambda.Function("testLambda", {
  code: new pulumi.asset.AssetArchive({
    ".": new pulumi.asset.FileArchive("./app"),
  }),
  role: iamForLambda.arn,
  handler: "index.handler",
  runtime: "nodejs12.x",
});

// Create the API Gateway REST API
// As the body - use the contents of an Open API specification
const exampleRestApi = new aws.apigateway.RestApi("exampleRestApi", {
  body: pulumi.all([testLambda.invokeArn]).apply(([arn]) =>
    JSON.stringify({
      openapi: "3.0.1",
      info: {
        title: "example",
        version: "1.0",
      },
      paths: {
        "/path1": {
          get: {
            "x-amazon-apigateway-integration": {
              httpMethod: "POST",
              type: "aws_proxy",
              uri: arn,
              responses: {
                ".*": {
                  statusCode: 200,
                },
              },
            },
            responses: {
              200: {
                description: "200 response",
                content: {},
              },
            },
          },
        },
        "/test/{variable1}": {
          parameters: [
            {
              in: "path",
              name: "variable1",
              schema: {
                type: "string"
              },
              required: true,
              description: "The first variable of the url"
            }
          ],
          get: {
            "x-amazon-apigateway-integration": {
              httpMethod: "POST",
              type: "aws_proxy",
              uri: arn,
              responses: {
                ".*": {
                  statusCode: 200,
                },
              },
            },
            responses: {
              200: {
                description: "200 response",
                content: {},
              },
            },
          },
        },
      },
    })
  ),
});

// Create a permission so API Gateway can trigger/invoke the lambda function.
// This will also create a trigger
const lambdaPermission = new aws.lambda.Permission("lambda-permission", {
  action: "lambda:invokeFunction",
  function: testLambda,
  principal: "apigateway.amazonaws.com",
  sourceArn: exampleRestApi.executionArn.apply((arn) => `${arn}/*/GET/path1`),
});

// Create a permission so API Gateway can trigger/invoke the lambda function.
// This will also create a trigger
const lambdaPermission2 = new aws.lambda.Permission("lambda-permission2", {
  action: "lambda:invokeFunction",
  function: testLambda,
  principal: "apigateway.amazonaws.com",
  sourceArn: exampleRestApi.executionArn.apply((arn) => `${arn}/*/GET/test/{variable1}`),
});


// Define the API Gateway deployment, and the triggers for a redeployment
const exampleDeployment = new aws.apigateway.Deployment("exampleDeployment", {
  restApi: exampleRestApi.id,
  triggers: {
    redeployment: exampleRestApi.body
      .apply((body) => JSON.stringify(body))
      .apply((toJSON) =>
        crypto.createHash("sha1").update(toJSON).digest("hex")
      ),
  },
});

// Define the stage for the REST API
const exampleStage = new aws.apigateway.Stage("exampleStage", {
  deployment: exampleDeployment.id,
  restApi: exampleRestApi.id,
  stageName: "example",
});
