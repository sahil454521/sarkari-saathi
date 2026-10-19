# Running Gnani Evon for the demo

Sarkari Saathi talks to any OpenAI-compatible chat endpoint, so switching from Gemini to Gnani's own Evon model is a change to `.env`, not to code. Evon isn't on Gnani's API yet, so it has to run on a GPU you rent for the recording session.

## Why not free Kaggle

Evon v3.3 is a 30B-parameter mixture-of-experts model (about 3.5B active per token). In bf16 its weights take about 64 GB. There is no quantized GGUF build on Hugging Face (checked 2026-10-19), and Kaggle's 2× T4 offer 32 GB in total, so Evon doesn't fit there. Re-check the model page's "Quantizations" list before your session: if a GGUF appears, llama.cpp on Kaggle becomes possible.

## What it costs

One A100 80 GB (or H100 80 GB) on RunPod or Vast.ai, roughly $1.2 to $2 per hour. Budget 2 to 3 hours for setup, testing and recording: about ₹300 to ₹500. Stop the pod as soon as you finish; billing runs while it's on.

## Steps

1. **Rent the GPU.** On RunPod, deploy a pod with one A100 80 GB, the "RunPod PyTorch" template, at least 120 GB of container disk, and HTTP port 8000 exposed.
2. **Start vLLM.** In the pod's terminal, pick a long random key and run:

   ```bash
   pip install -U "vllm>=0.12.0"
   export KEY=<long-random-key>
   vllm serve gnani/gnani-evon-v3.3-30B-A3B \
     --served-model-name evon \
     --trust-remote-code \
     --max-model-len 8192 \
     --reasoning-parser nano_v3 \
     --default-chat-template-kwargs '{"enable_thinking": false}' \
     --api-key "$KEY" \
     --host 0.0.0.0 --port 8000
   ```

   - The first start downloads about 64 GB of weights and takes a while.
   - `--api-key` is required, because the pod's URL is public.
   - Thinking mode is switched off so each reply stays fast.
   - If your vLLM version rejects `--default-chat-template-kwargs`, drop that flag. Thinking then stays on: replies are slower but still valid, because the reasoning parser keeps the thinking out of the answer.

3. **Point the app at it.** Create `.env.evon` next to `.env`, as a copy of `.env` with these three lines changed:

   ```
   LLM_BASE_URL=https://<pod-id>-8000.proxy.runpod.net/v1
   LLM_API_KEY=<the same long-random-key>
   LLM_MODEL=evon
   ```

4. **Check it.**
   - `node --env-file=.env.evon scripts/smoke.ts` should print `llm: ok` and `{"ok":true}`.
   - Start the server with `node --env-file=.env.evon server/index.ts`, open the app, and type the Sunita conversation from `docs/demo-script.md`. You should get the same 8 schemes as with Gemini.
   - Each turn should take under about 4 seconds.

5. **Record the demo**, then **stop the pod**.

## If it doesn't work

Record with Gemini instead and say so in the post. The demo still uses Gnani's Prisma (speech-to-text) and Timbre (text-to-speech) on every turn, which meets the contest rules, and the architecture slide can show that Evon plugs in through `.env` alone.
