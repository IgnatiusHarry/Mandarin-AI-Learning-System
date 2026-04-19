import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { vocabulary_id, quality, response_time_ms } = await req.json();

    if (!vocabulary_id || typeof quality !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Load existing review
    const { data: existingReview, error: fetchError } = await supabase
      .from('user_reviews')
      .select('*')
      .eq('vocabulary_id', vocabulary_id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    // SM-2 Algorithm Implementation
    let easeFactor = existingReview ? existingReview.ease_factor : 2.5;
    let streakCount = existingReview ? existingReview.streak_count : 0;
    let intervalDays = existingReview ? existingReview.interval_days : 0;

    // Based on user's SM-2 Algorithm update:
    // quality 0-2 -> reset interval ke 1 hari
    // quality 3   -> susah ingat, interval pendek
    // quality 4   -> oke, interval normal
    // quality 5   -> mudah, interval makin panjang
    // ease_factor min 1.3, default 2.5

    if (quality >= 3) {
      if (streakCount === 0) {
        intervalDays = 1;
      } else if (streakCount === 1) {
        intervalDays = 6;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor);
      }
      streakCount += 1;
    } else {
      streakCount = 0;
      intervalDays = 1; // Reset to 1 day as per brief
    }

    // Update ease factor
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);
    
    // Save to database
    const reviewData = {
      user_id: user.id,
      vocabulary_id,
      ease_factor: easeFactor,
      interval_days: intervalDays,
      streak_count: streakCount,
      next_review_at: nextReviewAt.toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingReview) {
      const { error: updateError } = await supabase
        .from('user_reviews')
        .update(reviewData)
        .eq('id', existingReview.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('user_reviews')
        .insert(reviewData);
      if (insertError) throw insertError;
    }

    // Update mastery level in vocabulary based on streak count
    // streak 0 = 0, 1-2 = 1, 3-4 = 2, 5+ = 3
    let masteryLevel = 0;
    if (streakCount >= 1 && streakCount <= 2) masteryLevel = 1;
    else if (streakCount >= 3 && streakCount <= 4) masteryLevel = 2;
    else if (streakCount >= 5) masteryLevel = 3;

    await supabase
      .from('vocabulary')
      .update({ mastery_level: masteryLevel })
      .eq('id', vocabulary_id);

    return NextResponse.json({ 
      next_review_in_days: intervalDays, 
      mastery_level: masteryLevel,
      success: true 
    });

  } catch (err: any) {
    console.error('Error submitting review answer:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
