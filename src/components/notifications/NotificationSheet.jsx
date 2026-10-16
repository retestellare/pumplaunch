import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import NotificationRow from '@/components/notifications/NotificationRow';
import { MASCOT_IMAGE } from '@/lib/brandAssets';
import { Image } from '@/components/ui/image';

// The notification feed, grouped the way pump.fun does it: one app header with
// the count and a collapse chevron, the activity stacked underneath.
export default function NotificationSheet({ open, onOpenChange, items, loading, enabled }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-[#0a0b0d] border-white/5 p-0 max-h-[80vh] overflow-y-auto"
      >
        <SheetTitle className="sr-only">Notifications</SheetTitle>
        <div className="px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center gap-2.5 px-2 py-3 select-none transition duration-200 hover:bg-[#16211E]/60 rounded-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
          >
            <Image
              src={MASCOT_IMAGE}
              alt=""
              fittingType="fill"
              className="w-[30px] h-[30px] rounded-[9px] border border-[#00F59B]/25"
            />
            <span className="flex-1 text-left text-[14px] font-bold text-[#F2F7F4]">PumpLaunch</span>
            {items.length > 0 && (
              <span className="min-w-[22px] h-[20px] px-1.5 rounded-[10px] bg-[#16211E] border border-[#00F59B]/25 text-[11px] font-black text-[#00F59B] flex items-center justify-center">
                {items.length}
              </span>
            )}
            <ChevronDown
              size={16}
              className={`text-[#F2F7F4]/35 transition-transform duration-200 ${
                collapsed ? '' : 'rotate-180'
              }`}
            />
          </button>

          {!collapsed && (
            <div className="space-y-0.5">
              {!enabled && (
                <p className="px-3 pb-1.5 text-[11px] text-[#FF8A9B]">
                  Notifications are off. Turn them back on in settings.
                </p>
              )}
              {loading && items.length === 0 ? (
                <div className="w-[20px] h-[20px] border-2 border-[#16211E] border-t-[#00F59B] rounded-full animate-spin mx-auto my-4" />
              ) : items.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12px] text-[#F2F7F4]/40">
                  No notifications yet.
                </p>
              ) : (
                items.map((item) => (
                  <NotificationRow key={item.id} item={item} onOpen={() => onOpenChange(false)} />
                ))
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}