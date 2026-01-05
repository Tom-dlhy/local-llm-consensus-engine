import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { MessageSquare, Award } from 'lucide-react'
import { useSession } from '~/context/SessionContext'
import {
  OpinionCard,
  ReviewCard,
  SessionSummary,
  EmptyState,
} from '~/components/council'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card'

export const Route = createFileRoute('/responses')({
  component: ResponsesPage,
})

function ResponsesPage() {
  const { session } = useSession()

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          <h2 className="text-2xl font-bold">Model Responses & Rankings</h2>
          <EmptyState
            title="No Active Session"
            message="Please submit a question from the Chat page first."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold">Model Responses & Rankings</h2>
          <p className="text-muted-foreground">Session ID: {session.session_id}</p>
        </div>

        {/* Original Question */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <CardDescription>Original Question</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-lg">{session.query}</p>
          </CardContent>
        </Card>

        {/* Stage 1: Opinions */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-bold">Stage 1: First Opinions</h3>
          </div>

          {session.opinions.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground">
                No opinions available yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {session.opinions.map((opinion) => (
                <OpinionCard key={opinion.agent_id} opinion={opinion} />
              ))}
            </div>
          )}
        </section>

        {/* Stage 2: Reviews */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            <h3 className="text-xl font-bold">Stage 2: Peer Review & Rankings</h3>
          </div>

          {session.reviews.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground">
                No reviews available yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {session.reviews.map((review) => (
                <ReviewCard key={review.reviewer_id} review={review} />
              ))}
            </div>
          )}
        </section>

        {/* Summary */}
        <SessionSummary
          agentCount={session.agents.length}
          opinionsCount={session.opinions.length}
          reviewsCount={session.reviews.length}
        />
      </div>
    </div>
  )
}
