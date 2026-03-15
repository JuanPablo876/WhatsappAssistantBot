import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-local';

/**
 * POST /api/onboarding/generate-prompt
 * Takes the business description and generates a tailored AI system prompt.
 * Uses a template-based approach for reliability.
 * 
 * Note: This endpoint only requires authentication, not a tenant,
 * because it's called during onboarding before a tenant exists.
 */

const LANGUAGE_PROMPTS: Record<string, { greeting: string; closing: string; booking: string; unknown: string }> = {
  en: {
    greeting: "Hello! I'm the virtual assistant for",
    closing: "Is there anything else I can help you with?",
    booking: "Would you like to schedule an appointment?",
    unknown: "I don't have that information, but I can connect you with a team member who can help.",
  },
  es: {
    greeting: "¡Hola! Soy el asistente virtual de",
    closing: "¿Hay algo más en lo que pueda ayudarte?",
    booking: "¿Te gustaría agendar una cita?",
    unknown: "No tengo esa información, pero puedo conectarte con un miembro del equipo que puede ayudarte.",
  },
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  friendly: "Be warm, approachable, and use a conversational tone. You can use emojis sparingly to be more personable.",
  professional: "Maintain a formal, polished tone. Be courteous and efficient while remaining warm.",
  casual: "Be relaxed and conversational, like chatting with a friend. Keep it light but helpful.",
  empathetic: "Be caring, understanding, and supportive. Acknowledge feelings and show genuine concern.",
};

function generateSystemPrompt(params: {
  businessName: string;
  assistantName?: string;
  businessType: string;
  description: string;
  services: string;
  tone: string;
  language: string;
}): string {
  const { businessName, assistantName, businessType, description, services, tone, language } = params;
  const lang = LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS.en;
  const toneInstr = TONE_INSTRUCTIONS[tone] || tone; // Custom tone passed directly
  
  const assistantIntro = assistantName 
    ? `You are ${assistantName}, the virtual assistant for ${businessName}.`
    : `You are the virtual assistant for ${businessName}.`;

  const serviceList = services
    ? services.split(',').map(s => s.trim()).filter(Boolean).join(', ')
    : 'general inquiries and appointments';

  const isSpanish = language === 'es';

  const prompt = `${assistantIntro}

${isSpanish ? 'SOBRE EL NEGOCIO:' : 'ABOUT THE BUSINESS:'}
${businessName} is a ${businessType.toLowerCase()} business.
${description}

${isSpanish ? 'SERVICIOS QUE OFRECEMOS:' : 'SERVICES WE OFFER:'}
${serviceList}

${isSpanish ? 'TU PERSONALIDAD Y TONO:' : 'YOUR PERSONALITY AND TONE:'}
${toneInstr}

${isSpanish ? 'DIRECTRICES DE CONVERSACIÓN:' : 'CONVERSATION GUIDELINES:'}
1. ${isSpanish ? 'Saluda amablemente y ofrece ayuda' : 'Greet warmly and offer assistance'}
2. ${isSpanish ? 'Responde preguntas sobre nuestros servicios, horarios y ubicación' : 'Answer questions about our services, hours, and location'}
3. ${isSpanish ? 'Ayuda a los clientes a agendar citas cuando lo soliciten' : 'Help clients schedule appointments when requested'}
4. ${isSpanish ? 'Si no sabes algo, sé honesto y ofrece conectar con el equipo' : "If you don't know something, be honest and offer to connect with the team"}
5. ${isSpanish ? 'Siempre sé respetuoso y profesional' : 'Always be respectful and professional'}
6. ${isSpanish ? 'Responde en español' : 'Respond in the language the customer uses'}

${isSpanish ? 'AL AGENDAR CITAS:' : 'WHEN SCHEDULING APPOINTMENTS:'}
- ${isSpanish ? 'Pregunta qué servicio necesitan' : 'Ask what service they need'}
- ${isSpanish ? 'Confirma fecha y hora preferidas' : 'Confirm preferred date and time'}
- ${isSpanish ? 'Solicita nombre y número de contacto' : 'Request name and contact number'}
- ${isSpanish ? 'Confirma los detalles antes de finalizar' : 'Confirm details before finalizing'}

${isSpanish ? 'RECUERDA:' : 'REMEMBER:'}
- ${isSpanish ? 'Eres útil, no insistente' : "You're helpful, not pushy"}
- ${isSpanish ? 'Mantén las respuestas CORTAS — máximo 2-3 oraciones (estilo WhatsApp)' : 'Keep responses SHORT — aim for 2-3 sentences maximum (WhatsApp style)'}
- ${isSpanish ? 'Sé breve y directo, sin saludos innecesarios' : 'Be brief and direct, skip unnecessary greetings or small talk'}`;

  return prompt;
}

export async function POST(request: Request) {
  console.log('[generate-prompt] Request received');
  try {
    const user = await getAuthenticatedUser();
    console.log('[generate-prompt] User:', user?.email || 'NOT AUTHENTICATED');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { businessName, assistantName, businessType, description, services, tone, language } = body;
    console.log('[generate-prompt] Business:', businessName, 'Type:', businessType);

    // Generate the system prompt using template
    const generatedPrompt = generateSystemPrompt({
      businessName,
      assistantName,
      businessType,
      description,
      services: services || 'General appointments',
      tone: tone || 'friendly',
      language: language || 'en',
    });

    console.log('[generate-prompt] Generated prompt. Length:', generatedPrompt.length);

    return NextResponse.json({
      success: true,
      prompt: generatedPrompt,
    });
  } catch (error: any) {
    console.error('[generate-prompt] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate prompt', details: error.message },
      { status: 500 }
    );
  }
}
