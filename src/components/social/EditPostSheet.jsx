import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import CreatePost from '@/components/CreatePost';

export default function EditPostSheet({ open, post, onSaved, onClose }) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="bg-[#0a0b0d] border-white/5 p-0">
        <SheetTitle className="sr-only">Edit callout</SheetTitle>
        {open && post && (
          <CreatePost
            post={post}
            onDone={(updated) => {
              if (updated) onSaved?.(updated);
              onClose();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}