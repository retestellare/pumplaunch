import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// One entry in the settings menu: a link when it points at a page, a button when
// it opens something in place.
export default function SettingsRow({ icon: Icon, label, description, to, onClick }) {
  const content = (
    <>
      <span className="w-9 h-9 rounded-[10px] bg-[#16211E] border border-[#00F59B]/20 text-[#00F59B] flex items-center justify-center shrink-0">
        <Icon size={17} />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[13px] font-bold text-[#F2F7F4]">{label}</span>
        {description && (
          <span className="block text-[11px] text-[#F2F7F4]/40 truncate">{description}</span>
        )}
      </span>
      <ChevronRight size={16} className="text-[#F2F7F4]/25 shrink-0" />
    </>
  );

  const className =
    'w-full flex items-center gap-3 px-3 py-3 rounded-[12px] select-none transition duration-200 hover:bg-[#16211E]/70 active:bg-[#0e1614] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]';

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}