import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={`btn w-full ${isDark ? 'btn-primary' : ''}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <>
          <Sun size={18} />
          <span className="font-bold text-sm">Light Mode</span>
        </>
      ) : (
        <>
          <Moon size={18} />
          <span className="font-bold text-sm">Dark Mode</span>
        </>
      )}
    </button>
  )
}
