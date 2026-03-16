import { complete } from '@/lib/bot/ai-provider';
import { logger } from '@/lib/bot/logger';

export interface CallAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore: number; // -1 to 1
  summary: string;
  topics: string[];
  actionItems: string[];
  customerIntent: string;
  resolutionStatus: 'resolved' | 'pending' | 'escalation_needed' | 'unknown';
  keyMoments: Array<{
    timestamp?: string;
    description: string;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;
  suggestions?: string[];
}

/**
 * Analyze a call transcript using AI to extract insights
 */
export async function analyzeCallTranscript(
  transcript: Array<{ role: string; content: string }>,
  context?: {
    businessName?: string;
    callDuration?: number;
    callerPhone?: string;
  }
): Promise<CallAnalysis> {
  if (!transcript || transcript.length === 0) {
    return getDefaultAnalysis('No transcript available');
  }

  const formattedTranscript = transcript
    .map(msg => `${msg.role === 'user' ? 'Caller' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  const systemPrompt = `You are an AI call analyst. Analyze the following phone call transcript and extract structured insights.

Return a JSON object with this exact structure:
{
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "sentimentScore": number between -1 (very negative) and 1 (very positive),
  "summary": "2-3 sentence summary of the call",
  "topics": ["list", "of", "main", "topics", "discussed"],
  "actionItems": ["list of any action items or follow-ups needed"],
  "customerIntent": "What the caller was trying to accomplish",
  "resolutionStatus": "resolved" | "pending" | "escalation_needed" | "unknown",
  "keyMoments": [{"description": "Notable moment in the call", "sentiment": "positive" | "negative" | "neutral"}],
  "suggestions": ["suggestions for improving service based on this call"]
}

Context:
- Business: ${context?.businessName || 'Unknown'}
- Call Duration: ${context?.callDuration ? `${Math.floor(context.callDuration / 60)}m ${context.callDuration % 60}s` : 'Unknown'}

Be accurate and objective. If the call was brief or uninformative, reflect that in your analysis.`;

  try {
    const result = await complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this call transcript:\n\n${formattedTranscript}` }
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    const content = result.message.content || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]) as CallAnalysis;
      logger.info({ sentiment: analysis.sentiment, topics: analysis.topics }, 'Call analysis completed');
      return analysis;
    }

    return getDefaultAnalysis('Could not parse analysis');
  } catch (error) {
    logger.error({ error }, 'Failed to analyze call transcript');
    return getDefaultAnalysis('Analysis failed');
  }
}

/**
 * Quick sentiment analysis for real-time feedback
 */
export async function quickSentimentAnalysis(
  text: string
): Promise<{ sentiment: 'positive' | 'neutral' | 'negative'; confidence: number }> {
  try {
    const result = await complete({
      messages: [
        {
          role: 'system',
          content: 'Analyze the sentiment of the following text. Respond with only JSON: {"sentiment": "positive"|"neutral"|"negative", "confidence": 0.0-1.0}'
        },
        { role: 'user', content: text }
      ],
      temperature: 0,
      maxTokens: 50,
    });

    const content = result.message.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { sentiment: 'neutral', confidence: 0.5 };
  } catch {
    return { sentiment: 'neutral', confidence: 0 };
  }
}

function getDefaultAnalysis(reason: string): CallAnalysis {
  return {
    sentiment: 'neutral',
    sentimentScore: 0,
    summary: reason,
    topics: [],
    actionItems: [],
    customerIntent: 'Unknown',
    resolutionStatus: 'unknown',
    keyMoments: [],
    suggestions: [],
  };
}

/**
 * Available Neural Polly voices for Twilio
 * These are the most natural-sounding neural voices
 */
export const NEURAL_POLLY_VOICES = [
  // English (US)
  { id: 'Polly.Joanna-Neural', name: 'Joanna (US Female)', language: 'en-US', gender: 'female' },
  { id: 'Polly.Matthew-Neural', name: 'Matthew (US Male)', language: 'en-US', gender: 'male' },
  { id: 'Polly.Kendra-Neural', name: 'Kendra (US Female)', language: 'en-US', gender: 'female' },
  { id: 'Polly.Joey-Neural', name: 'Joey (US Male)', language: 'en-US', gender: 'male' },
  { id: 'Polly.Ruth-Neural', name: 'Ruth (US Female)', language: 'en-US', gender: 'female' },
  { id: 'Polly.Stephen-Neural', name: 'Stephen (US Male)', language: 'en-US', gender: 'male' },
  
  // English (UK)
  { id: 'Polly.Amy-Neural', name: 'Amy (UK Female)', language: 'en-GB', gender: 'female' },
  { id: 'Polly.Emma-Neural', name: 'Emma (UK Female)', language: 'en-GB', gender: 'female' },
  { id: 'Polly.Brian-Neural', name: 'Brian (UK Male)', language: 'en-GB', gender: 'male' },
  
  // Spanish
  { id: 'Polly.Lucia-Neural', name: 'Lucía (ES Female)', language: 'es-ES', gender: 'female' },
  { id: 'Polly.Sergio-Neural', name: 'Sergio (ES Male)', language: 'es-ES', gender: 'male' },
  { id: 'Polly.Lupe-Neural', name: 'Lupe (MX Female)', language: 'es-MX', gender: 'female' },
  { id: 'Polly.Pedro-Neural', name: 'Pedro (MX Male)', language: 'es-MX', gender: 'male' },
  { id: 'Polly.Mia-Neural', name: 'Mia (MX Female)', language: 'es-MX', gender: 'female' },
  
  // French
  { id: 'Polly.Lea-Neural', name: 'Léa (FR Female)', language: 'fr-FR', gender: 'female' },
  { id: 'Polly.Remi-Neural', name: 'Rémi (FR Male)', language: 'fr-FR', gender: 'male' },
  
  // German
  { id: 'Polly.Vicki-Neural', name: 'Vicki (DE Female)', language: 'de-DE', gender: 'female' },
  { id: 'Polly.Daniel-Neural', name: 'Daniel (DE Male)', language: 'de-DE', gender: 'male' },
  
  // Italian
  { id: 'Polly.Bianca-Neural', name: 'Bianca (IT Female)', language: 'it-IT', gender: 'female' },
  { id: 'Polly.Adriano-Neural', name: 'Adriano (IT Male)', language: 'it-IT', gender: 'male' },
  
  // Portuguese
  { id: 'Polly.Camila-Neural', name: 'Camila (BR Female)', language: 'pt-BR', gender: 'female' },
  { id: 'Polly.Vitoria-Neural', name: 'Vitória (BR Female)', language: 'pt-BR', gender: 'female' },
  { id: 'Polly.Thiago-Neural', name: 'Thiago (BR Male)', language: 'pt-BR', gender: 'male' },
  
  // Japanese
  { id: 'Polly.Kazuha-Neural', name: 'Kazuha (JP Female)', language: 'ja-JP', gender: 'female' },
  { id: 'Polly.Takumi-Neural', name: 'Takumi (JP Male)', language: 'ja-JP', gender: 'male' },
  
  // Korean
  { id: 'Polly.Seoyeon-Neural', name: 'Seoyeon (KR Female)', language: 'ko-KR', gender: 'female' },
  
  // Chinese Mandarin
  { id: 'Polly.Zhiyu-Neural', name: 'Zhiyu (CN Female)', language: 'cmn-CN', gender: 'female' },
];

/**
 * Get voices filtered by language
 */
export function getVoicesForLanguage(languageCode: string): typeof NEURAL_POLLY_VOICES {
  const langPrefix = languageCode.split('-')[0];
  return NEURAL_POLLY_VOICES.filter(v => 
    v.language === languageCode || v.language.startsWith(langPrefix)
  );
}
