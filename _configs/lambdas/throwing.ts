import type { Handler } from 'aws-lambda';

export default (event, context): Handler => {
  console.log(event, context);
  throw new Error('This is a test error');
};
