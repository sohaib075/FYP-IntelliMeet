import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, MapPin, Phone, ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"

/** Where the contact form's message is addressed. */
const SUPPORT_EMAIL = "support@intellimeet.app"

export function ContactPage() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = `IntelliMeet enquiry from ${name || "a visitor"}`
    const body = `${message}\n\n—\nFrom: ${name}\nReply to: ${email}`
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="flex flex-col flex-1 py-12 px-6 max-w-4xl mx-auto w-full">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white transition-colors mb-8 self-start font-medium"
      >
        <ArrowLeft className="h-4 w-4" /> Go Back
      </button>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl md:text-5xl font-display font-bold text-[#0F172A] dark:text-white mb-6">Contact Us</h1>
        <p className="text-lg text-[#64748B] dark:text-[#94A3B8] mb-12 max-w-2xl">
          Have questions about IntelliMeet? We're here to help. Reach out to our team and we'll get back to you as soon as possible.
        </p>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="flex flex-col gap-8">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center shrink-0">
                <Mail className="h-6 w-6 text-[#3B82F6]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#0F172A] dark:text-white mb-1">Email</h3>
                <p className="text-[#64748B] dark:text-[#94A3B8]">support@intellimeet.app</p>
                <p className="text-[#64748B] dark:text-[#94A3B8]">sales@intellimeet.app</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#06B6D4]/10 flex items-center justify-center shrink-0">
                <MapPin className="h-6 w-6 text-[#06B6D4]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#0F172A] dark:text-white mb-1">Office</h3>
                <p className="text-[#64748B] dark:text-[#94A3B8]">FAST NUCES</p>
                <p className="text-[#64748B] dark:text-[#94A3B8]">Islamabad, Pakistan</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#10B981]/10 flex items-center justify-center shrink-0">
                <Phone className="h-6 w-6 text-[#10B981]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#0F172A] dark:text-white mb-1">Phone</h3>
                <p className="text-[#64748B] dark:text-[#94A3B8]">+92 300 1234567</p>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">Mon-Fri from 9am to 5pm PKT</p>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white dark:bg-[#161D35] p-6 md:p-8 rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F] shadow-sm">
            <h3 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-6">Send a message</h3>
            {/* There is no contact-message backend, and a form whose submit
                silently discards the message is worse than no form. This opens
                the visitor's own mail client with the message prefilled, which
                actually delivers it. */}
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-1">Name</label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0A0E1A] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg px-4 py-2.5 text-[#0F172A] dark:text-white focus:outline-none focus:border-[#3B82F6]"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-1">Email</label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0A0E1A] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg px-4 py-2.5 text-[#0F172A] dark:text-white focus:outline-none focus:border-[#3B82F6]"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-1">Message</label>
                <textarea
                  id="contact-message"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0A0E1A] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg px-4 py-2.5 text-[#0F172A] dark:text-white focus:outline-none focus:border-[#3B82F6]"
                  placeholder="How can we help you?"
                ></textarea>
              </div>
              <button type="submit" className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium py-3 rounded-lg mt-2 transition-colors">
                Send Message
              </button>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] text-center">
                This opens your email app with the message ready to send.
              </p>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
