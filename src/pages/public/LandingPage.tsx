import { Link } from "react-router-dom"
import { Globe2, Mic, Volume2, Video, MessageSquare, Monitor, Users, FileText, Lock, Zap } from "lucide-react"
import { motion } from "framer-motion"

export function LandingPage() {
  const features = [
    { icon: Globe2, title: "Real-Time Translation", desc: "Bidirectional speech translation between Urdu, Chinese, and English in under 3 seconds." },
    { icon: Mic, title: "Speech Recognition", desc: "AI captures and transcribes speech accurately across accents using Whisper." },
    { icon: Volume2, title: "Natural Voice Output", desc: "Hear translated audio in a natural synthesized voice, not robotic text-to-speech." },
    { icon: Video, title: "HD Video Conferencing", desc: "WebRTC-powered peer-to-peer video, no plugins required." },
    { icon: MessageSquare, title: "In-Meeting Chat", desc: "Real-time text messaging alongside translated audio streams." },
    { icon: Monitor, title: "Screen Sharing", desc: "Share your screen or any application window with all participants." },
    { icon: Users, title: "Host Controls", desc: "Mute or remove participants. Full meeting lifecycle management." },
    { icon: FileText, title: "Meeting Summaries", desc: "AI-generated summaries and transcriptions after every meeting." },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] dark:bg-[#0A0E1A] font-body selection:bg-[#3B82F6]/20 selection:text-[#3B82F6]">
      
      {/* Header / Navbar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#F8FAFC]/80 dark:bg-[#0A0E1A]/80 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[#1E3A5F] z-50 px-6 md:px-12 flex items-center justify-between">
        <Link to="/" className="text-[18px] font-bold font-display tracking-tight text-[#0F172A] dark:text-white flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3B82F6] text-white font-bold text-[15px]">
            IM
          </div>
          IntelliMeet
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-[14px] font-medium text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white transition-colors">
            Log In
          </Link>
          <Link to="/register" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[13px] font-medium px-4 h-9 flex items-center justify-center rounded-lg transition-colors">
            Register
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 flex flex-col items-center text-center relative overflow-hidden">
        
        {/* Animated Background Particles */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0,transparent_50%)] dark:bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1)_0,transparent_50%)]" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-[800px] w-full flex flex-col items-center relative z-10"
        >
          
          {/* Eyebrow */}
          <div className="mb-8 flex items-center gap-2 bg-[#3B82F6]/10 text-[#3B82F6] px-3 py-1.5 rounded-full border border-[#3B82F6]/20">
            <Globe2 className="h-3.5 w-3.5" />
            <span className="text-[13px] font-medium">AI-Powered Translation</span>
          </div>

          {/* Headline */}
          <h1 className="text-[36px] md:text-[56px] font-bold text-[#0F172A] dark:text-white font-display tracking-tight leading-[1.1] mb-6">
            Break Language Barriers in Real-Time Meetings
          </h1>

          {/* Subheadline */}
          <p className="text-[17px] md:text-[20px] text-[#64748B] dark:text-[#94A3B8] max-w-[600px] leading-[1.6] mb-10">
            Speak in your native language and hear instant AI translations. IntelliMeet connects global teams seamlessly.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Link to="/register" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[16px] font-medium px-8 h-12 flex items-center justify-center rounded-lg transition-all hover:scale-105 shadow-md hover:shadow-lg">
              Start Free Meeting
            </Link>
            <a href="#how-it-works" className="bg-white dark:bg-[#161D35] hover:bg-gray-50 dark:hover:bg-[#1E2847] border border-[#E2E8F0] dark:border-[#1E3A5F] text-[#0F172A] dark:text-white text-[16px] font-medium px-8 h-12 flex items-center justify-center rounded-lg transition-all shadow-sm">
              View Demo
            </a>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-[12px] text-[#94A3B8]">
            <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Setup in 2 minutes</span>
            <span className="flex items-center gap-1.5"><Globe2 className="h-3 w-3" /> 3 languages supported</span>
          </div>
        </motion.div>

        {/* Hero Visual Mockup */}
        <div className="mt-16 w-full max-w-[960px] border border-[#E2E8F0] rounded-[16px] shadow-xl overflow-hidden bg-[#0D1117] flex flex-col relative mx-4">
          
          {/* Top Bar Mock */}
          <div className="h-12 border-b border-[#21262D] flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-white text-[12px] font-medium">IntelliMeet</span>
              <div className="h-3 w-[1px] bg-[#21262D]" />
              <span className="text-[#94A3B8] text-[12px]">Product Sync</span>
            </div>
          </div>

          {/* Video Grid Mock */}
          <div className="p-4 grid grid-cols-3 gap-4 h-[320px]">
            {[
              { init: "MU", bg: "bg-[#2563EB]", name: "Muhammad Usman", flag: "🇵🇰 Urdu" },
              { init: "IZ", bg: "bg-[#16A34A]", name: "Ibrahim Zahid", flag: "🇨🇳 Chinese" },
              { init: "SA", bg: "bg-[#7C3AED]", name: "Sarah Ahmed", flag: "🇬🇧 English" }
            ].map((p, i) => (
              <div key={i} className="bg-[#161B27] rounded-xl border border-[#21262D] flex items-center justify-center relative overflow-hidden">
                <div className={`h-16 w-16 rounded-full ${p.bg} flex items-center justify-center text-white text-xl font-medium`}>
                  {p.init}
                </div>
                <div className="absolute bottom-3 left-3 bg-[#0D1117]/80 backdrop-blur-sm px-2 py-1 rounded text-[11px] text-white font-medium">
                  {p.name}
                </div>
                <div className="absolute top-3 right-3 bg-[#0D1117] px-2 py-0.5 rounded text-[10px] text-white border border-[#21262D]">
                  {p.flag}
                </div>
              </div>
            ))}
          </div>

          {/* Floating Translation Badge */}
          <div className="absolute top-[64px] left-1/2 -translate-x-1/2 bg-[#161B27] border border-[#21262D] rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-2xl z-10">
            <span className="text-white text-[12px] font-medium">🇵🇰 Urdu → 🇨🇳 Chinese</span>
            <div className="h-1.5 w-1.5 rounded-full bg-[#0891B2] animate-pulse" />
          </div>

          {/* Bottom Control Bar Mock */}
          <div className="h-16 border-t border-[#21262D] flex items-center justify-center gap-3">
            {['Mic', 'Video', 'Chat', 'Users'].map((icon, i) => (
              <div key={i} className="h-10 w-10 rounded-lg bg-[#21262D] flex items-center justify-center text-white/70">
                <div className="h-4 w-4 bg-white/70 rounded-sm" style={{ clipPath: 'circle(50%)'}} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 1 - Features Grid */}
      <section id="features" className="py-24 px-4 bg-white dark:bg-[#0F1629]">
        <div className="max-w-[1000px] mx-auto">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 flex flex-col items-center"
          >
            <span className="text-[#3B82F6] text-[12px] font-semibold tracking-[2px] uppercase mb-3">Features</span>
            <h2 className="text-[28px] md:text-[36px] font-semibold text-[#0F172A] dark:text-white font-display mb-4">Everything for Multilingual Collaboration</h2>
            <p className="text-[#64748B] dark:text-[#94A3B8] text-[16px]">One platform that handles translation, conferencing, and collaboration.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-[#161D35] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-[16px] p-6 hover:border-[#3B82F6] dark:hover:border-[#3B82F6] hover:shadow-lg transition-all group"
              >
                <div className="h-10 w-10 rounded-[10px] bg-[#3B82F6]/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-5 w-5 text-[#3B82F6] dark:text-[#06B6D4]" />
                </div>
                <h3 className="text-[16px] font-semibold text-[#0F172A] dark:text-white mb-2">{feature.title}</h3>
                <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] leading-[1.6]">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2 - How It Works */}
      <section id="how-it-works" className="py-24 px-4 bg-[#F8FAFC] dark:bg-[#0A0E1A]">
        <div className="max-w-[1000px] mx-auto">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 flex flex-col items-center"
          >
            <span className="text-[#3B82F6] text-[12px] font-semibold tracking-[2px] uppercase mb-3">How It Works</span>
            <h2 className="text-[28px] md:text-[36px] font-semibold text-[#0F172A] dark:text-white font-display">From Prompt to Translation in Seconds</h2>
          </motion.div>

          <div className="relative flex flex-col md:flex-row justify-between gap-8 md:gap-4">
            
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-[20px] left-[15%] right-[15%] h-[2px] border-t-2 border-dashed border-[#E2E8F0] dark:border-[#1E3A5F] z-0" />

            {[
              { num: "1", title: "Set Your Language", desc: "Choose what you speak and what you want to hear. Set once, applied to every meeting." },
              { num: "2", title: "Speak Naturally", desc: "Talk as you normally would. AI captures your audio and processes it in real time." },
              { num: "3", title: "Everyone Understands", desc: "Each participant hears your speech translated to their chosen language." }
            ].map((step, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="flex-1 flex flex-col items-center text-center relative z-10 group"
              >
                <div className="h-10 w-10 rounded-full bg-[#3B82F6] text-white flex items-center justify-center text-[18px] font-bold mb-6 shadow-sm ring-8 ring-[#F8FAFC] dark:ring-[#0A0E1A] group-hover:scale-110 transition-transform">
                  {step.num}
                </div>
                <h3 className="text-[16px] font-semibold text-[#0F172A] dark:text-white mb-3">{step.title}</h3>
                <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] max-w-[260px] leading-[1.6]">{step.desc}</p>
              </motion.div>
            ))}
            
          </div>
        </div>
      </section>

    </div>
  )
}
