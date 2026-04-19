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
      .select('id')
      .eq('supabase_auth_id', user.id)
      .single();
      
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const lessonTag = searchParams.get('lesson_tag');

    let query = supabase
      .from('user_reviews')
      .select(`
        *,
        vocabulary (*)
      `)
      .eq('user_id', profile.id)
      .lt('ease_factor', 2.0)
      .order('ease_factor', { ascending: true })
      .limit(20);

    if (lessonTag) {
        // Unfortunately standard Supabase JS filtering on joined tables can be tricky
        // If the 'source' is in vocabulary table, we might need a better way.
        // For now let's fetch all weak and filter in JS if needed, or assume tag filter not critical for weak view yet.
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
