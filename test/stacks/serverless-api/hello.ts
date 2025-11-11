export default async (event, context) => {
  console.info('Hello', event, context);

  return {
    headers: { 'Content-Type': 'application/json' },
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello' })
  };
};
