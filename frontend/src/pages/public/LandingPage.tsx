import { Link } from "react-router-dom"
import { Globe2, Mic, Volume2, Video, MessageSquare, Monitor, Users, FileText, Lock, Zap, ArrowRight, Shield, Sparkles, CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"
import { Logo } from "@/components/common/Logo"

export function LandingPage() {
  const features = [
    { icon: Globe2, title: "Real-Time Translation", desc: "Bidirectional speech translation between Urdu, Chinese, and English in under 3 seconds.", color: "text-[var(--color-brand-blue)]", bg: "bg-[var(--color-brand-blue)]/10" },
    { icon: Mic, title: "Speech Recognition", desc: "AI captures and transcribes speech accurately across accents using Whisper.", color: "text-[var(--color-accent-purple)]", bg: "bg-[var(--color-accent-purple)]/10" },
    { icon: Volume2, title: "Natural Voice Output", desc: "Hear translated audio in a natural synthesized voice, not robotic text-to-speech.", color: "text-[var(--color-success)]", bg: "bg-[var(--color-success)]/10" },
    { icon: Video, title: "HD Video Conferencing", desc: "WebRTC-powered peer-to-peer video, no plugins required.", color: "text-[var(--color-accent-cyan)]", bg: "bg-[var(--color-accent-cyan)]/10" },
    { icon: MessageSquare, title: "In-Meeting Chat", desc: "Real-time text messaging alongside translated audio streams.", color: "text-[var(--color-warning)]", bg: "bg-[var(--color-warning)]/10" },
    { icon: Monitor, title: "Screen Sharing", desc: "Share your screen or any application window with all participants.", color: "text-[var(--color-brand-blue)]", bg: "bg-[var(--color-brand-blue)]/10" },
    { icon: Users, title: "Host Controls", desc: "Mute or remove participants. Full meeting lifecycle management.", color: "text-[var(--color-accent-purple)]", bg: "bg-[var(--color-accent-purple)]/10" },
    { icon: FileText, title: "Meeting Summaries", desc: "AI-generated summaries and transcriptions after every meeting.", color: "text-[var(--color-success)]", bg: "bg-[var(--color-success)]/10" },
  ]

  const steps = [
    { num: "01", title: "Create or Join", desc: "Start an instant meeting or join an existing one with a secure link." },
    { num: "02", title: "Select Language", desc: "Choose your spoken language and what you want to hear." },
    { num: "03", title: "Collaborate Seamlessly", desc: "Speak naturally while everyone hears you in their preferred language." }
  ]

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  }

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  }

  const blobAnimation = {
    animate: {
      scale: [1, 1.05, 1],
      rotate: [0, 90, 0],
      transition: { duration: 20, repeat: Infinity, ease: "linear" }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-dash-bg)] dark:bg-[var(--color-bg-primary)] font-body selection:bg-[var(--color-brand-blue)]/20 selection:text-[var(--color-brand-blue)] overflow-x-hidden">
      
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 h-16 bg-[var(--color-dash-bg)]/80 dark:bg-[var(--color-bg-primary)]/80 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[var(--color-border-default)] z-50 px-6 md:px-12 flex items-center justify-between"
      >
        <Link to="/" className="flex items-center gap-2">
          <Logo size={32} className="text-[var(--color-dash-text)] dark:text-white" />
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-[14px] font-medium text-[#64748B] dark:text-[var(--color-text-secondary)] hover:text-[var(--color-dash-text)] dark:hover:text-white transition-colors">
            Log In
          </Link>
          <Link to="/register" className="bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue-hover)] text-white text-[13px] font-medium px-4 h-9 flex items-center justify-center rounded-[var(--radius-md)] transition-colors shadow-[var(--shadow-sm)]">
            Sign Up
          </Link>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 flex flex-col items-center text-center overflow-hidden min-h-[90vh] justify-center">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            variants={blobAnimation}
            animate="animate"
            className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--color-brand-blue)]/10 dark:bg-[var(--color-brand-blue)]/5 blur-[100px]"
          />
          <motion.div 
            variants={blobAnimation}
            animate="animate"
            className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] rounded-full bg-[var(--color-accent-cyan)]/10 dark:bg-[var(--color-accent-cyan)]/5 blur-[100px]"
            style={{ animationDelay: '-10s' }}
          />
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="max-w-[800px] w-full flex flex-col items-center relative z-10"
        >
          {/* Eyebrow */}
          <motion.div variants={fadeInUp} className="mb-8 flex items-center gap-2 bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] px-4 py-1.5 rounded-full border border-[var(--color-brand-blue)]/20 shadow-sm backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            <span className="text-[13px] font-bold tracking-wide uppercase">Seamless Video Meetings, Reimagined</span>
          </motion.div>

          {/* Headline */}
          <motion.h1 variants={fadeInUp} className="text-[42px] md:text-[64px] font-bold text-[var(--color-dash-text)] dark:text-white font-display tracking-tight leading-[1.1] mb-6">
            Break Language Barriers in Real-Time Meetings
          </motion.h1>

          {/* Subheadline */}
          <motion.p variants={fadeInUp} className="text-[18px] md:text-[22px] text-[#64748B] dark:text-[var(--color-text-secondary)] max-w-[640px] leading-[1.6] mb-10">
            Speak in your native language and hear instant AI translations. IntelliMeet connects global teams seamlessly with zero friction.
          </motion.p>

          {/* Buttons */}
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 mb-12 w-full sm:w-auto">
            <Link to="/register" className="group bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue-hover)] text-white text-[16px] font-medium px-8 h-14 flex items-center justify-center rounded-[var(--radius-lg)] transition-all hover:scale-105 shadow-[var(--shadow-glow)]">
              Get Started for Free
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#how-it-works" className="bg-[var(--color-dash-card)] dark:bg-[var(--color-surface-card)] hover:bg-gray-50 dark:hover:bg-[var(--color-surface-light)] border border-[#E2E8F0] dark:border-[var(--color-border-default)] text-[var(--color-dash-text)] dark:text-white text-[16px] font-medium px-8 h-14 flex items-center justify-center rounded-[var(--radius-lg)] transition-all shadow-[var(--shadow-sm)]">
              See How It Works
            </a>
          </motion.div>

          {/* Trust Badges */}
          <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-center gap-6 text-[13px] text-[#64748B] dark:text-[var(--color-text-secondary)] font-medium">
            <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-[var(--color-success)]" /> Secure & Private</span>
            <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-[var(--color-warning)]" /> Instant Setup</span>
            <span className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-[var(--color-brand-blue)]" /> Multi-Language</span>
          </motion.div>
        </motion.div>
      </section>

      {/* SECTION 1 - Features Grid */}
      <section id="features" className="py-24 px-4 bg-[var(--color-dash-card)] dark:bg-[var(--color-bg-secondary)] relative">
        <div className="max-w-[1200px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16 flex flex-col items-center"
          >
            <span className="text-[var(--color-brand-blue)] text-[13px] font-bold tracking-[2px] uppercase mb-3">Powerful Features</span>
            <h2 className="text-[32px] md:text-[42px] font-bold text-[var(--color-dash-text)] dark:text-white font-display mb-4">Everything for Multilingual Collaboration</h2>
            <p className="text-[#64748B] dark:text-[var(--color-text-secondary)] text-[18px] max-w-[600px]">One platform that handles translation, conferencing, and team collaboration natively.</p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="bg-[var(--color-dash-bg)] dark:bg-[var(--color-surface-card)] border border-[#E2E8F0] dark:border-[var(--color-border-default)] rounded-[var(--radius-lg)] p-8 hover:border-[var(--color-brand-blue)]/50 hover:shadow-[var(--shadow-lg)] transition-all group relative overflow-hidden"
              >
                {/* Subtle gradient hover background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand-blue)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                
                <div className={`h-12 w-12 rounded-[var(--radius-md)] ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 relative z-10`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-[18px] font-bold text-[var(--color-dash-text)] dark:text-white mb-3 relative z-10">{feature.title}</h3>
                <p className="text-[15px] text-[#64748B] dark:text-[var(--color-text-secondary)] leading-[1.6] relative z-10">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 - How It Works */}
      <section id="how-it-works" className="py-32 px-4 bg-[var(--color-dash-bg)] dark:bg-[var(--color-bg-primary)] overflow-hidden">
        <div className="max-w-[1000px] mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-20 flex flex-col items-center"
          >
            <span className="text-[var(--color-brand-blue)] text-[13px] font-bold tracking-[2px] uppercase mb-3">Simple Workflow</span>
            <h2 className="text-[32px] md:text-[42px] font-bold text-[var(--color-dash-text)] dark:text-white font-display">From Prompt to Translation in Seconds</h2>
          </motion.div>

          <div className="relative flex flex-col md:flex-row justify-between gap-12 md:gap-4">
            {/* Connecting Line (Desktop) animated using motion */}
            <motion.div 
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1, ease: "easeInOut", delay: 0.2 }}
              className="hidden md:block absolute top-[28px] left-[15%] right-[15%] h-[2px] border-t-2 border-dashed border-[var(--color-brand-blue)]/40 z-0 origin-left" 
            />

            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.3, duration: 0.5 }}
                className="flex-1 flex flex-col items-center text-center relative z-10 group"
              >
                <div className="h-14 w-14 rounded-full bg-[var(--color-brand-blue)] text-white flex items-center justify-center text-[20px] font-bold mb-6 shadow-[var(--shadow-md)] ring-8 ring-[var(--color-dash-bg)] dark:ring-[var(--color-bg-primary)] group-hover:scale-110 group-hover:bg-[var(--color-brand-blue-hover)] transition-all duration-300">
                  {step.num}
                </div>
                <h3 className="text-[20px] font-bold text-[var(--color-dash-text)] dark:text-white mb-3">{step.title}</h3>
                <p className="text-[15px] text-[#64748B] dark:text-[var(--color-text-secondary)] max-w-[280px] leading-[1.6]">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3 - CTA */}
      <section className="py-24 px-4 bg-[var(--color-dash-card)] dark:bg-[var(--color-bg-secondary)] relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-brand-blue)]/5 dark:bg-[var(--color-brand-blue)]/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-[800px] mx-auto text-center relative z-10 bg-[var(--color-dash-bg)] dark:bg-[var(--color-surface-card)] rounded-[var(--radius-xl)] p-10 md:p-16 border border-[#E2E8F0] dark:border-[var(--color-border-default)] shadow-[var(--shadow-xl)]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-[32px] md:text-[48px] font-bold text-[var(--color-dash-text)] dark:text-white font-display mb-6">Ready to transform your meetings?</h2>
            <p className="text-[18px] text-[#64748B] dark:text-[var(--color-text-secondary)] mb-10 max-w-[500px] mx-auto">Join thousands of professionals breaking language barriers every day.</p>
            <Link to="/register" className="inline-flex items-center gap-2 bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue-hover)] text-white text-[18px] font-semibold px-10 h-16 rounded-[var(--radius-lg)] transition-all hover:scale-105 hover:shadow-[var(--shadow-glow)]">
              Create Free Account
              <ArrowRight className="h-5 w-5" />
            </Link>
            <div className="mt-6 flex items-center justify-center gap-2 text-[13px] text-[#64748B] dark:text-[var(--color-text-secondary)] font-medium">
              <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" /> No credit card required
            </div>
          </motion.div>
        </div>
      </section>


    </div>
  )
}
