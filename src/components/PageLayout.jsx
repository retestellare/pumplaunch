import BottomNav from './BottomNav';

export default function PageLayout({ title, children, showNav = true, rightAction }) {
  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg">
          <h1 className="text-lg font-bold tracking-tight">{title}</h1>
          {rightAction}
        </div>
      </header>
      <main>{children}</main>
      {showNav && <BottomNav />}
    </div>
  );
}