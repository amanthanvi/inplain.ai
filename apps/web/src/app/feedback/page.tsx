
// Force dynamic rendering to prevent static export
export const dynamic = 'force-dynamic'
import FeedbackDashboard from '@/components/feedback/FeedbackDashboard';

export const metadata = {
  title: 'Feedback Dashboard | InPlain.AI',
  description: 'View and manage user feedback',
};

export default function FeedbackPage() {
  return (
    <div className="container mx-auto py-8">
      <FeedbackDashboard />
    </div>
  );
}