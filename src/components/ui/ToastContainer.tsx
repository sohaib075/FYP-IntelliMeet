import { useToastStore } from "@/store/useToastStore"
import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, CheckCircle2, Info, XCircle, X } from "lucide-react"

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg bg-[#161D35] ${
              toast.variant === "success"
                ? "border-l-4 border-l-green-500 border-t-[#1E3A5F] border-r-[#1E3A5F] border-b-[#1E3A5F]"
                : toast.variant === "error"
                ? "border-l-4 border-l-red-500 border-t-[#1E3A5F] border-r-[#1E3A5F] border-b-[#1E3A5F]"
                : toast.variant === "warning"
                ? "border-l-4 border-l-yellow-500 border-t-[#1E3A5F] border-r-[#1E3A5F] border-b-[#1E3A5F]"
                : "border-l-4 border-l-blue-500 border-t-[#1E3A5F] border-r-[#1E3A5F] border-b-[#1E3A5F]"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.variant === "success" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {toast.variant === "error" && <XCircle className="h-5 w-5 text-red-500" />}
              {toast.variant === "warning" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
              {toast.variant === "info" && <Info className="h-5 w-5 text-blue-500" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
