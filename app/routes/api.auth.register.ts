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

    const { email, password, name } = body as {
      email: string;
      password: string;
      name?: string;
    };

    // Validation
    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Email không hợp lệ' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return Response.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 });
    }

    const supabase = getSupabaseClient(context?.env);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      console.error('Supabase register error:', error);

      const errorMessages: Record<string, string> = {
        'User already registered': 'Email đã được đăng ký',
        'Password should be at least 6 characters': 'Mật khẩu phải có ít nhất 6 ký tự',
        'Unable to validate email address: invalid format': 'Email không hợp lệ',
      };

      return Response.json(
        {
          error: errorMessages[error.message] || error.message,
        },
        { status: 400 },
      );
    }

    if (!data.user) {
      return Response.json({ error: 'Đăng ký thất bại' }, { status: 400 });
    }

    const needsConfirmation = !data.session;

    return Response.json({
      success: true,
      needsConfirmation,
      message: needsConfirmation ? 'Vui lòng kiểm tra email để xác nhận tài khoản' : 'Đăng ký thành công',
    });
  } catch (error) {
    console.error('Register API error:', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
