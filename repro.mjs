// Reproduces https://github.com/vercel/ai/pull/20102:
// @ai-sdk/openai rejects `response.completed` streaming chunks that
// omit the `usage` object, as Exa's OpenAI-compatible Responses API
// (https://exa.ai/docs/reference/openai-sdk) intermittently does.
//
// Run: npm run repro  (no API key needed)

import { createServer } from 'node:http';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const report = (source, error) => {
  console.log(`REPRODUCED (${source}): ${error?.name ?? error}`);
  console.log(error?.message ?? error);
  server.close();
  process.exit(0);
};

// The error can surface as an unhandled rejection instead of an error
// stream part (result.text and result.usage still resolve with a null
// usage object), so listen for both.
process.on('unhandledRejection', reason => report('unhandled rejection', reason));

// SSE stream of an OpenAI Responses API run whose final
// `response.completed` chunk has no `usage` object.
const chunks = [
  {
    type: 'response.created',
    response: {
      id: 'resp_repro',
      object: 'response',
      created_at: 1,
      status: 'in_progress',
      model: 'repro-model',
      output: [],
    },
  },
  {
    type: 'response.output_item.added',
    output_index: 0,
    item: { type: 'message', id: 'msg_1', status: 'in_progress' },
  },
  {
    type: 'response.output_text.delta',
    item_id: 'msg_1',
    output_index: 0,
    delta: 'Hello from the mock server',
  },
  {
    type: 'response.output_item.done',
    output_index: 0,
    item: {
      type: 'message',
      id: 'msg_1',
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Hello from the mock server' }],
    },
  },
  {
    // Exa intermittently sends the final chunk without `usage`.
    type: 'response.completed',
    sequence_number: 16,
    response: {
      id: 'resp_repro',
      object: 'response',
      created_at: 1,
      status: 'completed',
      model: 'repro-model',
      output: [],
    },
  },
];

const server = createServer((req, res) => {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
  });
  for (const chunk of chunks) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
  // Exa's stream ends with `response.completed` — no `[DONE]` sentinel;
  // ending the response body closes the stream.
  res.end();
});

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();

  const openai = createOpenAI({
    baseURL: `http://127.0.0.1:${port}/v1`,
    apiKey: 'mock-key',
  });

  const result = streamText({
    model: openai.responses('repro-model'),
    prompt: 'Say hello',
    onError: () => {}, // keep the SDK from logging; we report via fullStream
  });

  for await (const part of result.fullStream) {
    if (part.type === 'error') {
      report('stream error part', part.error);
    }
  }

  console.log('NOT REPRODUCED — stream completed without errors (already fixed?).');
  console.log('usage:', JSON.stringify(await result.usage));
  server.close();
});
