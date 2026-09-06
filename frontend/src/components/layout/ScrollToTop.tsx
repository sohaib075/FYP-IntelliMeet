import { useEffect } from "react"
import { useLocation } from "react-router-dom"

/**
 * Reset the scroll position on every route change.
 *
 * `window.scrollTo` does nothing in this app: index.css sets
 * `body { overflow: hidden }` and `#root { overflow: auto }`, so the element
 * that actually scrolls is #root, not the window. Scrolling the window left
 * long pages (Terms, Privacy, the landing page) opening halfway down.
 *
 * Both are reset so this keeps working if that CSS ever changes.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    const root = document.getElementById("root")
    root?.scrollTo({ top: 0, left: 0, behavior: "instant" })
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [pathname])

  return null
}
