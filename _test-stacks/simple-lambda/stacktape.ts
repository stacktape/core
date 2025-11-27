import { defineConfig, LambdaFunction, StacktapeLambdaBuildpackPackaging } from '../../__release-npm';

export default defineConfig(() => {
  const lambda = new LambdaFunction({
    packaging: new StacktapeLambdaBuildpackPackaging({
      entryfilePath: './src/throwing.ts'
    }),
    url: {
      enabled: true,
      cors: {
        enabled: true
      }
    },
    provisionedConcurrency: 1,
    transforms: {
      lambda: (props) => {
        return {
          ...props,
          MemorySize: (props.MemorySize ?? 128) * 2,
          Description: 'This is a test lambda',
          Layers: ['arn:aws:lambda:us-east-1:123456789012:layer:my-layer:1'],
        }
      }
    }
  });

  return {
    resources: { lambda },
    cloudformationResources: {
      mySnsTopic: {
        Type: 'AWS::SNS::Topic',
        Properties: {
          TopicName: 'my-test-topic',
          DisplayName: 'My Test Topic'
        }
      }
    },
    finalTransform: (template) => {
      // Example: Add a global tag to all Lambda functions
      console.log(template);
      return template;
    }
  };
});
