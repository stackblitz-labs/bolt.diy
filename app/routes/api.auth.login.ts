import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient(env?: any) {
  const supabaseUrl = env?.DATABASE_URL || process.env.DATABASE_URL;
  const supabaseKey = env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as any).email !== 'string' ||
      typeof (body as any).password !== 'string'
    ) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { email, password } = body as { email: string; password: string };

    // Validation
    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Email không hợp lệ' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return Response.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 });
    }

    const supabase = getSupabaseClient(context?.env);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase auth error:', error);

      const errorMessages: Record<string, string> = {
        'Invalid login credentials': 'Email hoặc mật khẩu không đúng',
        'Email not confirmed': 'Vui lòng xác nhận email trước khi đăng nhập',
      };

      return Response.json(
        {
          error: errorMessages[error.message] || error.message,
        },
        { status: 401 },
      );
    }

    if (!data.user || !data.session) {
      return Response.json({ error: 'Đăng nhập thất bại' }, { status: 401 });
    }

    return Response.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email!,
        name: data.user.user_metadata?.full_name || data.user.email!.split('@')[0],
        avatar: data.user.user_metadata?.avatar_url,
      },
      token: data.session.access_token,
    });
  } catch (error) {
    console.error('Login API error:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
