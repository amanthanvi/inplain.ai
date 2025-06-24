import { SignIn } from '@clerk/nextjs'

export default function FactorTwoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Two-Factor Authentication</h1>
          <p className="text-gray-600 mt-2">Choose your verification method</p>
        </div>
        <SignIn 
          appearance={{
            elements: {
              formButtonPrimary: 
                "bg-primary hover:bg-primary/90 text-sm normal-case",
              card: "shadow-lg",
              headerTitle: "hidden",
              headerSubtitle: "hidden"
            }
          }}
          routing="path"
          path="/login"
          signUpUrl="/signup"
          fallbackRedirectUrl="/dashboard"
          forceRedirectUrl="/dashboard"
        />
      </div>
    </div>
  )
}