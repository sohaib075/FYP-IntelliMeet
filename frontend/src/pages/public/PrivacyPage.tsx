import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

export function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col flex-1 py-8 px-4 sm:py-12 sm:px-6 max-w-4xl mx-auto w-full">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white transition-colors mb-6 sm:mb-8 self-start font-medium min-h-11 sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" /> Go Back
      </button>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl md:text-5xl font-display font-bold text-[#0F172A] dark:text-white mb-6 sm:mb-8">Privacy Policy</h1>
        <div className="prose prose-slate dark:prose-invert max-w-none break-words">
          {/* A fixed date. Rendering new Date() here made the policy claim it had
              been revised today, every single day it was viewed. Update this string
              whenever the policy actually changes. */}
          <p className="text-base sm:text-lg text-[#64748B] dark:text-[#94A3B8] mb-6">Last updated: 1 September 2026</p>
          
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white mt-6 sm:mt-8 mb-3 sm:mb-4">1. Information We Collect</h2>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-4">We collect information that you provide directly to us when you register for an account, create or join a meeting, or communicate with us. This includes your name, email address, and any profile information you choose to provide.</p>
          
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white mt-6 sm:mt-8 mb-3 sm:mb-4">2. Meeting Data and Audio/Video</h2>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-4">IntelliMeet processes audio and video streams in real-time to provide translation and transcription services. We do not permanently store your video or audio streams unless you explicitly choose to record the meeting.</p>
          
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white mt-6 sm:mt-8 mb-3 sm:mb-4">3. How We Use Your Information</h2>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-4">We use the information we collect to provide, maintain, and improve our services, to process transactions, to send you related information, and to monitor and analyze trends, usage, and activities in connection with our services.</p>
          
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white mt-6 sm:mt-8 mb-3 sm:mb-4">4. Sharing of Information</h2>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-4">We do not share your personal information with third parties except as described in this privacy policy or with your consent.</p>
        </div>
      </motion.div>
    </div>
  )
}
