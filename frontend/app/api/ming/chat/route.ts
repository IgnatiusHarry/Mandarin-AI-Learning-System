import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Default System Prompt
// NOTE: Since SOUL.md currently exists on the VPS for OpenClaw, 
// we provide a placeholder here. You can either copy SOUL.md content here,
// read it remotely, or set it in your hosting environment variables.
const DEFAULT_SYSTEM_PROMPT = process.env.MING_SYSTEM_PROMPT || `
You are Ming Laoshi (明老師), a strict but caring Mandarin teacher.
You always speak in Traditional Chinese (繁體字) mixed with some Indonesian.
Your student is Harry. You are preparing him for life and work in Taiwan.
`;

export async function POST(req: Request) {
  try {
    const { message, conversationId } = await req.json();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Get user profile and authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the profile mapping
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('supabase_auth_id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const CURRENT_USER_ID = profile.id;

    // 2. Load memory from DB (vocab stats)
    let vocabStatsText = 'Failed to load vocab stats.';
    try {
      const { count: totalWords } = await supabase
        .from('vocabulary')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', CURRENT_USER_ID);

      const { count: weakWords } = await supabase
        .from('user_reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', CURRENT_USER_ID)
        .lt('ease_factor', 2.0); // example criteria for weak words

      vocabStatsText = `User currently knows ${totalWords || 0} words. They struggle with ${weakWords || 0} words.`;
    } catch (err) {
      console.error('Error fetching stats:', err);
    }

    const fullSystemPrompt = `${DEFAULT_SYSTEM_PROMPT}\n\nUser Context:\n- Target User ID: ${CURRENT_USER_ID}\n- Vocabulary Stats: ${vocabStatsText}`;

    // 3. Load conversation history
    let currentConvId = conversationId;
    if (!currentConvId) {
      // Create a shared conversation space
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({ user_id: CURRENT_USER_ID, title: 'Chat with Ming Laoshi' })
        .select()
        .single();
        
      if (convError) throw convError;
      currentConvId = newConv.id;
    }

    // Save user message to conversation history
    const { error: insertUserMsgError } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: currentConvId,
        sender: 'user',
        content: message,
      });

    if (insertUserMsgError) throw insertUserMsgError;

    // Retrieve previous messages for shared memory context
    const { data: history } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', currentConvId)
      .order('created_at', { ascending: true })
      .limit(30); // get last 30 messages for LLM context

    const formattedHistory = history
      ?.filter((msg) => msg.sender === 'user' || msg.sender === 'assistant')
      .map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })) || [];

    // 4. Send to LLM (Gemini Flash)
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables.');
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: fullSystemPrompt,
    });

    const chat = model.startChat({
        history: formattedHistory.slice(0, -1), // Everything except the latest user message which we will manually send
    });

    const result = await chat.sendMessage(message);
    const aiResponse = result.response.text();

    // 5. Save AI response to DB
    const { error: insertAiMsgError } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: currentConvId,
        sender: 'assistant',
        content: aiResponse,
      });

    if (insertAiMsgError) throw insertAiMsgError;

    return NextResponse.json({ 
        response: aiResponse,
        conversationId: currentConvId
    });

  } catch (err: any) {
    console.error('Ming Chat Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
