// Uses Node 18+ native global fetch — no import needed

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct'; 

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Check if the NVIDIA API is reachable and ready.
 */
export async function checkVllmStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${NVIDIA_BASE_URL}/models`, {
      headers: { 'Authorization': `Bearer ${NVIDIA_API_KEY}` },
      signal: AbortSignal.timeout(3000) 
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Generic chat completion — takes an array of messages and returns the AI reply using NVIDIA API.
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const { maxTokens = 512, temperature = 0.7, systemPrompt } = options;

  const fullMessages: ChatMessage[] = [];

  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt });
  }
  fullMessages.push(...messages);

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: fullMessages,
      max_tokens: maxTokens,
      temperature,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA API error: ${response.status} — ${error}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * Summarize a block of text (document, notice, chat log, etc.)
 */
export async function summarizeText(text: string): Promise<string> {
  return chat(
    [{ role: 'user', content: `Summarize the following text concisely in bullet points:\n\n${text}` }],
    {
      maxTokens: 256,
      temperature: 0.3,
      systemPrompt:
        'You are a helpful assistant for a business workflow platform. Be concise and professional.',
    }
  );
}

/**
 * Summarize a block of text using NVIDIA's Mistral model
 */
export async function summarizeWithMistral(text: string): Promise<string> {
  const MISTRAL_MODEL = 'mistralai/mixtral-8x7b-instruct-v0.1'; // The requested mistral model

  // Re-use the fetch pattern but overriding the model
  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert document analyzer. Summarize the following OCR text concisely, highlighting key entities, action items, and main ideas.' },
        { role: 'user', content: text }
      ],
      max_tokens: 512,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Mistral API error: ${response.status} — ${error}`);
    return "Error generating summary.";
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * Generate task step suggestions given a task title and description.
 */
export async function getTaskHelp(
  taskTitle: string,
  taskDescription: string
): Promise<string> {
  return chat(
    [
      {
        role: 'user',
        content: `I have a work task titled: "${taskTitle}"\n\nDescription: ${taskDescription}\n\nBreak this down into clear, actionable steps I should follow to complete it.`,
      },
    ],
    {
      maxTokens: 400,
      temperature: 0.5,
      systemPrompt:
        'You are a professional project management assistant. Provide practical, numbered steps to complete work tasks.',
    }
  );
}
