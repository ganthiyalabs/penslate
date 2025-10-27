import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useLocation } from '@tanstack/react-router';
import {
  Bell,
  Command as CommandIcon,
  CreditCard,
  Home,
  LogOut,
  Settings,
  User,
} from 'lucide-react';
import { useState } from 'react';

export default function TopBar() {
  const location = useLocation();
  const [commandOpen, setCommandOpen] = useState(false);

  // Generate breadcrumbs based on current route
  const generateBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [];

    // Always start with Home
    breadcrumbs.push({
      label: 'Home',
      href: '/',
      isCurrent: pathSegments.length === 0,
    });

    // Add other segments
    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      // Convert segment to readable label
      const label = segment.charAt(0).toUpperCase() + segment.slice(1);

      breadcrumbs.push({
        label,
        href: currentPath,
        isCurrent: isLast,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <div className="flex flex-1 items-center justify-between">
      {/* Breadcrumbs on the left */}
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((breadcrumb, index) => (
            <div key={breadcrumb.href} className="flex items-center">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {breadcrumb.isCurrent ? (
                  <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={breadcrumb.href}>{breadcrumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* User icon and command bar on the right */}
      <div className="flex items-center gap-2">
        {/* Command Bar */}
        <div className="relative">
          <Input
            placeholder="Search or type a command..."
            className="w-64 pr-8 cursor-pointer h-8"
            readOnly
            onClick={() => setCommandOpen(true)}
          />
          <CommandIcon className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-2 transition-all">
              <AvatarImage src="/avatars/user.jpg" alt="User" />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">SparkTown User</p>
                <p className="text-xs leading-none text-muted-foreground">user@sparktown.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Billing</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="mr-2 h-4 w-4" />
                <span>Notifications</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Command Dialog */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() => {
                window.location.href = '/';
                setCommandOpen(false);
              }}
            >
              <Home className="mr-2 h-4 w-4" />
              <span>Go to Home</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                window.location.href = '/dashboard';
                setCommandOpen(false);
              }}
            >
              <CommandIcon className="mr-2 h-4 w-4" />
              <span>Go to Dashboard</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Account">
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
              }}
            >
              <User className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
