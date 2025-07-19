import { type Metadata } from 'next'
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { headers } from 'next/headers'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'EasyShare - File Sharing Made Simple',
  description: 'Share files easily and securely with EasyShare',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  const isSignInPage = pathname.includes('/sign-in')

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-200`}>
          <div className="min-h-screen">
            <SignedIn>
              <Sidebar />
            </SignedIn>
            
            {/* Main content area */}
            <SignedIn>
              <div className="lg:pl-72">
                {/* Top header for mobile/desktop */}
                {!isSignInPage && (
                  <header className="flex justify-between items-center p-4 bg-white border-b border-gray-200 lg:justify-end">
                    <div className="lg:hidden">
                      {/* Mobile header content - hamburger is in Sidebar component */}
                      <h1 className="text-lg font-semibold text-gray-900 ml-12">EasyShare</h1>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <SignedOut>
                        <SignInButton>
                          <button className="text-gray-700 hover:text-gray-900 font-medium text-sm">
                            Sign In
                          </button>
                        </SignInButton>
                      </SignedOut>
                      <SignedIn>
                        {/* UserButton is already in the sidebar, so we can hide it here on desktop */}
                        <div className="lg:hidden">
                          <UserButton />
                        </div>
                      </SignedIn>
                    </div>
                  </header>
                )}

                {/* Main content */}
                <main className="flex-1">
                  {children}
                </main>
              </div>
            </SignedIn>
            <SignedOut>
              <div className="">
                {/* Top header for mobile/desktop */}
                {!isSignInPage && (
                  <header className="flex justify-between items-center p-4 bg-white border-b border-gray-200 lg:justify-end">
                    <div className="lg:hidden">
                      {/* Mobile header content */}
                      <h1 className="text-lg font-semibold text-gray-900">EasyShare</h1>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <SignInButton>
                        <button className="text-gray-700 hover:text-gray-900 font-medium text-sm">
                          Sign In
                        </button>
                      </SignInButton>
                    </div>
                  </header>
                )}

                {/* Main content */}
                <main className="flex-1">
                  {children}
                </main>
              </div>
            </SignedOut>
          </div>
        </body>
      </html>
    </ClerkProvider>
  )
}