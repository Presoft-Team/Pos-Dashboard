'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, Trash2, Copy, Check, Plus, X, ShieldCheck, User } from 'lucide-react'

interface Member {
  id: string
  email: string
  name: string
  role: 'admin' | 'member'
  created_at: string
}

interface NewCredential {
  email: string
  name: string
  password: string
}

export default function MembersPage() {
  const supabase = createClient()
  const router = useRouter()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [organisation, setOrganisation] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [credential, setCredential] = useState<NewCredential | null>(null)
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.app_metadata?.role !== 'admin') {
      router.replace('/')
      return
    }
    setCurrentUserId(user.id)
    setOrganisation((user.app_metadata?.organisation as string) || null)
    setIsAdmin(true)
    setAuthLoading(false)
    fetchMembers()
  }

  async function fetchMembers() {
    setLoading(true)
    const res = await fetch('/api/members')
    const data = await res.json()
    setMembers(data.members ?? [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to add member.')
      setSubmitting(false)
      return
    }

    setCredential({ email: data.email, name: data.name, password: data.password })
    setEmail('')
    setName('')
    setShowForm(false)
    setSubmitting(false)
    fetchMembers()
  }

  async function handleRoleToggle(member: Member) {
    if (member.id === currentUserId) return
    const newRole = member.role === 'admin' ? 'member' : 'admin'
    setTogglingId(member.id)

    await fetch('/api/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.id, role: newRole }),
    })

    setTogglingId(null)
    fetchMembers()
  }

  async function handleDelete(id: string) {
    if (id === currentUserId) return
    if (!confirm('Remove this member? They will no longer be able to log in.')) return
    setDeletingId(id)
    await fetch('/api/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeletingId(null)
    fetchMembers()
  }

  function copyCredentials() {
    if (!credential) return
    navigator.clipboard.writeText(
      `Name: ${credential.name}\nEmail: ${credential.email}\nPassword: ${credential.password}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Members</h1>
          <p className="text-sm text-gray-500">
            Manage who has access to the dashboard
            {organisation && <> · Organisation: <span className="font-medium text-gray-700">{organisation}</span></>}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dark text-ink text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} />
          Add Member
        </button>
      </div>

      {/* New credential banner */}
      {credential && (
        <div className="bg-mint/10 border border-mint/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-mint-dark">Member added — share these credentials</p>
            <button onClick={() => setCredential(null)} className="text-mint-dark hover:opacity-70">
              <X size={16} />
            </button>
          </div>
          <div className="bg-white rounded-lg border border-mint/30 p-4 space-y-1 font-mono text-sm text-gray-700">
            <p><span className="text-gray-400">Name:</span> {credential.name}</p>
            <p><span className="text-gray-400">Email:</span> {credential.email}</p>
            <p><span className="text-gray-400">Password:</span> {credential.password}</p>
          </div>
          <button
            onClick={copyCredentials}
            className="flex items-center gap-2 px-3 py-1.5 bg-mint hover:bg-mint-dark text-white text-xs font-medium rounded-lg transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy credentials'}
          </button>
        </div>
      )}

      {/* Add member form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">New Member</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm">{error}</div>
          )}
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Sarah Lim"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="member@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-400">A password will be auto-generated. Share it with the member so they can log in and change it.</p>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-brand hover:bg-brand-dark disabled:opacity-60 text-ink text-sm font-medium rounded-lg transition-colors"
              >
                {submitting ? 'Adding…' : 'Add Member'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={15} className="text-gray-400" />
          <h3 className="font-semibold text-gray-900 text-sm">All Members</h3>
          {!loading && <span className="ml-auto text-xs text-gray-400">{members.length} total</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">No members yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <span className="text-brand-dark text-xs font-semibold">
                      {(m.name || m.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{m.name || '—'}</p>
                      {m.id === currentUserId && (
                        <span className="text-xs text-gray-400">(you)</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{m.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Role badge / toggle */}
                  <button
                    onClick={() => handleRoleToggle(m)}
                    disabled={togglingId === m.id || m.id === currentUserId}
                    title={m.id === currentUserId ? 'Cannot change your own role' : `Switch to ${m.role === 'admin' ? 'member' : 'admin'}`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      m.role === 'admin'
                        ? 'bg-brand/10 text-brand-dark hover:bg-brand/20'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {togglingId === m.id ? (
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : m.role === 'admin' ? (
                      <ShieldCheck size={12} />
                    ) : (
                      <User size={12} />
                    )}
                    {m.role === 'admin' ? 'Admin' : 'Member'}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id || m.id === currentUserId}
                    title={m.id === currentUserId ? 'Cannot remove yourself' : 'Remove member'}
                    className="p-1.5 text-gray-400 hover:text-danger transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
