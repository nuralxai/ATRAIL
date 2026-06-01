import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import * as aiService from './ai.service.js';

const router = Router();

/**
 * GET /ai/status
 * Returns whether the vLLM server is reachable.
 */
router.get('/status', requireAuth, async (_req: Request, res: Response) => {
  try {
    const online = await aiService.checkVllmStatus();
    return res.json({ ok: true, vllmOnline: online });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /ai/chat
 * Body: { message: string, history?: { role, content }[] }
 * General-purpose AI chat for the floating assistant widget.
 */
router.post('/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ ok: false, error: 'message is required' });
    }

    const messages: aiService.ChatMessage[] = [
      ...history,
      { role: 'user', content: message },
    ];

    const reply = await aiService.chat(messages, {
      systemPrompt:
        'You are a helpful AI assistant embedded in AGMI Workflow, a business project management platform. Help users with tasks, projects, HR queries, scheduling, and general work questions. Be concise, professional, and friendly.',
    });

    return res.json({ ok: true, reply });
  } catch (err: any) {
    console.error('[AI chat error]', err.message);
    return res.status(502).json({ ok: false, error: 'AI service unavailable. Make sure vLLM is running.' });
  }
});

/**
 * POST /ai/summarize
 * Body: { text: string }
 * Summarizes any text content (documents, notices, chat logs).
 */
router.post('/summarize', requireAuth, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ ok: false, error: 'text is required' });
    }

    if (text.length > 10000) {
      return res.status(400).json({ ok: false, error: 'Text too long (max 10,000 characters)' });
    }

    const summary = await aiService.summarizeText(text);
    return res.json({ ok: true, summary });
  } catch (err: any) {
    console.error('[AI summarize error]', err.message);
    return res.status(502).json({ ok: false, error: 'AI service unavailable.' });
  }
});

/**
 * POST /ai/task-help
 * Body: { taskTitle: string, taskDescription: string }
 * Returns AI-generated step-by-step guidance for a task.
 */
router.post('/task-help', requireAuth, async (req: Request, res: Response) => {
  try {
    const { taskTitle, taskDescription } = req.body;

    if (!taskTitle) {
      return res.status(400).json({ ok: false, error: 'taskTitle is required' });
    }

    const steps = await aiService.getTaskHelp(taskTitle, taskDescription ?? '');
    return res.json({ ok: true, steps });
  } catch (err: any) {
    console.error('[AI task-help error]', err.message);
    return res.status(502).json({ ok: false, error: 'AI service unavailable.' });
  }
});

export default router;
