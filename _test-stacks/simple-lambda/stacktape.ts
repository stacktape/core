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
    transforms: {
      lambda: (props) => {
        return {
          ...props,
          MemorySize: (props.MemorySize ?? 128) * 2,
          Description: 'This is a test lambda',
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
      for (const logicalName of Object.keys(template.Resources)) {
        const resource = template.Resources[logicalName];
        if (resource.Type === 'AWS::Lambda::Function' && resource.Properties) {
          (resource.Properties as any).Tags = [
            ...((resource.Properties as any).Tags || []),
            { Key: 'ManagedBy', Value: 'Stacktape' }
          ];
        }
      }
      return template;
    }
  };
});
