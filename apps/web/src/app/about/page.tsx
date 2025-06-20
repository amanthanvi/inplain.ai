import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = {
  title: 'About PolicyDiff',
  description: 'Learn about PolicyDiff and how it helps track privacy policy changes',
}

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">About PolicyDiff</h1>
        <p className="text-xl text-muted-foreground">
          Transparency in privacy policy changes
        </p>
      </div>

      <Card>
        <CardContent className="prose prose-lg max-w-none pt-6">
          <h2>What is PolicyDiff?</h2>
          <p>
            PolicyDiff is an open-source tool that automatically monitors and tracks changes 
            to privacy policies and terms of service across major platforms. We believe in 
            transparency and helping users understand how their data is being used.
          </p>

          <h2>How it works</h2>
          <ol>
            <li>
              <strong>Daily Monitoring:</strong> We check privacy policies of major platforms 
              once per day for any changes.
            </li>
            <li>
              <strong>Change Detection:</strong> When changes are detected, we create a detailed 
              diff showing exactly what was added, removed, or modified.
            </li>
            <li>
              <strong>AI Analysis:</strong> Using advanced language models, we provide clear 
              summaries of what the changes mean for users.
            </li>
            <li>
              <strong>Historical Record:</strong> All changes are archived, creating a permanent 
              record of how policies evolve over time.
            </li>
          </ol>

          <h2>Why it matters</h2>
          <p>
            Privacy policies are legal documents that define how companies collect, use, and 
            share your personal data. These documents are often long, complex, and change 
            frequently without notice. PolicyDiff makes it easy to:
          </p>
          <ul>
            <li>Stay informed about privacy policy changes</li>
            <li>Understand the implications of those changes</li>
            <li>Make informed decisions about the services you use</li>
            <li>Hold companies accountable for their data practices</li>
          </ul>

          <h2>Open Source</h2>
          <p>
            PolicyDiff is fully open source. You can contribute, report issues, or run your 
            own instance by visiting our{' '}
            <a 
              href="https://github.com/policydiff/policydiff" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub repository
            </a>.
          </p>

          <h2>Privacy First</h2>
          <p>
            We practice what we preach. PolicyDiff:
          </p>
          <ul>
            <li>Does not collect personal data</li>
            <li>Does not use tracking cookies</li>
            <li>Does not require user accounts</li>
            <li>Is transparent about all operations</li>
          </ul>

          <h2>Get Started</h2>
          <p>
            <Link href="/" className="text-primary hover:underline">
              Return to the dashboard
            </Link>{' '}
            to start exploring privacy policy changes across major platforms.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}