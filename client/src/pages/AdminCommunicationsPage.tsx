import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, ExternalLink, Mail, MailOpen, RefreshCw, Search, Users, X } from 'lucide-react'
import { api, messageOf } from '../services/api'
import { useToast } from '../context/ToastContext'

type ContactMessage = { _id: string; name: string; email: string; subject: string; message: string; status: 'new' | 'read' | 'resolved'; createdAt: string }
type Subscriber = { _id: string; email: string; isActive: boolean; createdAt: string }
type Pagination = { page: number; pages: number; total: number }

export function AdminCommunicationsPage() {
  const client = useQueryClient(), toast = useToast()
  const [tab, setTab] = useState<'messages' | 'subscribers'>('messages')
  const [messageStatus, setMessageStatus] = useState('')
  const [subscriberStatus, setSubscriberStatus] = useState('active')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const messages = useQuery({ queryKey: ['admin-communications-messages', messageStatus, page], queryFn: async () => (await api.get('/admin/communications/messages', { params: { status: messageStatus || undefined, page } })).data as { messages: ContactMessage[]; newCount: number; pagination: Pagination } })
  const subscribers = useQuery({ queryKey: ['admin-communications-subscribers', subscriberStatus, q, page], queryFn: async () => (await api.get('/admin/communications/subscribers', { params: { status: subscriberStatus || undefined, q: q || undefined, page } })).data as { subscribers: Subscriber[]; pagination: Pagination }, enabled: tab === 'subscribers' })
  const statusChange = useMutation({ mutationFn: async ({ id, status }: { id: string; status: ContactMessage['status'] }) => api.patch(`/admin/communications/messages/${id}`, { status }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['admin-communications-messages'] }); toast('Message status updated.') }, onError: (error) => toast(messageOf(error), 'error') })
  const subscriberChange = useMutation({ mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/admin/communications/subscribers/${id}`, { isActive }), onSuccess: async (_result, variables) => { await client.invalidateQueries({ queryKey: ['admin-communications-subscribers'] }); toast(variables.isActive ? 'Subscriber reactivated.' : 'Subscriber unsubscribed.') }, onError: (error) => toast(messageOf(error), 'error') })
  const openMessage = (message: ContactMessage) => { setSelected(message.status === 'new' ? { ...message, status: 'read' } : message); if (message.status === 'new') statusChange.mutate({ id: message._id, status: 'read' }) }
  const refresh = () => { void client.invalidateQueries({ queryKey: ['admin-communications-messages'] }); void client.invalidateQueries({ queryKey: ['admin-communications-subscribers'] }) }
  const chooseTab = (next: 'messages' | 'subscribers') => { setTab(next); setPage(1); setSelected(null) }
  const setMessageFilter = (status: string) => { setMessageStatus(status); setPage(1) }
  const setSubscriberFilter = (status: string) => { setSubscriberStatus(status); setPage(1) }
  const currentPagination = tab === 'messages' ? messages.data?.pagination : subscribers.data?.pagination

  return <>
    <div className="admin-page-head"><div><span>Notes from your community</span><h1>Inbox & subscribers</h1></div><button className="admin-secondary" onClick={refresh}><RefreshCw size={15} /> Refresh</button></div>
    <div className="admin-filter-tabs communication-tabs">
      <button className={tab === 'messages' ? 'active' : ''} onClick={() => chooseTab('messages')}><Mail size={15} /> Messages {messages.data?.newCount ? <b>{messages.data.newCount}</b> : null}</button>
      <button className={tab === 'subscribers' ? 'active' : ''} onClick={() => chooseTab('subscribers')}><Users size={15} /> Newsletter subscribers</button>
    </div>

    {tab === 'messages' ? <>
      <div className="admin-toolbar communication-toolbar"><div className="admin-filter-tabs">{[['', 'All'], ['new', 'New'], ['read', 'Read'], ['resolved', 'Resolved']].map(([status, label]) => <button key={status || 'all'} className={messageStatus === status ? 'active' : ''} onClick={() => setMessageFilter(status)}>{label}</button>)}</div><span>{messages.data?.pagination.total ?? '—'} messages</span></div>
      <section className="admin-table-wrap"><table className="admin-table communication-table"><thead><tr><th>From</th><th>Subject</th><th>Received</th><th>Status</th><th></th></tr></thead><tbody>{messages.data?.messages.map((message) => <tr key={message._id} className={message.status === 'new' ? 'communication-unread' : ''}><td><span className="admin-customer"><b>{message.name}</b><small>{message.email}</small></span></td><td>{message.subject}</td><td>{new Date(message.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><span className={`communication-status ${message.status}`}>{message.status}</span></td><td><button className="admin-text-button" onClick={() => openMessage(message)}><MailOpen size={14} /> Read</button></td></tr>)}</tbody></table>
        {messages.isLoading && <div className="table-loading">Gathering your messages…</div>}{messages.isError && <div className="table-loading">Couldn’t load messages. <button className="admin-text-button" onClick={() => void messages.refetch()}>Try again</button></div>}{messages.data && !messages.data.messages.length && <div className="table-loading">No messages here yet. They’ll appear when someone writes to your store.</div>}
      </section>
    </> : <>
      <div className="admin-toolbar communication-toolbar"><div className="admin-filter-tabs">{[['active', 'Subscribed'], ['inactive', 'Unsubscribed'], ['', 'Everyone']].map(([status, label]) => <button key={status || 'all'} className={subscriberStatus === status ? 'active' : ''} onClick={() => setSubscriberFilter(status)}>{label}</button>)}</div><label className="admin-search"><Search size={15} /><input type="search" value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="Find an email address…" /></label></div>
      <section className="admin-table-wrap"><table className="admin-table communication-table"><thead><tr><th>Email address</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody>{subscribers.data?.subscribers.map((subscriber) => <tr key={subscriber._id}><td><b>{subscriber.email}</b></td><td>{new Date(subscriber.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><span className={`communication-status ${subscriber.isActive ? 'active' : 'inactive'}`}>{subscriber.isActive ? 'Subscribed' : 'Unsubscribed'}</span></td><td><button className="admin-text-button" disabled={subscriberChange.isPending} onClick={() => subscriberChange.mutate({ id: subscriber._id, isActive: !subscriber.isActive })}>{subscriber.isActive ? 'Unsubscribe' : 'Reactivate'}</button></td></tr>)}</tbody></table>
        {subscribers.isLoading && <div className="table-loading">Gathering your subscribers…</div>}{subscribers.isError && <div className="table-loading">Couldn’t load subscribers. <button className="admin-text-button" onClick={() => void subscribers.refetch()}>Try again</button></div>}{subscribers.data && !subscribers.data.subscribers.length && <div className="table-loading">No subscribers match this view.</div>}
      </section>
    </>}
    <div className="admin-pagination"><button disabled={!currentPagination || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /> Previous</button><span>{currentPagination ? `Page ${currentPagination.page} of ${Math.max(1, currentPagination.pages)} · ${currentPagination.total} total` : `Page ${page}`}</span><button disabled={!currentPagination || page >= currentPagination.pages} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight size={15} /></button></div>

    {selected && <div className="admin-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="admin-modal communication-detail"><div className="admin-modal-head"><div><span>Received {new Date(selected.createdAt).toLocaleString('en-IN')}</span><h2>{selected.subject}</h2></div><button onClick={() => setSelected(null)} aria-label="Close message"><X size={19} /></button></div><div className="communication-message-meta"><div><span className="order-avatar">{selected.name.slice(0, 1).toUpperCase()}</span><span><b>{selected.name}</b><a href={`mailto:${selected.email}`}>{selected.email} <ExternalLink size={12} /></a></span></div><span className={`communication-status ${selected.status}`}>{selected.status}</span></div><p className="communication-message-body">{selected.message}</p><div className="communication-detail-actions"><a className="admin-secondary" href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}><Mail size={15} /> Reply by email</a>{selected.status !== 'resolved' ? <button className="admin-primary" disabled={statusChange.isPending} onClick={() => { statusChange.mutate({ id: selected._id, status: 'resolved' }); setSelected({ ...selected, status: 'resolved' }) }}><Check size={15} /> Mark resolved</button> : <button className="admin-secondary" disabled={statusChange.isPending} onClick={() => { statusChange.mutate({ id: selected._id, status: 'read' }); setSelected({ ...selected, status: 'read' }) }}><MailOpen size={15} /> Reopen</button>}</div></section></div>}
  </>
}
