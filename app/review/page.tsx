import { getPendingDocuments } from "@/lib/data";
import ReviewList from "@/components/ReviewList";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const pending = await getPendingDocuments();
  return (
    <div className="max-w-[760px] mx-auto px-6 py-8">
      <a href="/" className="text-muted text-sm">← Back to dashboard</a>
      <h1 className="font-serif text-3xl mt-3 mb-1">Review queue</h1>
      <p className="text-muted mb-6">
        Everything you add lands here first. I've drafted tags and reminders — approve to publish into your
        searchable manual, or reject to discard. Nothing goes live until you say so.
      </p>
      {pending.length === 0
        ? <div className="card text-muted">Nothing waiting. Add a note, link, PDF, or photo from the dashboard.</div>
        : <ReviewList items={pending} />}
    </div>
  );
}
