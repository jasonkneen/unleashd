declare module '@nbardy/buddies' {
  export class BuddiesStore {
    dashboard(): unknown;
    listBuddyProjects(buddyId: string): Array<{ id: string }>;
    linkConversation(input: {
      buddy: string;
      workItem?: string;
      provider: string;
      unleashdConversationId: string;
    }): unknown;
    updateWorkItemStatus(
      id: string,
      status: never,
      options: {
        blockedReason?: string;
        nextAction?: string;
      }
    ): unknown;
  }
}
