// Optional: reproduce against the real Exa endpoint. The missing-usage
// final chunk is intermittent, so several runs may be needed.
//
//   read -s EXA_API_KEY && export EXA_API_KEY   # paste key, press Enter
//   npm run repro:exa
//
// Exa's OpenAI-compatible Responses API: https://exa.ai/docs/reference/openai-sdk

import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const apiKey = process.env.EXA_API_KEY;
if (!apiKey) {
  console.error(
    'EXA_API_KEY is not set (get one at https://dashboard.exa.ai). ' +
      'To keep it out of your shell history: read -s EXA_API_KEY && export EXA_API_KEY',
  );
  process.exit(1);
}

let reproduced = false;
const report = (source, error) => {
  reproduced = true;
  console.log(`REPRODUCED (${source}): ${error?.name ?? error}`);
  console.log(error?.message ?? error);
};

// The error can surface as an unhandled rejection instead of an error
// stream part, so listen for both.
process.on('unhandledRejection', reason => report('unhandled rejection', reason));

const exa = createOpenAI({ baseURL: 'https://api.exa.ai', apiKey });

const result = streamText({
  model: exa.responses('exa-agent'),
  prompt: 'In one sentence: what is the capital of France?',
  onError: () => {}, // keep the SDK from logging; we report via fullStream
});

for await (const part of result.fullStream) {
  if (part.type === 'error') {
    report('stream error part', part.error);
  }
}

if (!reproduced) {
  console.log('No stream error this run — the missing-usage chunk is intermittent, try again.');
  console.log('usage:', JSON.stringify(await result.usage));
}
