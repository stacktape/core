/* eslint-disable antfu/no-top-level-await */
const triggerEvent = JSON.parse(process.env.STP_TRIGGER_EVENT_DATA!);

await new Promise((resolve) => setTimeout(resolve, 5000));

console.log(triggerEvent);

throw new Error('Test error');
