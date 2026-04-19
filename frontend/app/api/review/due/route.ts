import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lessonTag = searchParams.get('lesson_tag');

    let query = supabase.rpc('get_due_reviews', { 
      p_user_id: user.id,
      p_limit: 50 
    });

    if (lessonTag) {
      // NOTE: Using a custom RPC or filtering if lessonTag is provided
      // For now, if the custom RPC `get_due_reviews_by_tag` exists we could use it, 
      // but without it, let's fetch all due and filter later, or just do a standard join query
      // For fallback:
      query = supabase
        .from('vocabulary')
        .select(`
          *,
          user_reviews(*)
        `)
        .eq('user_id', user.id);
        
      const { data, error } = await query;
      if (error) throw error;
      
      const dueCards = data.filter(item => {
        if (lessonTag && item.source !== lessonTag) return false;
        
        const review = item.user_reviews && item.user_reviews.length > 0 ? item.user_reviews[0] : null;
        if (!review) return true; // Never reviewed
        
        return new Date(review.next_review_at) <= new Date(); // Due for review
      });
      
      return NextResponse.json(dueCards || []);
    }

    const { data, error } = await query;
    if (error) {
       // Fallback logic if RPC doesn't exist
       const fallbackQuery = await supabase
       .from('vocabulary')
       .select(`*, user_reviews(*)`)
       .eq('user_id', user.id);
       
       if (fallbackQuery.error) throw fallbackQuery.error;
       
       const dueCards = fallbackQuery.data.filter(item => {
         const review = item.user_reviews && item.user_reviews.length > 0 ? item.user_reviews[0] : null;
         if (!review) return true;
         return new Date(review.next_review_at) <= new Date();
       });
       return NextResponse.json(dueCards || []);
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Error fetching due reviews:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
