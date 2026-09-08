import { Link } from "react-router-dom"
import { Button } from "@/components/ui/Button"

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-10 sm:p-4 font-body">
      <div className="text-center w-full max-w-md">
        <h1 className="text-[96px] sm:text-[120px] font-bold text-[#0F172A] font-display leading-none mb-4 tracking-tighter">404</h1>
        <h2 className="text-xl sm:text-2xl font-semibold text-[#0F172A] mb-3 sm:mb-4">Page Not Found</h2>
        <p className="text-[15px] text-[#64748B] mb-8 leading-relaxed">
          The page you are looking for doesn't exist or has been moved. Let's get you back on track.
        </p>
        <Link to="/" className="inline-block w-full sm:w-auto">
          <Button size="lg" className="bg-[#3B82F6] text-white hover:bg-[#2563EB] w-full sm:w-auto">
            Return Home
          </Button>
        </Link>
      </div>
    </div>
  )
}
