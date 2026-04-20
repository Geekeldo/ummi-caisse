import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function verifySuperAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Non authentifié', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, role:roles(*)')
    .eq('id', user.id)
    .single()

  const roleName = profile?.role?.name
  if (roleName !== 'super_admin') {
    return { ok: false as const, error: 'Permission refusée — super_admin requis', status: 403 }
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  return { ok: true as const, user, adminClient }
}

// ── POST: Create user ──
export async function POST(request: Request) {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json()
    const { email, password, full_name, role_id } = body

    if (!email || !password || !full_name || !role_id) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const { data: newUser, error: createError } = await auth.adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (newUser?.user) {
      await auth.adminClient.from('profiles').update({
        full_name,
        role_id,
      }).eq('id', newUser.user.id)
    }

    return NextResponse.json({ success: true, user: newUser.user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── PATCH: Update user profile ──
export async function PATCH(request: Request) {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json()
    const { user_id, full_name, email, role_id, password } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    }

    // Cannot modify yourself through this endpoint
    if (user_id === auth.user.id) {
      return NextResponse.json({ error: 'Utilisez votre profil pour modifier votre compte' }, { status: 400 })
    }

    // Update auth fields (email / password)
    const authUpdates: Record<string, string> = {}
    if (email) authUpdates.email = email
    if (password) authUpdates.password = password

    if (Object.keys(authUpdates).length > 0) {
      const { error: authErr } = await auth.adminClient.auth.admin.updateUserById(user_id, authUpdates)
      if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })
    }

    // Update profile
    const updates: Record<string, any> = {}
    if (full_name) updates.full_name = full_name
    if (role_id) updates.role_id = role_id

    if (Object.keys(updates).length > 0) {
      const { error: profileErr } = await auth.adminClient.from('profiles').update(updates).eq('id', user_id)
      if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── DELETE: Delete user ──
export async function DELETE(request: Request) {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    // Cannot delete yourself
    if (userId === auth.user.id) {
      return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 })
    }

    // Delete from Supabase Auth (cascade will handle profile via trigger/FK)
    const { error: deleteError } = await auth.adminClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    // Also clean up profile row in case no cascade
    await auth.adminClient.from('profiles').delete().eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
