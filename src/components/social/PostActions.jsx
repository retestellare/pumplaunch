import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import EditPostSheet from '@/components/social/EditPostSheet';

// Author-only controls on a callout: edit it in the same composer, or delete it
// along with the comments it collected.
export default function PostActions({ post, onSaved, onDeleted, onChange }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await base44.entities.Post.delete(post.id);
      await base44.entities.Comment.deleteMany({ post_id: post.id });
      setConfirming(false);
      onDeleted?.();
      onChange?.();
      toast({ title: 'Callout deleted' });
    } catch (e) {
      toast({ title: 'Could not delete', description: e.message || String(e), variant: 'destructive' });
    }
    setDeleting(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="p-1 -mr-1 text-white/40" aria-label="Post options">
          <MoreVertical size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil size={14} className="mr-2" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirming(true)} className="text-[#ff3b5c]">
            <Trash2 size={14} className="mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPostSheet
        open={editing}
        post={post}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          onSaved?.(updated);
          onChange?.();
        }}
      />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this callout?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the feed for everyone, together with its comments. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}