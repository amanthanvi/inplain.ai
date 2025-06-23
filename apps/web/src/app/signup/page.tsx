import { SignUp } from '@clerk/nextjs'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Join PolicyDiff</h1>
          <p className="text-gray-600 mt-2">Start tracking privacy policy changes today</p>
        </div>
        <SignUp 
          appearance={{
            elements: {
              formButtonPrimary: 
                "bg-primary hover:bg-primary/90 text-sm normal-case",
              card: "shadow-lg",
              headerTitle: "hidden",
              headerSubtitle: "hidden"
            }
          }}
          redirectUrl="/onboarding"
          signInUrl="/login"
        />
      </div>
    </div>
  )
}