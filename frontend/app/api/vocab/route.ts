import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('supabase_auth_id', user.id)
      .single();
      
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('vocabulary')
      .select(`
        *,
        user_reviews (
          next_review_at,
          interval_days,
          ease_factor,
          streak_count
        )
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
