import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Bell, UserCircle, Rss, LayoutDashboard, Settings } from "lucide-react";
import Link from "next/link";
import { AppSidebarMobileNav } from "./AppSidebarMobileNav";


interface AppHeaderProps {
  // pageTitle will be dynamic later if needed, for now it's simple
}

export function AppHeader({}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
      <div className="md:hidden">
        <AppSidebarMobileNav />
      </div>
      
      <div className="flex-1">
        {/* Placeholder for breadcrumbs or dynamic title */}
         {/* <h1 className="text-lg font-semibold md:text-xl font-headline">Dashboard</h1> */}
      </div>
      
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
          <UserCircle className="h-5 w-5" />
          <span className="sr-only">User Menu</span>
        </Button>
      </div>
    </header>
  );
}
