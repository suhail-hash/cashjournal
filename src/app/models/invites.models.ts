export type InviteStatus = 'pending' | 'accepted' | 'declined';

export type InviteResult =
  | 'sent'
  | 'not-found'
  | 'self'
  | 'already-has-access';

export interface Invite {
  id?: string;
  journalId: string;
  journalDesc: string;
  ownerUid: string;
  ownerName: string;
  inviteeUid: string;
  inviteeEmail: string;
  status: InviteStatus;
  createdAt?: any;
}
