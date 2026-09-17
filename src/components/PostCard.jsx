import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Heart, MessageCircle } from 'lucide-react';

export default function PostCard({ post, onChange }) {
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');

  const like = async () => {
    if (liked) return;
    setLiked(true);
    await base44.entities.Post.update(post.id, { likes: (post.likes || 0) + 1 });
    onChange?.();
  };

  const loadComments = async () => {
    const list = await base44.entities.Comment.filter({ post_id: post.id }, 'created_date', 50);
    setComments(list);
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(!showComments);
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    await base44.entities.Comment.create({ post_id: post.id, author: 'You', content: commentText });
    await base44.entities.Post.update(post.id, { comments_count: (post.comments_count || 0) + 1 });
    setCommentText('');
    loadComments();
    onChange?.();
  };

  const pnlPositive = (post.pnl || 0) >= 0;

  return (
    <div className="bg-[#141518] rounded-2xl p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40 font-medium">{post.author}</span>
        {post.token_symbol && (
          <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/60 font-bold">
            ${post.token_symbol}
          </span>
        )}
      </div>
      <p className="text-sm text-white/90 mb-3">{post.content}</p>
      {post.position_size ? (
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-black/30 rounded-lg p-2">
            <div className="text-[10px] text-white/40">Position</div>
            <div className="text-sm font-bold">{post.position_size} XLM</div>
          </div>
          <div className="flex-1 bg-black/30 rounded-lg p-2">
            <div className="text-[10px] text-white/40">PnL</div>
            <div className={`text-sm font-bold ${pnlPositive ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}>
              {pnlPositive ? '+' : ''}
              {post.pnl} XLM
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-4">
        <button onClick={like} className="flex items-center gap-1.5 text-xs text-white/50">
          <Heart size={16} className={liked ? 'fill-[#ff3b5c] text-[#ff3b5c]' : ''} />
          {(post.likes || 0) + (liked ? 1 : 0)}
        </button>
        <button onClick={toggleComments} className="flex items-center gap-1.5 text-xs text-white/50">
          <MessageCircle size={16} /> {post.comments_count || 0}
        </button>
      </div>
      {showComments && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="text-white/50 text-xs mr-2">{c.author}</span>
              {c.content}
            </div>
          ))}
          {comments.length === 0 && <p className="text-xs text-white/30">No comments yet.</p>}
          <div className="flex gap-2 mt-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add comment…"
              className="flex-1 bg-black/30 rounded-lg px-3 py-1.5 text-xs outline-none"
            />
            <button
              onClick={submitComment}
              className="px-3 py-1.5 rounded-lg bg-[#00ff88] text-black text-xs font-bold"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}