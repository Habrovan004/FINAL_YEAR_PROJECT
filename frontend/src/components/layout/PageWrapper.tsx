import type { ReactNode } from 'react'
import BottomNav from './BottomNav'

export default function PageWrapper({ children, withNav = true }: { children: ReactNode; withNav?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col" style={{maxWidth:'480px',margin:'0 auto',background:'var(--bg-page, #faf9f7)'}}>
      <main className={`flex-1 overflow-y-auto ${withNav ? 'pb-24' : ''}`}>
        {children}
      </main>
      {withNav && <BottomNav />}
    </div>
  )
}
