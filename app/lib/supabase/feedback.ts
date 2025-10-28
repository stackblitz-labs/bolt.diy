import { getSupabase } from './client';
import { toast } from 'react-toastify';

export async function supabaseSubmitFeedback(feedback: any) {
  const supabase = getSupabase();

  // Get the current user ID if available
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id || null;

  // Insert feedback into the feedback table
  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    description: feedback.description || feedback.text || JSON.stringify(feedback),
    metadata: feedback,
  });

  if (error) {
    console.error('Error submitting feedback to Supabase:', error);
    toast.error('Failed to submit feedback');

    return false;
  }

  return true;
}
