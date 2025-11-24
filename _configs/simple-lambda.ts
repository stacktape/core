import { defineConfig, LambdaFunction, StacktapeLambdaBuildpackPackaging } from '../__release-npm';

export default defineConfig(() => {
  const lambda = new LambdaFunction('simple-lambda', {
    packaging: new StacktapeLambdaBuildpackPackaging({
      entryfilePath: './lambdas/throwing.ts'
    }),
    url: {
      enabled: true,
      cors: {
        enabled: true
      }
    }
  });

  return {
    resources: { lambda }
  };
});
