import { Outlet, Link, useLocation } from "react-router-dom"
import { ToastContainer } from "@/components/ui/ToastContainer"
import { Button } from "@/components/ui/Button"
import { PageTransition } from "@/components/layout/PageTransition"
import { AnimatePresence } from "framer-motion"

export function PublicLayout() {
  const location = useLocation()
  
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0A0E1A] text-[#0F172A] dark:text-[#F1F5F9] flex flex-col font-body">
      <ToastContainer />
      
      {/* Header Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-white/80 dark:bg-[#0A0E1A]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6] text-white font-bold text-xl">
              IM
            </div>
            <span className="text-xl font-bold font-display tracking-tight text-[#0F172A] dark:text-white">IntelliMeet</span>
          </Link>
          
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild className="hidden sm:flex">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Sign up free</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col pt-16">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
      <footer className="border-t border-[#E2E8F0] dark:border-[#1E3A5F] bg-white dark:bg-[#0A0E1A] py-8 text-center text-sm text-[#64748B] dark:text-gray-400">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold font-display text-[#0F172A] dark:text-white">IntelliMeet</span>
            <span className="hidden md:inline-block">|</span>
            <span>Break Language Barriers. Connect Intelligently.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[#0F172A] dark:hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#0F172A] dark:hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#0F172A] dark:hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
