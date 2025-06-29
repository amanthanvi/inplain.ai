
// Force dynamic rendering to prevent static export
export const dynamic = 'force-dynamic'
import { Metadata } from 'next';
import PublicRoadmap from '@/components/feedback/PublicRoadmap';

export const metadata: Metadata = {
  title: 'Product Roadmap | InPlain.AI',
  description: 'See what features we are working on and vote for what matters to you',
};

export default function RoadmapPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Product Roadmap</h1>
          <p className="text-xl text-muted-foreground">
            See what we're building and help shape the future of InPlain.AI
          </p>
        </div>
        <PublicRoadmap />
      </div>
    </div>
  );
}