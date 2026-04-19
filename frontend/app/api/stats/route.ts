import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, streak_days')
      .eq('supabase_auth_id', user.id)
      .single();
      
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // Total words
    const { count: totalWords } = await supabase
      .from('vocabulary')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id);

    // Mastered words (mastery_level >= 3)
    const { count: masteredWords } = await supabase
      .from('vocabulary')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .gte('mastery_level', 3);

    // Weak words (ease_factor < 2.0 or similarity)
    const { count: weakWords } = await supabase
      .from('user_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .lt('ease_factor', 2.0);

    // Due today
    const { count: dueToday } = await supabase
        .from('user_reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .lte('next_review_at', new Date().toISOString());

    // Words reviewed today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const { count: reviewedToday } = await supabase
      .from('review_log') // assuming this table exists based on brief
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .gte('created_at', startOfToday.toISOString());

    return NextResponse.json({
      total_words: totalWords || 0,
      mastered_words: masteredWords || 0,
      weak_words: weakWords || 0,
      due_today: dueToday || 0,
      streak_days: profile.streak_days || 0,
      words_reviewed_today: reviewedToday || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
