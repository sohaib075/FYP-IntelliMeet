import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

export function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col flex-1 py-12 px-6 max-w-4xl mx-auto w-full">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white transition-colors mb-8 self-start font-medium"
      >
        <ArrowLeft className="h-4 w-4" /> Go Back
      </button>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl md:text-5xl font-display font-bold text-[#0F172A] dark:text-white mb-8">Terms of Service</h1>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {/* A fixed date. Rendering new Date() here made the document claim it
              had been revised today, every single day it was viewed. Update this
              string whenever the terms actually change. */}
          <p className="text-lg text-[#64748B] dark:text-[#94A3B8] mb-6">Last updated: 1 September 2026</p>
          
          <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-4">By accessing or using IntelliMeet, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p>
          
          <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mt-8 mb-4">2. Use License</h2>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-4">Permission is granted to temporarily use the materials (information or software) on IntelliMeet's website for personal, non-commercial transitory viewing only.</p>
          
          <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mt-8 mb-4">3. User Conduct</h2>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-4">You agree not to use the service to host, display, upload, modify, publish, transmit, store, update or share any information that belongs to another person; is defamatory, obscene, pornographic, pedophilic, invasive of another's privacy; or violates any law for the time being in force.</p>
          
          <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mt-8 mb-4">4. Limitations</h2>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-4">In no event shall IntelliMeet or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on IntelliMeet's website.</p>
        </div>
      </motion.div>
    </div>
  )
}
