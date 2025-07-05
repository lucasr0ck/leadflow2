
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { MobileHeader } from './MobileHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export const MainLayout = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset>
          <MobileHeader />
          <main className="flex-1 overflow-auto">
            <div className="p-4 lg:p-8">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
