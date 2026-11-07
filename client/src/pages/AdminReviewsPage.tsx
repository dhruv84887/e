import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, RefreshCw, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, messageOf } from '../services/api'
import { useToast } from '../context/ToastContext'

type ReviewRow = {
  _id: string
  rating: number
  title?: string
  body: string
  isPublished: boolean
  isVerifiedPurchase: boolean
  createdAt: string
  user?: { name: string; email: string }
  product?: { name: string; slug: string }
  order?: { orderNumber: string }
}

export function AdminReviewsPage() {
  const client = useQueryClient(), toast = useToast()
  const [status, setStatus] = useState<'all' | 'published' | 'hidden'>('all')
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['admin-reviews', status, page],
    queryFn: async () => (await api.get('/admin/reviews', { params: { status: status === 'all' ? undefined : status, page } })).data as {
      reviews: ReviewRow[]; pagination: { page: number; pages: number; total: number }
    }
  })
  const moderate = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => api.patch(`/admin/reviews/${id}`, { isPublished }),
    onSuccess: async (_, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin-reviews'] }),
        client.invalidateQueries({ queryKey: ['product'] }),
        client.invalidateQueries({ queryKey: ['reviews'] }),
        client.invalidateQueries({ queryKey: ['products'] })
      ])
      toast(variables.isPublished ? 'Review is now visible in the shop.' : 'Review has been hidden from the shop.')
    },
    onError: (error) => toast(messageOf(error), 'error')
  })

  return <>
    <div className="admin-page-head"><div><span>Notes from the community</span><h1>Reviews</h1></div></div>
    <div className="admin-toolbar">
      <div className="admin-filter-tabs">{(['all', 'published', 'hidden'] as const).map((item) => <button className={status === item ? 'active' : ''} key={item} onClick={() => { setStatus(item); setPage(1) }}>{item === 'all' ? 'All reviews' : item}</button>)}</div>
      <span>{query.data?.pagination.total || 0} reviews in this view</span>
    </div>
    <section className="admin-table-wrap">
      <table className="admin-table admin-review-table">
        <thead><tr><th>Review</th><th>Product</th><th>Customer</th><th>Order</th><th>Visibility</th><th></th></tr></thead>
        <tbody>{query.data?.reviews.map((review) => <tr key={review._id}>
          <td className="admin-review-copy"><span className="admin-review-rating"><Star size={13} fill="currentColor" /> {review.rating}/5</span><b>{review.title || 'Customer note'}</b><small>{review.body}</small><time>{new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time></td>
          <td>{review.product ? <Link to={`/product/${review.product.slug}`}>{review.product.name}</Link> : 'Product removed'}</td>
          <td><span className="admin-customer"><b>{review.user?.name || 'Customer'}</b><small>{review.isVerifiedPurchase ? 'Verified purchase' : review.user?.email}</small></span></td>
          <td>{review.order?.orderNumber || '—'}</td>
          <td><span className={`published-pill ${review.isPublished ? '' : 'archived'}`}><i />{review.isPublished ? 'Published' : 'Hidden'}</span></td>
          <td><button className="admin-text-button" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: review._id, isPublished: !review.isPublished })}>{review.isPublished ? 'Hide review' : 'Publish review'} <ArrowRight size={12} /></button></td>
        </tr>)}</tbody>
      </table>
      {query.isLoading && <div className="table-loading">Gathering the community’s notes…</div>}
      {query.isError && <div className="table-loading" role="alert">Could not load reviews. <button className="admin-text-button" onClick={() => void query.refetch()}><RefreshCw size={13} /> Try again</button></div>}
      {query.data && !query.data.reviews.length && <div className="table-loading">No reviews in this view yet.</div>}
    </section>
    {query.data && query.data.pagination.pages > 1 && <div className="admin-pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {query.data.pagination.pages}</span><button disabled={page >= query.data.pagination.pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
  </>
}
