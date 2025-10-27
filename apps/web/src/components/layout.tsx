import { NavUser } from '@/components/nav-user';
import TopBar from '@/components/topbar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Link, Outlet } from '@tanstack/react-router';
import { ArchiveX, Command, File, Home, Inbox, Send, Trash2 } from 'lucide-react';
import * as React from 'react';

// Sample data for navigation
const data = {
  user: {
    name: 'SparkTown User',
    email: 'user@sparktown.com',
    avatar: '/avatars/user.jpg',
  },
  navMain: [
    {
      title: 'Home',
      url: '/',
      icon: Home,
      isActive: true,
    },
    {
      title: 'Dashboard',
      url: '/dashboard',
      icon: Inbox,
      isActive: false,
    },
    {
      title: 'Documents',
      url: '/documents',
      icon: File,
      isActive: false,
    },
    {
      title: 'Shared',
      url: '/shared',
      icon: Send,
      isActive: false,
    },
    {
      title: 'Archive',
      url: '/archive',
      icon: ArchiveX,
      isActive: false,
    },
    {
      title: 'Trash',
      url: '/trash',
      icon: Trash2,
      isActive: false,
    },
  ],
};

function AppSidebar() {
  const [activeItem, setActiveItem] = React.useState(data.navMain[0]);
  const { setOpen } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="overflow-hidden *:data-[sidebar=sidebar]:flex-row">
      {/* First sidebar - icon navigation */}
      <Sidebar collapsible="none" className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <Link to="/">
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <Command className="size-4" />
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        setActiveItem(item);
                        setOpen(true);
                      }}
                      isActive={activeItem?.title === item.title}
                      className="px-2.5 md:px-2"
                      asChild
                    >
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={data.user} />
        </SidebarFooter>
      </Sidebar>

      {/* Second sidebar - expanded content */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-foreground text-base font-medium">{activeItem?.title}</div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              <div className="p-4 text-sm text-muted-foreground">
                Welcome to {activeItem?.title}. This is where your content will be displayed.
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  );
}

export default function Layout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex flex-1 flex-col">
          <header className="flex h-12 items-center gap-4 border-b bg-background px-2">
            <SidebarTrigger />
            <TopBar />
          </header>
          <main className="flex-1 p-4">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
