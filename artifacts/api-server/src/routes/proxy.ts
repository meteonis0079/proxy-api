import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, sql } from "drizzle-orm";
import { db, apiKeysTable, usageLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getCurrentPassword } from "../lib/currentPassword";
import { getBlockedProviders } from "./settings";

const router: IRouter = Router();

const PROVIDER_BASE_URLS: Record<string, string> = {
  vercel: "https://ai-gateway.vercel.sh/v1",
};

async function requireProxyApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const proxyApiKey = await getCurrentPassword();
  if (!proxyApiKey) {
    next();
    return;
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token !== proxyApiKey) {
    res.status(401).json({
      error: {
        message: "Invalid or missing proxy API key. Provide it via Authorization: Bearer <key>",
        type: "invalid_request_error",
        code: "invalid_api_key",
      },
    });
    return;
  }

  next();
}

let roundRobinIndex = 0;

async function getNextKey() {
  const keys = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.isEnabled, true));

  if (keys.length === 0) return null;

  const key = keys[roundRobinIndex % keys.length];
  roundRobinIndex = (roundRobinIndex + 1) % keys.length;
  return key;
}

interface ModelPricing {
  prompt: number;
  completion?: number;
}

type ModelEntry = {
  id: string;
  name: string;
  provider: string;
  providerLabel: string;
  channel: string;
  contextWindow: number;
  pricing: ModelPricing;
  features: string[];
  description?: string;
};

export const MODEL_CATALOG: ModelEntry[] = [
  // ════════════════════════════════════════════════════════
  //  Vercel AI Gateway  (https://ai-gateway.vercel.sh/v1)
  // ════════════════════════════════════════════════════════

  // ── OpenAI ───────────────────────────────────────────────
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000005, completion: 0.000015 }, features: ["vision", "function-calling", "json-mode"], description: "全能旗舰，多模态" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.00000015, completion: 0.0000006 }, features: ["vision", "function-calling", "json-mode"], description: "性价比最高旗舰轻量版" },
  { id: "openai/gpt-4o-mini-search-preview", name: "GPT-4o mini Search", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.00000015, completion: 0.0000006 }, features: ["function-calling"], description: "联网搜索轻量版" },
  { id: "openai/gpt-4.1", name: "GPT-4.1", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000002, completion: 0.000008 }, features: ["vision", "function-calling", "json-mode"], description: "新一代 GPT-4 旗舰" },
  { id: "openai/gpt-4.1-mini", name: "GPT-4.1 mini", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000004, completion: 0.0000016 }, features: ["vision", "function-calling"], description: "GPT-4.1 轻量版" },
  { id: "openai/gpt-4.1-nano", name: "GPT-4.1 nano", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000001, completion: 0.0000004 }, features: ["function-calling"], description: "GPT-4.1 极轻量版" },
  { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.00001, completion: 0.00003 }, features: ["vision", "function-calling", "json-mode"], description: "GPT-4 Turbo with vision" },
  { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 16385, pricing: { prompt: 0.0000005, completion: 0.0000015 }, features: ["function-calling", "json-mode"], description: "速度快、成本低" },
  { id: "openai/gpt-3.5-turbo-instruct", name: "GPT-3.5 Turbo Instruct", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 4096, pricing: { prompt: 0.0000015, completion: 0.000002 }, features: [], description: "指令补全专用" },
  { id: "openai/gpt-5", name: "GPT-5", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000010, completion: 0.000040 }, features: ["vision", "function-calling", "reasoning"], description: "OpenAI 新一代旗舰" },
  { id: "openai/gpt-5-chat", name: "GPT-5 Chat", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000010, completion: 0.000040 }, features: ["vision", "function-calling"], description: "GPT-5 对话优化版" },
  { id: "openai/gpt-5-mini", name: "GPT-5 mini", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000002, completion: 0.000008 }, features: ["vision", "function-calling"], description: "GPT-5 轻量版" },
  { id: "openai/gpt-5-nano", name: "GPT-5 nano", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000005, completion: 0.000002 }, features: ["function-calling"], description: "GPT-5 极轻量版" },
  { id: "openai/gpt-5-pro", name: "GPT-5 Pro", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000030, completion: 0.000120 }, features: ["vision", "function-calling", "reasoning"], description: "GPT-5 旗舰增强版" },
  { id: "openai/gpt-5-codex", name: "GPT-5 Codex", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000010, completion: 0.000040 }, features: ["function-calling"], description: "GPT-5 代码专精版" },
  { id: "openai/gpt-oss-20b", name: "GPT OSS 20B", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000005, completion: 0.000002 }, features: ["function-calling"], description: "OpenAI 开源 20B" },
  { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000002, completion: 0.000008 }, features: ["function-calling"], description: "OpenAI 开源 120B" },
  { id: "openai/o1", name: "o1", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000015, completion: 0.00006 }, features: ["reasoning"], description: "深度推理旗舰" },
  { id: "openai/o3", name: "o3", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000010, completion: 0.000040 }, features: ["reasoning", "vision"], description: "最强推理旗舰，支持视觉" },
  { id: "openai/o3-mini", name: "o3-mini", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.0000011, completion: 0.0000044 }, features: ["reasoning"], description: "高效推理，适合代码与数学" },
  { id: "openai/o3-pro", name: "o3 Pro", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000020, completion: 0.000080 }, features: ["reasoning", "vision"], description: "o3 增强专业版" },
  { id: "openai/o3-deep-research", name: "o3 Deep Research", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000010, completion: 0.000040 }, features: ["reasoning"], description: "深度研究报告专用" },
  { id: "openai/o4-mini", name: "o4-mini", provider: "openai", providerLabel: "OpenAI", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.0000011, completion: 0.0000044 }, features: ["reasoning", "vision"], description: "新一代轻量推理" },

  // ── Anthropic (Vercel) ────────────────────────────────────
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.00000025, completion: 0.00000125 }, features: ["vision", "function-calling"], description: "最快最低成本 Claude 3" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.0000008, completion: 0.000004 }, features: ["vision", "function-calling"], description: "速度与性价比兼备" },
  { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000003, completion: 0.000015 }, features: ["vision", "function-calling", "reasoning"], description: "混合推理与创意能力" },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.0000008, completion: 0.000004 }, features: ["vision", "function-calling"], description: "Claude 4 系列轻量快速版" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000003, completion: 0.000015 }, features: ["vision", "function-calling"], description: "Claude 4 综合旗舰" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000003, completion: 0.000015 }, features: ["vision", "function-calling"], description: "Claude 4.5 综合旗舰" },
  { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000003, completion: 0.000015 }, features: ["vision", "function-calling"], description: "Claude 4.6 综合旗舰" },
  { id: "anthropic/claude-opus-4", name: "Claude Opus 4", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000015, completion: 0.000075 }, features: ["vision", "function-calling", "reasoning"], description: "Claude 4 旗舰，推理与编程" },
  { id: "anthropic/claude-opus-4.1", name: "Claude Opus 4.1", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000015, completion: 0.000075 }, features: ["vision", "function-calling", "reasoning"], description: "Claude 4.1 旗舰" },
  { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000015, completion: 0.000075 }, features: ["vision", "function-calling", "reasoning"], description: "最新旗舰 Claude 4.5 Opus，超强推理" },
  { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000015, completion: 0.000075 }, features: ["vision", "function-calling", "reasoning"], description: "Claude 4.6 旗舰" },
  { id: "anthropic/claude-opus-4.7", name: "Claude Opus 4.7", provider: "anthropic", providerLabel: "Anthropic", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000015, completion: 0.000075 }, features: ["vision", "function-calling", "reasoning"], description: "Claude 4.7 旗舰" },

  // ── Google (Vercel) ───────────────────────────────────────
  { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 1000000, pricing: { prompt: 0.0000001, completion: 0.0000004 }, features: ["vision", "function-calling", "long-context"], description: "新一代快速多模态" },
  { id: "google/gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 1000000, pricing: { prompt: 0.000000075, completion: 0.0000003 }, features: ["vision", "long-context"], description: "极速极廉，高吞吐" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 1000000, pricing: { prompt: 0.00000015, completion: 0.0000006 }, features: ["vision", "function-calling", "reasoning", "long-context"], description: "新一代快速推理" },
  { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 1000000, pricing: { prompt: 0.000000075, completion: 0.0000003 }, features: ["vision", "long-context"], description: "2.5 Flash 轻量版" },
  { id: "google/gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 1000000, pricing: { prompt: 0.00000015, completion: 0.0000006 }, features: ["vision", "function-calling", "long-context"], description: "2.5 Flash 图像增强版" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 1000000, pricing: { prompt: 0.00000125, completion: 0.000010 }, features: ["vision", "function-calling", "reasoning", "long-context"], description: "最强 Gemini 深度推理旗舰" },
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 1000000, pricing: { prompt: 0.0000001, completion: 0.0000004 }, features: ["vision", "function-calling", "long-context"], description: "Gemini 3 快速版" },
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro Preview", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 1000000, pricing: { prompt: 0.00000125, completion: 0.000010 }, features: ["vision", "function-calling", "reasoning", "long-context"], description: "Gemini 3 旗舰预览版" },
  { id: "google/gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite Preview", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 1000000, pricing: { prompt: 0.000000075, completion: 0.0000003 }, features: ["vision", "long-context"], description: "Gemini 3.1 轻量预览版" },
  { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 1000000, pricing: { prompt: 0.00000125, completion: 0.000010 }, features: ["vision", "function-calling", "reasoning", "long-context"], description: "Gemini 3.1 旗舰预览版" },
  { id: "google/gemma-4-26b-a4b-it", name: "Gemma 4 26B MoE", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000001, completion: 0.0000002 }, features: ["vision", "function-calling"], description: "Gemma 4 开源 MoE 多模态" },
  { id: "google/gemma-4-31b-it", name: "Gemma 4 31B", provider: "google", providerLabel: "Google", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000001, completion: 0.0000002 }, features: ["vision", "function-calling"], description: "Gemma 4 开源旗舰" },

  // ── Meta Llama (Vercel) ───────────────────────────────────
  { id: "meta/llama-4-maverick", name: "Llama 4 Maverick", provider: "meta", providerLabel: "Meta", channel: "vercel", contextWindow: 1048576, pricing: { prompt: 0.0000002, completion: 0.0000006 }, features: ["vision", "function-calling", "long-context"], description: "最新 Llama 4 旗舰 MoE" },
  { id: "meta/llama-4-scout", name: "Llama 4 Scout", provider: "meta", providerLabel: "Meta", channel: "vercel", contextWindow: 524288, pricing: { prompt: 0.0000001, completion: 0.0000003 }, features: ["vision", "function-calling", "long-context"], description: "Llama 4 轻量视觉版" },
  { id: "meta/llama-3.3-70b", name: "Llama 3.3 70B", provider: "meta", providerLabel: "Meta", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.00000059, completion: 0.00000079 }, features: ["function-calling"], description: "Llama 3.3 旗舰" },
  { id: "meta/llama-3.2-90b", name: "Llama 3.2 90B Vision", provider: "meta", providerLabel: "Meta", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000009, completion: 0.0000009 }, features: ["vision", "function-calling"], description: "多模态旗舰" },
  { id: "meta/llama-3.2-11b", name: "Llama 3.2 11B Vision", provider: "meta", providerLabel: "Meta", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000055, completion: 0.000000055 }, features: ["vision"], description: "轻量视觉模型" },
  { id: "meta/llama-3.2-3b", name: "Llama 3.2 3B", provider: "meta", providerLabel: "Meta", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000015, completion: 0.000000025 }, features: [], description: "超轻量边缘部署" },
  { id: "meta/llama-3.2-1b", name: "Llama 3.2 1B", provider: "meta", providerLabel: "Meta", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000010, completion: 0.000000010 }, features: [], description: "最小 Llama 模型" },
  { id: "meta/llama-3.1-70b", name: "Llama 3.1 70B", provider: "meta", providerLabel: "Meta", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.00000059, completion: 0.00000079 }, features: ["function-calling"], description: "高性价比中型模型" },
  { id: "meta/llama-3.1-8b", name: "Llama 3.1 8B", provider: "meta", providerLabel: "Meta", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.00000018, completion: 0.00000018 }, features: [], description: "极低成本轻量模型" },

  // ── Mistral (Vercel) ──────────────────────────────────────
  { id: "mistral/mistral-large-3", name: "Mistral Large 3", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000002, completion: 0.000006 }, features: ["function-calling", "json-mode"], description: "Mistral 旗舰新版" },
  { id: "mistral/mistral-medium", name: "Mistral Medium", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000004, completion: 0.0000012 }, features: ["function-calling"], description: "中等规模高性价比" },
  { id: "mistral/mistral-small", name: "Mistral Small", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 32000, pricing: { prompt: 0.0000001, completion: 0.0000003 }, features: ["function-calling"], description: "轻量快速" },
  { id: "mistral/mistral-nemo", name: "Mistral Nemo", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000015, completion: 0.000000015 }, features: ["function-calling"], description: "超轻量边缘" },
  { id: "mistral/codestral", name: "Codestral", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 256000, pricing: { prompt: 0.0000003, completion: 0.0000009 }, features: ["function-calling"], description: "专业代码补全" },
  { id: "mistral/pixtral-large", name: "Pixtral Large", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000002, completion: 0.000006 }, features: ["vision", "function-calling"], description: "最强多模态视觉旗舰" },
  { id: "mistral/pixtral-12b", name: "Pixtral 12B", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000001, completion: 0.0000001 }, features: ["vision"], description: "轻量视觉模型" },
  { id: "mistral/mixtral-8x22b-instruct", name: "Mixtral 8x22B", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 65536, pricing: { prompt: 0.0000009, completion: 0.0000009 }, features: ["function-calling", "json-mode"], description: "大型 MoE 旗舰" },
  { id: "mistral/ministral-14b", name: "Ministral 14B", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000001, completion: 0.0000001 }, features: ["function-calling"], description: "Ministral 14B 高性价比" },
  { id: "mistral/ministral-8b", name: "Ministral 8B", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000001, completion: 0.0000001 }, features: ["function-calling"], description: "超轻量边缘部署" },
  { id: "mistral/ministral-3b", name: "Ministral 3B", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000040, completion: 0.000000040 }, features: [], description: "最小 Mistral 模型" },
  { id: "mistral/magistral-medium", name: "Magistral Medium", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000002, completion: 0.000006 }, features: ["function-calling", "reasoning"], description: "Mistral 推理旗舰" },
  { id: "mistral/magistral-small", name: "Magistral Small", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000005, completion: 0.0000015 }, features: ["reasoning"], description: "轻量推理模型" },
  { id: "mistral/devstral-2", name: "Devstral 2", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 256000, pricing: { prompt: 0.0000003, completion: 0.0000009 }, features: ["function-calling"], description: "代码与开发专精旗舰" },
  { id: "mistral/devstral-small", name: "Devstral Small", provider: "mistral", providerLabel: "Mistral", channel: "vercel", contextWindow: 256000, pricing: { prompt: 0.0000001, completion: 0.0000003 }, features: ["function-calling"], description: "代码专精轻量版" },

  // ── xAI Grok (Vercel) ─────────────────────────────────────
  { id: "xai/grok-3", name: "Grok 3", provider: "xai", providerLabel: "xAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000003, completion: 0.000015 }, features: ["function-calling", "reasoning"], description: "xAI 旗舰" },
  { id: "xai/grok-3-fast", name: "Grok 3 Fast", provider: "xai", providerLabel: "xAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000005, completion: 0.000025 }, features: ["function-calling", "reasoning"], description: "Grok 3 高速版" },
  { id: "xai/grok-3-mini", name: "Grok 3 Mini", provider: "xai", providerLabel: "xAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000003, completion: 0.0000005 }, features: ["function-calling", "reasoning"], description: "轻量推理高性价比" },
  { id: "xai/grok-3-mini-fast", name: "Grok 3 Mini Fast", provider: "xai", providerLabel: "xAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000006, completion: 0.000001 }, features: ["function-calling", "reasoning"], description: "轻量推理高速版" },
  { id: "xai/grok-4", name: "Grok 4", provider: "xai", providerLabel: "xAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000003, completion: 0.000015 }, features: ["function-calling", "reasoning"], description: "xAI 新一代旗舰" },
  { id: "xai/grok-4-fast-reasoning", name: "Grok 4 Fast Reasoning", provider: "xai", providerLabel: "xAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000005, completion: 0.000025 }, features: ["reasoning"], description: "Grok 4 高速推理" },
  { id: "xai/grok-4-fast-non-reasoning", name: "Grok 4 Fast", provider: "xai", providerLabel: "xAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000005, completion: 0.000025 }, features: ["function-calling"], description: "Grok 4 高速对话" },
  { id: "xai/grok-code-fast-1", name: "Grok Code Fast", provider: "xai", providerLabel: "xAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000003, completion: 0.000015 }, features: ["function-calling"], description: "Grok 代码专精版" },

  // ── DeepSeek (Vercel) ─────────────────────────────────────
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "deepseek", providerLabel: "DeepSeek", channel: "vercel", contextWindow: 163840, pricing: { prompt: 0.0000008, completion: 0.0000032 }, features: ["reasoning"], description: "顶级开源推理，媲美 o1" },
  { id: "deepseek/deepseek-v3", name: "DeepSeek V3", provider: "deepseek", providerLabel: "DeepSeek", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.00000027, completion: 0.00000110 }, features: ["function-calling"], description: "MoE 旗舰综合性能" },
  { id: "deepseek/deepseek-v3.1", name: "DeepSeek V3.1", provider: "deepseek", providerLabel: "DeepSeek", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.00000027, completion: 0.00000110 }, features: ["function-calling"], description: "DeepSeek V3 升级版" },
  { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2", provider: "deepseek", providerLabel: "DeepSeek", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.00000027, completion: 0.00000110 }, features: ["function-calling"], description: "DeepSeek V3 最新版" },
  { id: "deepseek/deepseek-v3.2-thinking", name: "DeepSeek V3.2 Thinking", provider: "deepseek", providerLabel: "DeepSeek", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.00000027, completion: 0.00000110 }, features: ["reasoning"], description: "V3.2 推理增强版" },

  // ── Alibaba Qwen (Vercel) ─────────────────────────────────
  { id: "alibaba/qwen3-max", name: "Qwen3 Max", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000016, completion: 0.0000064 }, features: ["function-calling", "reasoning"], description: "阿里云 Qwen3 旗舰" },
  { id: "alibaba/qwen3-max-preview", name: "Qwen3 Max Preview", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000016, completion: 0.0000064 }, features: ["function-calling", "reasoning"], description: "Qwen3 Max 预览版" },
  { id: "alibaba/qwen3-max-thinking", name: "Qwen3 Max Thinking", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000016, completion: 0.0000064 }, features: ["reasoning"], description: "Qwen3 Max 深度推理版" },
  { id: "alibaba/qwen3-235b-a22b-thinking", name: "Qwen3 235B Thinking", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.00000022, completion: 0.00000088 }, features: ["reasoning"], description: "Qwen3 超大 MoE 推理版" },
  { id: "alibaba/qwen-3-235b", name: "Qwen3 235B", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.00000022, completion: 0.00000088 }, features: ["function-calling", "reasoning"], description: "Qwen3 旗舰超大 MoE" },
  { id: "alibaba/qwen-3-32b", name: "Qwen3 32B", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000001, completion: 0.0000004 }, features: ["function-calling", "reasoning"], description: "Qwen3 高性能密集模型" },
  { id: "alibaba/qwen-3-30b", name: "Qwen3 30B MoE", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000001, completion: 0.0000004 }, features: ["function-calling"], description: "Qwen3 30B MoE" },
  { id: "alibaba/qwen-3-14b", name: "Qwen3 14B", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.00000007, completion: 0.00000028 }, features: ["function-calling"], description: "中等规模高效推理" },
  { id: "alibaba/qwen-3-8b", name: "Qwen3 8B", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.00000005, completion: 0.0000002 }, features: ["function-calling"], description: "Qwen3 轻量高效" },
  { id: "alibaba/qwen-3-4b", name: "Qwen3 4B", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 32768, pricing: { prompt: 0.000000025, completion: 0.0000001 }, features: ["function-calling"], description: "Qwen3 超小规模" },
  { id: "alibaba/qwen3-coder", name: "Qwen3 Coder", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000001, completion: 0.0000004 }, features: ["function-calling"], description: "Qwen3 代码专精版" },
  { id: "alibaba/qwen3-vl-instruct", name: "Qwen3 VL", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000004, completion: 0.0000004 }, features: ["vision", "function-calling"], description: "Qwen3 视觉语言模型" },
  { id: "alibaba/qwen3-vl-thinking", name: "Qwen3 VL Thinking", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000004, completion: 0.0000004 }, features: ["vision", "reasoning"], description: "Qwen3 视觉推理版" },
  { id: "alibaba/qwen3.5-flash", name: "Qwen3.5 Flash", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.00000005, completion: 0.0000002 }, features: ["function-calling"], description: "Qwen3.5 极速轻量版" },
  { id: "alibaba/qwen3.5-plus", name: "Qwen3.5 Plus", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000004, completion: 0.0000012 }, features: ["function-calling"], description: "Qwen3.5 旗舰版" },
  { id: "alibaba/qwen3-embedding-8b", name: "Qwen3 Embedding 8B", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 32768, pricing: { prompt: 0.00000002 }, features: ["embedding"], description: "Qwen3 文本嵌入 8B" },
  { id: "alibaba/qwen3-embedding-4b", name: "Qwen3 Embedding 4B", provider: "alibaba", providerLabel: "Alibaba", channel: "vercel", contextWindow: 32768, pricing: { prompt: 0.00000001 }, features: ["embedding"], description: "Qwen3 文本嵌入 4B" },

  // ── Amazon Nova (Vercel) ──────────────────────────────────
  { id: "amazon/nova-pro", name: "Nova Pro", provider: "amazon", providerLabel: "Amazon", channel: "vercel", contextWindow: 300000, pricing: { prompt: 0.0000008, completion: 0.0000032 }, features: ["vision", "function-calling", "long-context"], description: "AWS 旗舰多模态" },
  { id: "amazon/nova-lite", name: "Nova Lite", provider: "amazon", providerLabel: "Amazon", channel: "vercel", contextWindow: 300000, pricing: { prompt: 0.00000006, completion: 0.00000024 }, features: ["vision", "function-calling", "long-context"], description: "速度与成本最优" },
  { id: "amazon/nova-micro", name: "Nova Micro", provider: "amazon", providerLabel: "Amazon", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000035, completion: 0.00000014 }, features: ["function-calling"], description: "纯文本极速极廉" },
  { id: "amazon/nova-2-lite", name: "Nova 2 Lite", provider: "amazon", providerLabel: "Amazon", channel: "vercel", contextWindow: 300000, pricing: { prompt: 0.00000006, completion: 0.00000024 }, features: ["vision", "function-calling", "long-context"], description: "Nova 2 轻量版" },

  // ── Cohere (Vercel) ───────────────────────────────────────
  { id: "cohere/command-a", name: "Command A", provider: "cohere", providerLabel: "Cohere", channel: "vercel", contextWindow: 256000, pricing: { prompt: 0.0000025, completion: 0.0000100 }, features: ["function-calling", "rag", "long-context"], description: "Cohere 最新旗舰 Agent 首选" },

  // ── Perplexity (Vercel) ───────────────────────────────────
  { id: "perplexity/sonar-pro", name: "Sonar Pro", provider: "perplexity", providerLabel: "Perplexity", channel: "vercel", contextWindow: 200000, pricing: { prompt: 0.000003, completion: 0.000015 }, features: ["function-calling", "long-context"], description: "高级实时搜索增强" },
  { id: "perplexity/sonar", name: "Sonar", provider: "perplexity", providerLabel: "Perplexity", channel: "vercel", contextWindow: 127072, pricing: { prompt: 0.000001, completion: 0.000001 }, features: [], description: "实时联网搜索模型" },
  { id: "perplexity/sonar-reasoning-pro", name: "Sonar Reasoning Pro", provider: "perplexity", providerLabel: "Perplexity", channel: "vercel", contextWindow: 127072, pricing: { prompt: 0.000003, completion: 0.000015 }, features: ["reasoning"], description: "联网推理旗舰" },

  // ── Moonshot Kimi (Vercel) ────────────────────────────────
  { id: "moonshotai/kimi-k2", name: "Kimi K2", provider: "moonshot", providerLabel: "Moonshot AI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000006, completion: 0.0000025 }, features: ["function-calling", "reasoning"], description: "月之暗面 Kimi K2 旗舰" },
  { id: "moonshotai/kimi-k2-turbo", name: "Kimi K2 Turbo", provider: "moonshot", providerLabel: "Moonshot AI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000003, completion: 0.0000012 }, features: ["function-calling"], description: "Kimi K2 高速版" },
  { id: "moonshotai/kimi-k2-thinking", name: "Kimi K2 Thinking", provider: "moonshot", providerLabel: "Moonshot AI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000006, completion: 0.0000025 }, features: ["reasoning"], description: "Kimi K2 深度推理版" },
  { id: "moonshotai/kimi-k2-thinking-turbo", name: "Kimi K2 Thinking Turbo", provider: "moonshot", providerLabel: "Moonshot AI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000003, completion: 0.0000012 }, features: ["reasoning"], description: "Kimi K2 推理高速版" },
  { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5", provider: "moonshot", providerLabel: "Moonshot AI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000006, completion: 0.0000025 }, features: ["function-calling", "reasoning"], description: "Kimi K2.5 升级版" },
  { id: "moonshotai/kimi-k2-0905", name: "Kimi K2 0905", provider: "moonshot", providerLabel: "Moonshot AI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000006, completion: 0.0000025 }, features: ["function-calling"], description: "Kimi K2 固定版本" },

  // ── MiniMax (Vercel) ──────────────────────────────────────
  { id: "minimax/minimax-m2", name: "MiniMax M2", provider: "minimax", providerLabel: "MiniMax", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000003, completion: 0.0000009 }, features: ["function-calling"], description: "MiniMax 旗舰" },
  { id: "minimax/minimax-m2.5", name: "MiniMax M2.5", provider: "minimax", providerLabel: "MiniMax", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000003, completion: 0.0000009 }, features: ["function-calling"], description: "MiniMax M2.5 旗舰" },
  { id: "minimax/minimax-m2.5-highspeed", name: "MiniMax M2.5 HS", provider: "minimax", providerLabel: "MiniMax", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000003, completion: 0.0000009 }, features: ["function-calling"], description: "MiniMax M2.5 高速版" },
  { id: "minimax/minimax-m2.7", name: "MiniMax M2.7", provider: "minimax", providerLabel: "MiniMax", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000005, completion: 0.0000015 }, features: ["function-calling", "reasoning"], description: "MiniMax M2.7 旗舰" },

  // ── NVIDIA Nemotron (Vercel) ──────────────────────────────
  { id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 3 Super 120B", provider: "nvidia", providerLabel: "NVIDIA", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000002, completion: 0.000006 }, features: ["function-calling", "reasoning"], description: "NVIDIA 超大 MoE 推理旗舰" },
  { id: "nvidia/nemotron-3-nano-30b-a3b", name: "Nemotron 3 Nano 30B", provider: "nvidia", providerLabel: "NVIDIA", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000003, completion: 0.0000009 }, features: ["function-calling"], description: "NVIDIA 轻量 MoE 模型" },
  { id: "nvidia/nemotron-nano-12b-v2-vl", name: "Nemotron Nano 12B VL", provider: "nvidia", providerLabel: "NVIDIA", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.0000001, completion: 0.0000003 }, features: ["vision"], description: "NVIDIA 轻量视觉模型" },
  { id: "nvidia/nemotron-nano-9b-v2", name: "Nemotron Nano 9B", provider: "nvidia", providerLabel: "NVIDIA", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000050, completion: 0.000000150 }, features: ["function-calling"], description: "NVIDIA 超轻量 9B" },

  // ── ByteDance Seed (Vercel) ───────────────────────────────
  { id: "bytedance/seed-1.6", name: "Seed 1.6", provider: "bytedance", providerLabel: "ByteDance", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000003, completion: 0.0000009 }, features: ["function-calling"], description: "字节跳动 Seed 1.6 旗舰" },
  { id: "bytedance/seed-1.8", name: "Seed 1.8", provider: "bytedance", providerLabel: "ByteDance", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000003, completion: 0.0000009 }, features: ["function-calling", "reasoning"], description: "字节跳动 Seed 1.8 旗舰" },

  // ── Arcee AI (Vercel) ─────────────────────────────────────
  { id: "arcee-ai/trinity-large-preview", name: "Trinity Large", provider: "arcee-ai", providerLabel: "Arcee AI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000001, completion: 0.000003 }, features: ["function-calling"], description: "Arcee Trinity 大型旗舰" },
  { id: "arcee-ai/trinity-large-thinking", name: "Trinity Large Thinking", provider: "arcee-ai", providerLabel: "Arcee AI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000001, completion: 0.000003 }, features: ["reasoning"], description: "Arcee Trinity 推理版" },
  { id: "arcee-ai/trinity-mini", name: "Trinity Mini", provider: "arcee-ai", providerLabel: "Arcee AI", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000100, completion: 0.000000300 }, features: [], description: "Arcee Trinity 轻量版" },

  // ── ZAI GLM (Vercel) ──────────────────────────────────────
  { id: "zai/glm-4.5", name: "GLM-4.5", provider: "zai", providerLabel: "ZAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000001, completion: 0.000003 }, features: ["function-calling"], description: "智谱 GLM-4.5 旗舰" },
  { id: "zai/glm-4.5-air", name: "GLM-4.5 Air", provider: "zai", providerLabel: "ZAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000000100, completion: 0.000000300 }, features: ["function-calling"], description: "GLM-4.5 轻量版" },
  { id: "zai/glm-4.5v", name: "GLM-4.5V", provider: "zai", providerLabel: "ZAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000001, completion: 0.000003 }, features: ["vision", "function-calling"], description: "GLM-4.5 视觉版" },
  { id: "zai/glm-4.6", name: "GLM-4.6", provider: "zai", providerLabel: "ZAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000001, completion: 0.000003 }, features: ["function-calling"], description: "智谱 GLM-4.6" },
  { id: "zai/glm-4.7", name: "GLM-4.7", provider: "zai", providerLabel: "ZAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000002, completion: 0.000006 }, features: ["function-calling", "reasoning"], description: "智谱 GLM-4.7 旗舰推理" },
  { id: "zai/glm-5", name: "GLM-5", provider: "zai", providerLabel: "ZAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000002, completion: 0.000006 }, features: ["function-calling", "reasoning"], description: "智谱 GLM-5 旗舰" },
  { id: "zai/glm-5.1", name: "GLM-5.1", provider: "zai", providerLabel: "ZAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000002, completion: 0.000006 }, features: ["function-calling", "reasoning"], description: "智谱 GLM-5.1 旗舰" },
  { id: "zai/glm-5-turbo", name: "GLM-5 Turbo", provider: "zai", providerLabel: "ZAI", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000005, completion: 0.0000015 }, features: ["function-calling"], description: "GLM-5 高速版" },

  // ── Inception Mercury (Vercel) ────────────────────────────
  { id: "inception/mercury-2", name: "Mercury 2", provider: "inception", providerLabel: "Inception", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000600, completion: 0.0000024 }, features: ["function-calling"], description: "Inception Mercury 扩散语言模型" },
  { id: "inception/mercury-coder-small", name: "Mercury Coder Small", provider: "inception", providerLabel: "Inception", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000300, completion: 0.0000012 }, features: [], description: "Mercury 代码轻量版" },

  // ── Prime Intellect (Vercel) ──────────────────────────────
  { id: "prime-intellect/intellect-3", name: "Intellect 3", provider: "prime-intellect", providerLabel: "Prime Intellect", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.000000300, completion: 0.000001200 }, features: ["reasoning"], description: "Prime Intellect 开源推理旗舰" },

  // ── Xiaomi MiMo (Vercel) ──────────────────────────────────
  { id: "xiaomi/mimo-v2-flash", name: "MiMo V2 Flash", provider: "xiaomi", providerLabel: "Xiaomi", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000001, completion: 0.0000003 }, features: [], description: "小米 MiMo 推理轻量版" },
  { id: "xiaomi/mimo-v2-pro", name: "MiMo V2 Pro", provider: "xiaomi", providerLabel: "Xiaomi", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000003, completion: 0.0000009 }, features: ["reasoning"], description: "小米 MiMo 推理旗舰" },

  // ── Meituan LongCat (Vercel) ──────────────────────────────
  { id: "meituan/longcat-flash-chat", name: "LongCat Flash Chat", provider: "meituan", providerLabel: "Meituan", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000001, completion: 0.0000003 }, features: ["function-calling"], description: "美团 LongCat 快速对话" },
  { id: "meituan/longcat-flash-thinking-2601", name: "LongCat Flash Thinking", provider: "meituan", providerLabel: "Meituan", channel: "vercel", contextWindow: 131072, pricing: { prompt: 0.0000001, completion: 0.0000003 }, features: ["reasoning"], description: "美团 LongCat 推理版" },

  // ── Morph (Vercel) ────────────────────────────────────────
  { id: "morph/morph-v3-fast", name: "Morph V3 Fast", provider: "morph", providerLabel: "Morph", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000000500, completion: 0.0000020 }, features: ["function-calling"], description: "Morph 代码编辑高速版" },
  { id: "morph/morph-v3-large", name: "Morph V3 Large", provider: "morph", providerLabel: "Morph", channel: "vercel", contextWindow: 128000, pricing: { prompt: 0.000002000, completion: 0.0000080 }, features: ["function-calling"], description: "Morph 代码编辑旗舰" },
];

const MODEL_PRICING_MAP: Record<string, ModelPricing> = Object.fromEntries(
  MODEL_CATALOG.map((m) => [m.id, m.pricing])
);

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING_MAP[model] ?? { prompt: 0.000002, completion: 0.000002 };
  return promptTokens * pricing.prompt + completionTokens * (pricing.completion ?? 0);
}

function getProviderBaseUrl(provider: string): string {
  return PROVIDER_BASE_URLS[provider] ?? PROVIDER_BASE_URLS.vercel;
}

// ── Embeddings proxy ────────────────────────────────────────────────────────
router.post("/v1/embeddings", requireProxyApiKey, async (req, res): Promise<void> => {
  const start = Date.now();
  const key = await getNextKey();

  if (!key) {
    res.status(503).json({ error: "No enabled API keys available" });
    return;
  }

  const model = req.body?.model ?? "alibaba/qwen3-embedding-8b";
  const baseUrl = getProviderBaseUrl(key.provider);

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key.apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    const statusCode = response.status;
    const data = await response.json() as {
      usage?: { prompt_tokens?: number; total_tokens?: number };
      [key: string]: unknown;
    };

    const promptTokens = data?.usage?.prompt_tokens ?? data?.usage?.total_tokens ?? 0;
    const durationMs = Date.now() - start;
    const estimatedCostUsd = estimateCost(model, promptTokens, 0);

    await db.insert(usageLogsTable).values({
      keyId: key.id, model, promptTokens, completionTokens: 0,
      totalTokens: promptTokens, estimatedCostUsd: estimatedCostUsd.toString(),
      statusCode, durationMs,
    }).catch(() => {});

    if (statusCode >= 200 && statusCode < 300) {
      await db.update(apiKeysTable).set({
        totalRequests: sql`${apiKeysTable.totalRequests} + 1`,
        totalTokens: sql`${apiKeysTable.totalTokens} + ${promptTokens}`,
        estimatedCostUsd: sql`${apiKeysTable.estimatedCostUsd} + ${estimatedCostUsd}`,
        lastUsedAt: new Date(),
      }).where(eq(apiKeysTable.id, key.id)).catch(() => {});
    }

    res.status(statusCode).json(data);
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.error({ err }, "Embeddings proxy request failed");
    await db.insert(usageLogsTable).values({
      keyId: key.id, model, promptTokens: 0, completionTokens: 0, totalTokens: 0,
      estimatedCostUsd: "0", statusCode: 500, durationMs,
    }).catch(() => {});
    if (!res.headersSent) {
      res.status(500).json({ error: "Embeddings proxy request failed" });
    }
  }
});

router.post("/v1/chat/completions", requireProxyApiKey, async (req, res): Promise<void> => {
  const start = Date.now();
  const model = req.body?.model ?? "openai/gpt-4o-mini";

  const blocked = await getBlockedProviders();
  const blockedLower = blocked.map(b => b.toLowerCase());
  const catalogEntry = MODEL_CATALOG.find(m => m.id === model);
  if (catalogEntry && (
    blockedLower.includes(catalogEntry.provider.toLowerCase()) ||
    blockedLower.includes(catalogEntry.providerLabel.toLowerCase())
  )) {
    res.status(403).json({
      error: {
        message: `模型 "${model}" 的供应商 "${catalogEntry.providerLabel}" 已被屏蔽`,
        type: "invalid_request_error",
        code: "provider_blocked",
      },
    });
    return;
  }

  const key = await getNextKey();

  if (!key) {
    res.status(503).json({ error: "No enabled API keys available" });
    return;
  }

  const baseUrl = getProviderBaseUrl(key.provider);

  // Build infra-skip headers for Vercel gateway
  const INFRA_PROVIDERS = ["deepinfra", "together", "fireworks"];
  const blockedInfra = blockedLower.filter(b => INFRA_PROVIDERS.includes(b));
  const extraHeaders: Record<string, string> = {};
  if (blockedInfra.length > 0) {
    extraHeaders["x-vercel-ai-skip-providers"] = blockedInfra.join(",");
    extraHeaders["x-ai-skip-providers"] = blockedInfra.join(",");
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key.apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(req.body),
    });

    // Check if Vercel used a blocked infra provider
    if (blockedInfra.length > 0) {
      const usedProvider = (
        response.headers.get("x-vercel-ai-gateway-provider") ??
        response.headers.get("x-ai-provider") ??
        response.headers.get("x-provider") ??
        ""
      ).toLowerCase();
      if (usedProvider && blockedInfra.some(b => usedProvider.includes(b))) {
        res.status(403).json({
          error: {
            message: `请求被代理拒绝：Vercel 将此次调用路由到了已屏蔽的基础设施商 "${usedProvider}"`,
            type: "invalid_request_error",
            code: "infra_provider_blocked",
          },
        });
        return;
      }
    }

    const statusCode = response.status;
    const contentType = response.headers.get("content-type") ?? "";

    // ── Streaming SSE response ─────────────────────────────
    if (contentType.includes("text/event-stream")) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.status(statusCode);

      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;
      let lineBuffer = "";

      const reader = response.body?.getReader();
      if (!reader) {
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);

          // Parse SSE lines to capture usage from any chunk
          lineBuffer += chunk;
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const json = JSON.parse(line.slice(6)) as {
                  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
                };
                if (json.usage) {
                  promptTokens = json.usage.prompt_tokens ?? promptTokens;
                  completionTokens = json.usage.completion_tokens ?? completionTokens;
                  totalTokens = json.usage.total_tokens ?? (promptTokens + completionTokens);
                }
              } catch { /* non-JSON SSE line, skip */ }
            }
          }
        }
      } finally {
        reader.releaseLock();
        res.end();
      }

      // Log usage after stream completes
      const durationMs = Date.now() - start;
      const estimatedCostUsd = estimateCost(model, promptTokens, completionTokens);

      await db.insert(usageLogsTable).values({
        keyId: key.id, model, promptTokens, completionTokens, totalTokens,
        estimatedCostUsd: estimatedCostUsd.toString(), statusCode, durationMs,
      }).catch(() => {});

      if (statusCode >= 200 && statusCode < 300) {
        await db.update(apiKeysTable).set({
          totalRequests: sql`${apiKeysTable.totalRequests} + 1`,
          totalTokens: sql`${apiKeysTable.totalTokens} + ${totalTokens}`,
          estimatedCostUsd: sql`${apiKeysTable.estimatedCostUsd} + ${estimatedCostUsd}`,
          lastUsedAt: new Date(),
        }).where(eq(apiKeysTable.id, key.id)).catch(() => {});
      }

    // ── Non-streaming JSON response ────────────────────────
    } else if (contentType.includes("application/json")) {
      const data = await response.json() as {
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        [key: string]: unknown;
      };

      const promptTokens = data?.usage?.prompt_tokens ?? 0;
      const completionTokens = data?.usage?.completion_tokens ?? 0;
      const totalTokens = data?.usage?.total_tokens ?? (promptTokens + completionTokens);
      const durationMs = Date.now() - start;
      const estimatedCostUsd = estimateCost(model, promptTokens, completionTokens);

      await db.insert(usageLogsTable).values({
        keyId: key.id, model, promptTokens, completionTokens, totalTokens,
        estimatedCostUsd: estimatedCostUsd.toString(), statusCode, durationMs,
      });

      if (statusCode >= 200 && statusCode < 300) {
        await db.update(apiKeysTable).set({
          totalRequests: sql`${apiKeysTable.totalRequests} + 1`,
          totalTokens: sql`${apiKeysTable.totalTokens} + ${totalTokens}`,
          estimatedCostUsd: sql`${apiKeysTable.estimatedCostUsd} + ${estimatedCostUsd}`,
          lastUsedAt: new Date(),
        }).where(eq(apiKeysTable.id, key.id));
      }

      res.status(statusCode).json(data);

    // ── Other response types ───────────────────────────────
    } else {
      const text = await response.text();
      const durationMs = Date.now() - start;
      await db.insert(usageLogsTable).values({
        keyId: key.id, model, promptTokens: 0, completionTokens: 0, totalTokens: 0,
        estimatedCostUsd: "0", statusCode, durationMs,
      }).catch(() => {});
      res.status(statusCode).send(text);
    }
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.error({ err }, "Proxy request failed");
    await db.insert(usageLogsTable).values({
      keyId: key.id, model, promptTokens: 0, completionTokens: 0, totalTokens: 0,
      estimatedCostUsd: "0", statusCode: 500, durationMs,
    }).catch(() => {});
    if (!res.headersSent) {
      res.status(500).json({ error: "Proxy request failed" });
    }
  }
});

router.get("/v1/models", requireProxyApiKey, async (_req, res): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  const blocked = await getBlockedProviders();
  const blockedLower = blocked.map(b => b.toLowerCase());

  const filtered = MODEL_CATALOG.filter(m =>
    !blockedLower.includes(m.provider.toLowerCase()) &&
    !blockedLower.includes(m.providerLabel.toLowerCase())
  );

  res.json({
    object: "list",
    data: filtered.map((m) => ({
      id: m.id,
      object: "model",
      created: now,
      owned_by: m.provider,
    })),
  });
});

router.get("/v1/models/catalog", requireProxyApiKey, async (_req, res): Promise<void> => {
  const blocked = await getBlockedProviders();
  const blockedLower = blocked.map(b => b.toLowerCase());
  const filtered = MODEL_CATALOG.filter(m =>
    !blockedLower.includes(m.provider.toLowerCase()) &&
    !blockedLower.includes(m.providerLabel.toLowerCase())
  );
  res.json({ models: filtered });
});

export default router;
