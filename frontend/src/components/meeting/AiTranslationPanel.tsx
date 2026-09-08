import { useEffect, useRef } from "react"
import { Languages, Volume2, VolumeX, AlertTriangle, Loader2 } from "lucide-react"
import { LANGUAGES, getLanguage } from "@/lib/languages"
import type { TranscriptLine } from "@/hooks/useAiTranslation"

/**
 * The "AI Translation" sidebar tab.
 *
 * Presentation only — every decision lives in useAiTranslation. Styling reuses
 * the meeting room's existing CSS variables and control sizes so this reads as
 * part of the room rather than a bolted-on panel.
 */

interface Props {
  enabled: boolean
  voiceEnabled: boolean
  sourceLang: string
  targetLang: string
  interim: string
  lines: TranscriptLine[]
  error: string | null
  isSpeaking: boolean
  available: boolean
  unavailableReason: string | null
  ready: boolean
  onToggle: () => void
  onVoiceToggle: (on: boolean) => void
  onSourceChange: (code: string) => void
  onTargetChange: (code: string) => void
  onClearError: () => void
}

const selectClass =
  "w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-light)] " +
  "px-2.5 py-2 text-[13px] text-[var(--color-text-primary)] outline-none " +
  "focus:border-[var(--color-brand-blue)] disabled:opacity-50"

export function AiTranslationPanel({
  enabled, voiceEnabled, sourceLang, targetLang, interim, lines, error,
  isSpeaking, available, unavailableReason, ready,
  onToggle, onVoiceToggle, onSourceChange, onTargetChange, onClearError,
}: Props) {
  const endRef = useRef<HTMLDivElement | null>(null)

  // Keep the newest line in view, matching the chat panel's behaviour.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [lines.length, interim])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Controls ── */}
      <div className="space-y-3 border-b border-[var(--color-border-default)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Languages className="h-4 w-4 shrink-0 text-[var(--color-brand-blue)]" />
            <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
              AI Translation
            </span>
          </div>
          <button
            onClick={onToggle}
            disabled={!available}
            role="switch"
            aria-checked={enabled}
            aria-label="AI translation"
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              enabled ? "bg-[var(--color-brand-blue)]" : "bg-[var(--color-surface-light)]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                enabled ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {!ready ? (
          <p className="text-[12px] text-[var(--color-text-secondary)]">Checking availability…</p>
        ) : unavailableReason ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <p className="text-[12px] leading-relaxed text-amber-200">{unavailableReason}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
              I speak
            </span>
            <select
              value={sourceLang}
              onChange={(e) => onSourceChange(e.target.value)}
              disabled={!available}
              className={selectClass}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
              Translate to
            </span>
            <select
              value={targetLang}
              onChange={(e) => onTargetChange(e.target.value)}
              disabled={!available}
              className={selectClass}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          onClick={() => onVoiceToggle(!voiceEnabled)}
          disabled={!available}
          aria-pressed={voiceEnabled}
          className="flex w-full items-center justify-between rounded-lg bg-[var(--color-surface-light)] px-2.5 py-2 text-[13px] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-card)] disabled:opacity-40"
        >
          <span className="flex items-center gap-2">
            {voiceEnabled ? (
              <Volume2 className={`h-4 w-4 ${isSpeaking ? "text-[var(--color-brand-blue)]" : ""}`} />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            Voice translation
          </span>
          <span className={voiceEnabled ? "text-[var(--color-brand-blue)]" : "text-[var(--color-text-secondary)]"}>
            {voiceEnabled ? "ON" : "OFF"}
          </span>
        </button>

        {error ? (
          <button
            onClick={onClearError}
            className="flex w-full items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-left"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
            <span className="text-[12px] leading-relaxed text-red-200">{error} (tap to dismiss)</span>
          </button>
        ) : null}
      </div>

      {/* ── Transcript ── */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!enabled ? (
          <p className="mt-8 text-center text-[13px] text-[var(--color-text-secondary)]">
            Turn on AI translation to see live transcripts and hear translated speech.
          </p>
        ) : lines.length === 0 && !interim ? (
          <p className="mt-8 text-center text-[13px] text-[var(--color-text-secondary)]">
            Listening… start speaking and your words will appear here.
          </p>
        ) : (
          lines.map((line) => {
            const source = getLanguage(line.sourceLang)
            return (
              <div
                key={line.id}
                className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-light)] p-2.5"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-[var(--color-text-primary)]">
                    {line.speaker}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--color-text-secondary)]">
                    {source.label}
                  </span>
                </div>

                <p
                  dir={source.rtl ? "rtl" : "ltr"}
                  className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]"
                >
                  {line.original}
                </p>

                {line.status === "pending" ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
                    <Loader2 className="h-3 w-3 animate-spin" /> Translating…
                  </p>
                ) : line.status === "failed" ? (
                  <p className="mt-1.5 text-[12px] text-amber-300">
                    Translation temporarily unavailable.
                  </p>
                ) : line.translated ? (
                  <TranslatedText text={line.translated} langCode={targetLangOf(line)} />
                ) : null}
              </div>
            )
          })
        )}

        {interim ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border-default)] p-2.5">
            <p className="text-[13px] italic leading-relaxed text-[var(--color-text-secondary)]">
              {interim}…
            </p>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>
    </div>
  )
}

/**
 * The translated line is rendered in the LISTENER's language, so its direction
 * comes from that language, not the speaker's.
 */
function TranslatedText({ text, langCode }: { text: string; langCode: string }) {
  const lang = getLanguage(langCode)
  return (
    <p
      dir={lang.rtl ? "rtl" : "ltr"}
      lang={lang.speech}
      className="mt-1.5 text-[14px] font-medium leading-relaxed text-[var(--color-text-primary)]"
    >
      {text}
    </p>
  )
}

/** Translated lines are always in the local user's chosen target language. */
function targetLangOf(line: TranscriptLine): string {
  return line.targetLang
}
