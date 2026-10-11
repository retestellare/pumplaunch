import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import NftTradePanel from './NftTradePanel';

export default function NftTradeSheet({ open, collection, onClose, onTraded }) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-[#0a0b0d] border-white/5 p-0 max-h-[88vh] overflow-y-auto"
      >
        <SheetTitle className="sr-only">Trade {collection?.name}</SheetTitle>
        {open && collection && <NftTradePanel collection={collection} onTraded={onTraded} />}
      </SheetContent>
    </Sheet>
  );
}