
import { SidebarTrigger } from '@/components/ui/sidebar';

export const MobileHeader = () => {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
      <SidebarTrigger />
      <div className="flex-1">
        <h1 className="text-lg font-semibold">LeadFlow</h1>
      </div>
    </header>
  );
};
