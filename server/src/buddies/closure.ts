import { z } from 'zod';
import type { BuddiesStorePort } from './contract';

export const BuddyReviewSettlementSchema = z.object({
  verdict: z.enum(['needs_work', 'pass', 'fail']),
  score: z.number().min(0).max(100).nullable().optional(),
  summary: z.string().min(1),
  evidence: z
    .array(
      z.object({
        kind: z.enum(['file', 'conversation', 'project', 'metric']),
        reference: z.string().min(1),
        observation: z.string().min(1),
      })
    )
    .min(1),
  requiredActions: z.array(z.string().min(1)).default([]),
});

export const BuddyConversationSettlementSchema = z.object({
  conversationId: z.string().min(1),
  status: z.enum(['complete', 'failed', 'cancelled']),
  outcome: z.string().min(1),
  review: BuddyReviewSettlementSchema.optional(),
});

export class BuddyClosureService {
  constructor(private readonly store: BuddiesStorePort) {}

  settleConversation(input: z.input<typeof BuddyConversationSettlementSchema>) {
    const settlement = BuddyConversationSettlementSchema.parse(input);
    const delegations = this.store
      .listDelegations({})
      .filter((item) => item.child_conversation_id === settlement.conversationId);
    const reviews = this.store
      .listReviews({})
      .filter((item) => item.conversation_id === settlement.conversationId);
    if (
      settlement.status === 'complete' &&
      reviews.some((review) => review.status === 'draft') &&
      !settlement.review
    ) {
      throw new Error('structured review result is required to settle a review conversation');
    }
    const settledDelegations = delegations.map((delegation) => {
      if (['complete', 'failed', 'cancelled'].includes(delegation.status)) return delegation;
      const status =
        settlement.status === 'complete'
          ? 'complete'
          : settlement.status === 'cancelled'
            ? 'cancelled'
            : 'failed';
      const updated = this.store.updateDelegation(delegation.id, {
        status,
        outcome: settlement.outcome,
      });
      this.store.recordAuditEvent({
        buddy: delegation.from_buddy_id,
        workspace: delegation.workspace_id,
        project: delegation.buddy_project_id ?? undefined,
        operation: 'buddy.settle_delegation_from_conversation',
        payload: {
          conversationId: settlement.conversationId,
          status,
          outcome: settlement.outcome,
        },
      });
      return updated;
    });
    const settledReviews = reviews.map((review) => {
      if (['complete', 'cancelled'].includes(review.status)) return review;
      if (settlement.status !== 'complete') {
        const updated = this.store.updateReview(review.id, { status: 'cancelled' });
        this.store.recordAuditEvent({
          buddy: review.reviewer_buddy_id,
          workspace: review.workspace_id,
          project: review.buddy_project_id ?? undefined,
          operation: 'buddy.cancel_review_from_conversation',
          payload: {
            conversationId: settlement.conversationId,
            status: settlement.status,
            outcome: settlement.outcome,
          },
        });
        return updated;
      }
      if (!settlement.review) throw new Error('structured review result is required');
      const evidence = [
        ...settlement.review.evidence,
        ...settlement.review.requiredActions.map((action) => ({
          kind: 'required_action',
          reference: review.buddy_project_id ?? review.subject_buddy_id,
          observation: action,
        })),
      ];
      const updated = this.store.updateReview(review.id, {
        status: 'complete',
        verdict: settlement.review.verdict,
        score: settlement.review.score,
        summary: settlement.review.summary,
        evidence,
      });
      this.store.recordAuditEvent({
        buddy: review.reviewer_buddy_id,
        workspace: review.workspace_id,
        project: review.buddy_project_id ?? undefined,
        operation: 'buddy.settle_review_from_conversation',
        payload: {
          conversationId: settlement.conversationId,
          verdict: settlement.review.verdict,
          score: settlement.review.score,
          summary: settlement.review.summary,
          evidence,
        },
      });
      return updated;
    });
    return {
      conversationId: settlement.conversationId,
      delegations: settledDelegations,
      reviews: settledReviews,
    };
  }
}
