'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FileText, 
  Users, 
  Package, 
  Home, 
  Search, 
  Bot,
  MoreVertical,
  LogOut,
  BadgeCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LogoutModal } from './LogoutModal';
import { useAuth } from './AuthProvider';
import { logout } from '../lib/auth-api';

const routeByItem: Record<string, string> = {
  home: '/home',
  'purchase-invoice': '/purchase-invoice',
  'creditor-manage': '/creditor-manage',
  'stock-manage': '/stock-manage',
  profile: '/profile',
};

const itemByRoute = Object.fromEntries(
  Object.entries(routeByItem).map(([item, route]) => [route, item])
) as Record<string, string>;

function getItemFromPath(pathname: string) {
  return itemByRoute[pathname] ?? 'home';
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname() ?? '/home';
  const { profile, clearAuthState } = useAuth();
  const activeItem = getItemFromPath(pathname);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = React.useState(false);

  const displayName = profile?.username ?? 'Workspace User';
  const displayEmail = profile?.email ?? 'No email';

  const handleLogout = async () => {
    setIsLogoutDialogOpen(false);
    try {
      await logout();
    } catch {
      // The UI should still clear local state even if the backend session is already gone.
    }
    clearAuthState();
    router.push('/login');
  };
  const menuGroups = [
    {
      label: null,
      items: [
        { id: 'home', label: 'Home', icon: Home },
      ]
    },
    {
      label: 'Procurement',
      items: [
        { id: 'purchase-invoice', label: 'Purchase Invoice', icon: FileText },
        { id: 'creditor-manage', label: 'Creditor Manage', icon: Users },
      ]
    },
    {
      label: 'Inventory',
      items: [
        { id: 'stock-manage', label: 'Stock Manage', icon: Package },
      ]
    }
  ];

  return (
    <div className="flex flex-col h-full w-[260px] bg-white border-r border-zinc-200 text-zinc-600 font-sans">
      <div className="p-3">
        <div className="flex items-center gap-3 px-2 py-2 text-left">
          <div className="flex h-11 w-11 items-center justify-center shrink-0 text-zinc-950">
            <Bot size={30} strokeWidth={2.15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-[0.08em] text-zinc-900 truncate">365BIZ AI</div>
          </div>
        </div>
      </div>

      <div className="px-3 mb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/10 focus:border-zinc-400 transition-all placeholder:text-zinc-400"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-zinc-400 font-medium border border-zinc-200 rounded px-1 bg-white">
            <span>?</span><span>K</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        {menuGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.label && (
              <div className="px-2 mb-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeItem === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(routeByItem[item.id] ?? '/home')}
                    className={`relative w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors duration-200 group ${
                      isActive 
                        ? 'text-zinc-900' 
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-nav-bg"
                        className="absolute inset-0 bg-zinc-100 rounded-md"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    
                    <span className="relative z-10 flex items-center gap-2.5 w-full">
                      <Icon 
                        size={18} 
                        strokeWidth={2}
                        className={`shrink-0 transition-colors ${
                          isActive ? 'text-zinc-900' : 'text-zinc-400 group-hover:text-zinc-600'
                        }`} 
                      />
                      <span>{item.label}</span>
                    </span>
                    
                    {isActive && (
                      <motion.div 
                        layoutId="active-nav-indicator"
                        className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-blue-600"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-zinc-100 relative">
        <AnimatePresence>
          {isProfileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute bottom-2 left-[calc(100%-4px)] w-60 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-50 origin-left"
            >
              <div className="p-2 border-b border-zinc-100">
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <img 
                    src="https://picsum.photos/seed/user/100/100" 
                    alt="User" 
                    className="w-8 h-8 rounded-lg bg-zinc-200 object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 truncate">{displayName}</div>
                    <div className="text-xs text-zinc-500 truncate">{displayEmail}</div>
                  </div>
                </div>
              </div>
              
              <div className="p-1 border-b border-zinc-100">
                <button 
                  onClick={() => {
                    router.push(routeByItem.profile);
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
                >
                  <BadgeCheck size={14} />
                  <span>Account</span>
                </button>
              </div>

              <div className="p-1">
                <button 
                  onClick={() => {
                    setIsLogoutDialogOpen(true);
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <LogOut size={14} />
                  <span>Log out</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <LogoutModal 
          isOpen={isLogoutDialogOpen} 
          onClose={() => setIsLogoutDialogOpen(false)} 
          onConfirm={handleLogout}
        />

        <button 
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left group ${isProfileMenuOpen ? 'bg-zinc-100' : 'hover:bg-zinc-50'}`}
        >
          <div className="relative">
            <img 
              src="https://picsum.photos/seed/user/100/100" 
              alt="User" 
              className="w-8 h-8 rounded-lg bg-zinc-200 object-cover ring-1 ring-zinc-200"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-zinc-900 truncate">{displayName}</div>
            <div className="text-xs text-zinc-500 truncate">{displayEmail}</div>
          </div>
          <MoreVertical size={16} className="text-zinc-400 group-hover:text-zinc-600" />
        </button>
      </div>
    </div>
  );
}
