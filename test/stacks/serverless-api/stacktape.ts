import {
  $Secret,
  Bastion,
  defineConfig,
  DynamoDbTable,
  HttpApiGateway,
  HttpApiIntegration,
  LambdaFunction,
  LocalScriptWithCommand,
  StacktapeLambdaBuildpackPackaging
} from 'stacktape';

export default defineConfig(({ stage: _stage }) => {
  const dynamoDbTable = new DynamoDbTable('dynamoDbTable', {
    primaryKey: {
      partitionKey: {
        name: 'id',
        type: 'string'
      }
    }
  });

  const apiGateway = new HttpApiGateway('apiGateway', {
    cors: {
      enabled: true
    }
  });

  const bastion = new Bastion('bastion', {
    overrides: {}
  });

  const myLambda = new LambdaFunction('myLambda', {
    packaging: new StacktapeLambdaBuildpackPackaging({
      entryfilePath: './hello.ts'
    }),
    events: [
      new HttpApiIntegration({
        httpApiGatewayName: apiGateway.resourceName,
        method: 'GET',
        path: '/'
      })
    ],
    connectTo: [dynamoDbTable, 'aws:ses'],
    environment: { OPEN_ROUTER_API_KEY: $Secret('open-router-api-key') },
    overrides: {
      lambdaLogGroup: {
        RetentionInDays: 7
      },
      lambda: {
        MemorySize: 4096
      }
    }
  });

  return {
    scripts: {
      migrate: new LocalScriptWithCommand({
        executeCommand: 'echo "Migrating dynamoDbTable"',
        connectTo: [dynamoDbTable],
        environment: { DYNAMODB_TABLE_NAME: dynamoDbTable.name }
      })
    },
    resources: {
      apiGateway,
      myLambda,
      dynamoDbTable,
      bastion
    }
  };
});
