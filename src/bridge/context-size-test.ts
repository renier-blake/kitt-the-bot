import { getKITTSystemPrompt } from './context.js';

async function main() {
  const prompt = await getKITTSystemPrompt('test message');
  console.log('Characters:', prompt.length);
  console.log('Estimated tokens:', Math.round(prompt.length / 4));
}

main().catch(console.error);
