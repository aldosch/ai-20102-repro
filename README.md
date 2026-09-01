# fix: allow null usage in openai `response.completed` and `response.incomplete`

[vercel/ai#20102](https://github.com/vercel/ai/pull/20102)

Minimal repro of a `TypeValidationError` in [`@ai-sdk/openai`](https://github.com/vercel/ai/tree/main/packages/openai). When an OpenAI-compatible Responses API stream ends with a `response.completed` (or `response.incomplete`) chunk that omits `usage`, the streaming chunk schema rejects the chunk. The PR makes `usage` nullish, same as the `response.failed` chunk schema and the non-streaming response schema.

Exa's OpenAI-compatible Responses API ([docs](https://exa.ai/docs/reference/openai-sdk), model `exa-agent`) sends such a final chunk every so often. I hit this while debugging error boxes in [opencode](https://opencode.ai).

## the mock repro (deterministic, no key)

```sh
npm install    # or: pnpm install
npm run repro  # or: pnpm repro
```

A local mock server streams a Responses API run whose final `response.completed` chunk has no `usage`. Pre-fix output:

```
REPRODUCED (stream error part): AI_TypeValidationError
Type validation failed: Value: {"type":"response.completed",...}.
Error message: [... "path": ["response", "usage"] ...]
```

With the fix the stream completes without errors and `usage` resolves to a null usage object.

## the exa repro (intermittent)

```sh
read -s EXA_API_KEY && export EXA_API_KEY   # paste the key, press Enter (input hidden)
npm run repro:exa
```

Already exporting `EXA_API_KEY` at shell startup (e.g. from Keychain)? Skip the `read` and just run `npm run repro:exa`.

The missing-usage final chunk only shows up every so often, so several runs may be needed. It reproduced on the first run when last tested. Get a key at [dashboard.exa.ai](https://dashboard.exa.ai); the `exa-agent` model is documented in the [Agent API guide](https://exa.ai/docs/reference/agent-api-guide).

## notes

- Deps are pinned to pre-fix versions (`@ai-sdk/openai@4.0.50`, `ai@7.0.83`) so the repro stays deterministic. These also clear npm/pnpm supply-chain release-age windows like `minimumReleaseAge`. Bump them to verify the fix.
- The error surfaces either as an `error` part on `result.fullStream` or as an unhandled rejection. `result.text` and `result.usage` can still resolve, with a null usage object. That's what made this annoying to debug.
- Node 20+.
