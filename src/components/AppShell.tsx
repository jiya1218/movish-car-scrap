"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarClock,
  Car,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeProvider";
import { NAV_MODULES, ROLE_DEFINITIONS } from "@/lib/constants";
import { cn } from "@/lib/format";

const MODULE_ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="w-4 h-4" />,
  meta_ads: <Megaphone className="w-4 h-4" />,
  leads: <Users className="w-4 h-4" />,
  followups: <CalendarClock className="w-4 h-4" />,
  customers: <UserCheck className="w-4 h-4" />,
  vehicles: <Car className="w-4 h-4" />,
  transactions: <IndianRupee className="w-4 h-4" />,
  team: <BarChart3 className="w-4 h-4" />,
  locations: <MapPin className="w-4 h-4" />,
  communication: <MessageSquare className="w-4 h-4" />,
  reports: <FileSpreadsheet className="w-4 h-4" />,
  notifications: <Bell className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
};

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Persistent authenticated navigation shell with Movish Group branding, RBAC sidebar,
 * global search, role switcher, theme toggle, and notifications indicator.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, canSwitchRoles, switchRole, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetch("/api/notifications?filter=unread")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setUnreadCount(d.unreadCount ?? 0);
      })
      .catch(() => {});
  }, [user, pathname]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => {
          setSearchResults(d.results || []);
          setSearchOpen(true);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6fa] dark:bg-[#0b1220]">
        <div className="text-center">
          <img src="/logo.png" alt="Movish Group" className="h-12 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading Movish Group BMS...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const visibleModules = NAV_MODULES.filter((m) => user.allowedModules.includes(m.key));

  const renderNavLinks = (isMobile = false) => (
    <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
      {visibleModules.map((mod) => {
        const isActive =
          mod.href === "/" ? pathname === "/" : pathname === mod.href || pathname.startsWith(`${mod.href}/`);
        return (
          <Link
            key={mod.key}
            href={mod.href}
            onClick={() => isMobile && setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative",
              isActive
                ? "bg-[#0B5CA8] text-white shadow-sm"
                : "text-blue-100/80 hover:bg-white/10 hover:text-white"
            )}
            title={collapsed && !isMobile ? mod.label : undefined}
          >
            {isActive && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[#D62828]" />
            )}
            <span className="shrink-0">{MODULE_ICONS[mod.key]}</span>
            {(!collapsed || isMobile) && (
              <span className="truncate flex-1">{mod.label}</span>
            )}
            {mod.key === "notifications" && unreadCount > 0 && (!collapsed || isMobile) && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#D62828] text-white">
                {unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-[#f4f6fa] dark:bg-[#0b1220] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-[#1B3156] text-white border-r border-[#122340] shrink-0 transition-all duration-200 sticky top-0 h-screen",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="bg-white rounded-lg px-2 py-1 shadow-xs shrink-0">
              <img
                src="/logo.png"
                alt="Movish Group"
                className={cn("object-contain", collapsed ? "h-6 w-6" : "h-7 w-auto")}
              />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-wider text-white truncate">MOVISH BMS</div>
                <div className="text-[10px] text-blue-200/80 truncate">Gujarat Operations</div>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-blue-100"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {renderNavLinks(false)}

        <div className="p-3 border-t border-white/10 text-xs">
          {!collapsed ? (
            <div className="bg-white/10 rounded-lg p-2.5">
              <div className="font-semibold text-white truncate">{user.name}</div>
              <div className="text-[11px] text-blue-200 truncate">{user.roleName}</div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-full bg-[#0B5CA8] flex items-center justify-center font-bold">
              {user.name.charAt(0)}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-[#1B3156] text-white flex flex-col h-full z-10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="bg-white rounded-lg px-2.5 py-1">
                <img src="/logo.png" alt="Movish Group" className="h-7 w-auto" />
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavLinks(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#111a2e]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Global Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer, mobile, lead ID, GJ reg, model, campaign..."
                className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B5CA8]"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setSearchOpen(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {searchOpen && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-[#111a2e] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {searchResults.map((res) => (
                    <button
                      key={`${res.type}-${res.id}`}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                        router.push(res.href);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/70 dark:hover:bg-slate-800/70 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {res.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {res.subtitle}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                        {res.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Role Switcher */}
            {canSwitchRoles && (
              <div className="hidden md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
                <Shield className="w-3.5 h-3.5 text-[#0B5CA8] dark:text-blue-400" />
                <select
                  value={user.roleCode}
                  onChange={(e) => switchRole(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  aria-label="Switch user role"
                >
                  {ROLE_DEFINITIONS.map((r) => (
                    <option key={r.code} value={r.code} className="bg-white dark:bg-slate-900">
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Notifications */}
            <Link
              href="/notifications"
              className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D62828] text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Sign Out */}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:text-[#D62828] hover:border-red-200 dark:hover:bg-red-950/50 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
