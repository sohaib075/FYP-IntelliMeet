import { useState, useEffect, useRef } from "react"
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom"
import { LayoutDashboard, Video, ClipboardList, Settings, User as UserIcon, LogOut, Bell } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { PageTransition } from "@/components/layout/PageTransition"
import { AnimatePresence, motion } from "framer-motion"
import { ToastContainer } from "@/components/ui/ToastContainer"
import { Logo } from "@/components/common/Logo"

export function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  
  const [showBellDropdown, setShowBellDropdown] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 1, text: "CPEC Quarterly Review starts in 15 mins", time: "15m ago", read: false },
    { id: 2, text: "Welcome to IntelliMeet! Complete your profile settings", time: "1h ago", read: false },
    { id: 3, text: "Meeting summary from yesterday is ready to view", time: "1d ago", read: true },
  ])

  const bellRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setShowBellDropdown(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const hasUnread = notifications.some(n => !n.read)

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }
  
  const handleLogout = () => {
    logout()
    navigate('/')
  }
  
  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "New Meeting", path: "/meeting/create", icon: Video },
    { name: "My Meetings", path: "/dashboard/meetings", icon: ClipboardList },
    { name: "Settings", path: "/settings", icon: Settings },
    { name: "Profile", path: "/profile", icon: UserIcon },
  ]
  
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC] font-body text-[#0F172A]">
      
      {/* Sidebar */}
      <aside className="w-[260px] flex-shrink-0 flex flex-col border-r bg-white border-[#E2E8F0]">
        
        {/* Logo Area */}
        <div className="p-6 pb-4">
          <Link to="/dashboard" className="flex items-center mb-6">
            <Logo size={32} className="text-black dark:text-white" />
          </Link>
          
          {/* User Profile Mini Section */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium bg-[#EFF6FF] text-[#3B82F6]">
              {user?.name?.substring(0, 2).toUpperCase() || '??'}
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-medium text-[#0F172A]">
                {user?.name || 'User'}
              </span>
              <span className="text-[12px] text-[#3B82F6] bg-[#EFF6FF] px-2 py-0.5 rounded-full self-start font-medium mt-0.5">
                {user ? 'Member' : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="h-[1px] mx-6 mb-4 bg-[#E2E8F0]" />

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 h-[40px] rounded-lg text-[14px] font-medium transition-colors ${
                  isActive 
                    ? 'bg-[#EFF6FF] text-[#3B82F6]'
                    : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Bottom Sign Out */}
        <div className="p-4 mt-auto">
          <button onClick={handleLogout} className="flex items-center gap-2 text-[13px] font-medium w-full px-3 py-2 rounded-lg transition-colors text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Page Header */}
        <header className="h-[64px] bg-white border-b border-[#E2E8F0] flex items-center justify-between px-8 shrink-0">
          <h1 className="text-[20px] font-semibold text-[#0F172A] font-display">
            Dashboard
          </h1>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 relative">
              
              {/* Notification Dropdown */}
              <div className="relative" ref={bellRef}>
                <button 
                  onClick={() => {
                    setShowBellDropdown(!showBellDropdown)
                    setShowProfileDropdown(false)
                  }}
                  className="relative p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-full transition-colors focus:outline-none"
                >
                  <Bell className="h-5 w-5" />
                  {hasUnread && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-[#DC2626] rounded-full border-2 border-white animate-pulse" />
                  )}
                </button>

                <AnimatePresence>
                  {showBellDropdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-80 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 overflow-hidden py-1"
                    >
                      <div className="px-4 py-2 border-b border-[#F1F5F9] flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-[#0F172A]">Notifications</span>
                        {hasUnread && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-[12px] text-[#3B82F6] hover:underline font-medium"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-[#F1F5F9]">
                        {notifications.map(n => (
                          <div key={n.id} className={`px-4 py-2.5 hover:bg-[#F8FAFC] transition-colors ${!n.read ? 'bg-[#EFF6FF]/30' : ''}`}>
                            <p className="text-[13px] text-[#334155] leading-normal">{n.text}</p>
                            <span className="text-[11px] text-[#94A3B8] mt-1 block">{n.time}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button 
                  onClick={() => {
                    setShowProfileDropdown(!showProfileDropdown)
                    setShowBellDropdown(false)
                  }}
                  className="h-8 w-8 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center text-xs font-bold uppercase border-2 border-transparent hover:border-[#3B82F6]/30 transition-all cursor-pointer select-none focus:outline-none"
                >
                  {user?.name?.substring(0, 2) || '??'}
                </button>

                <AnimatePresence>
                  {showProfileDropdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 overflow-hidden py-1"
                    >
                      <div className="px-4 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC]/50">
                        <p className="text-[13px] font-semibold text-[#0F172A] truncate">{user?.name || 'User'}</p>
                        <p className="text-[11px] text-[#64748B] truncate mt-0.5">{user?.email || ''}</p>
                      </div>
                      <div className="py-1">
                        <Link 
                          to="/profile" 
                          onClick={() => setShowProfileDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2 text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                        >
                          <UserIcon className="h-4 w-4 text-[#64748B]" />
                          My Profile
                        </Link>
                        <Link 
                          to="/settings" 
                          onClick={() => setShowProfileDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2 text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                        >
                          <Settings className="h-4 w-4 text-[#64748B]" />
                          Settings
                        </Link>
                      </div>
                      <div className="border-t border-[#F1F5F9] py-1">
                        <button 
                          onClick={() => {
                            setShowProfileDropdown(false)
                            handleLogout()
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors w-full text-left"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </div>
        </header>

        {/* Page Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>

      </div>
      <ToastContainer />
    </div>
  )
}
