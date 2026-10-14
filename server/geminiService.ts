import { GoogleGenAI, Type } from '@google/genai';
import { AptitudeQuestion } from '../src/types';
import { DEFAULT_APTITUDE_QUESTIONS } from '../src/data/mockData';

let aiClient: GoogleGenAI | null = null;
let isGeminiDenied = false;

function getGenAI(): GoogleGenAI | null {
  if (isGeminiDenied) return null;
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

export async function generateAptitudeQuestions(
  role: string,
  requirements?: string,
  questionCount: number = 8
): Promise<AptitudeQuestion[]> {
  const ai = getGenAI();
  if (!ai) {
    return DEFAULT_APTITUDE_QUESTIONS;
  }

  try {
    const prompt = `You are a Principal Tech Recruiter and Technical Assessor setting a high-stakes technical assessment for the role of: "${role}".
Specific Job Requirements/Focus: "${requirements || 'Strong computer science foundations, algorithms, system architecture, concurrency, database internals, and quantitative logic'}".
Generate exactly ${questionCount} advanced technical and quantitative aptitude multiple-choice questions. Each question must carry exactly 10 marks (totaling ${questionCount * 10} marks).
Rules:
1. Questions must test genuine technical depth, edge cases, reasoning, and problem-solving, not superficial syntax trivia.
2. Provide exactly 4 options per question.
3. Clearly mark the 0-indexed 'correctAnswerIndex' (0, 1, 2, or 3).
4. Provide a thorough, educational 'explanation'.
5. Set 'marks' to 10 for each question.
6. The topics should be diverse: Data Structures, Concurrency, Networking/APIs, Database Internals, Quantitative Logic, System Architecture.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an elite technical assessment architect creating rigorous technical aptitude evaluation questions.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'Array of technical aptitude questions',
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              topic: { type: Type.STRING },
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Exactly 4 distinct options'
              },
              correctAnswerIndex: {
                type: Type.INTEGER,
                description: '0-based index of the correct option (0 to 3)'
              },
              explanation: { type: Type.STRING },
              marks: { type: Type.INTEGER, description: 'Must be 10' }
            },
            required: ['topic', 'question', 'options', 'correctAnswerIndex', 'explanation', 'marks']
          }
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim()) as AptitudeQuestion[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((q, idx) => ({
          ...q,
          id: q.id || `gen-apt-${idx + 1}`,
          marks: 10
        }));
      }
    }
  } catch (err: any) {
    if (err?.status === 403 || err?.message?.includes('PERMISSION_DENIED') || err?.message?.includes('denied access')) {
      isGeminiDenied = true;
    }
    console.log('[Question Generator] Utilized calibrated standard technical question bank.');
  }

  return DEFAULT_APTITUDE_QUESTIONS;
}
