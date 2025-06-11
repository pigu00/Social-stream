'use client';
import Link from "next/link";
import { LayoutDashboard, Settings, Rss } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from 'next/navigation';

interface AppSidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  // { href: "/settings", label: "Settings", icon: Settings }, // Future page
];

export function AppSidebar({ className }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <div className={cn("hidden border-r bg-card md:block", className)}>
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold font-headline">
            <Rss className="h-6 w-6 text-primary" />
            <span>Social Streamer</span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-4 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-secondary",
                  pathname === item.href && "bg-secondary text-primary"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
