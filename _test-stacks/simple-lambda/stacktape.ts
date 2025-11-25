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
    overrides: {}
  });

  return {
    resources: { lambda }
  };
});
