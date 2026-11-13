import {
  BaseError,
  ContractFunctionRevertedError,
  HttpRequestError,
  TimeoutError,
  UserRejectedRequestError,
} from 'viem'

export type ErrorKind = 'rejected' | 'revert' | 'network' | 'funds' | 'unknown'

export interface DescribedError {
  kind: ErrorKind
  message: string
}

const REVERT_MESSAGES: Record<string, string> = {
  CreatorCannotJoin: 'You created this challenge, so you cannot join it.',
  AlreadyJoined: 'You already joined this challenge.',
  ChallengeFull: 'This challenge is full.',
  ChallengeNotOpen: 'This challenge is no longer open.',
  NotParticipant: 'Join the challenge before submitting work.',
  InvalidSubmissionStatus: 'Your work is already pending review or approved.',
  TooManyAttempts: 'You used all 3 submission attempts.',
  NotCreator: 'Only the challenge creator can do this.',
  ChallengeIsCancelled: 'This challenge was cancelled.',
  SubmissionNotPending: 'There is no pending submission to review.',
  HasApprovedSubmissions: 'A challenge with approved work cannot be cancelled.',
  InvalidDeadline: 'The deadline must be between 1 hour and 365 days from now.',
  InvalidCapacity: 'Participants must be between 1 and 1000.',
  InvalidLength: 'One of the fields is outside its allowed length.',
  InvalidLink: 'Links must start with https:// or ipfs://',
  UnknownChallenge: 'That challenge does not exist.',
  UnknownProject: 'That project does not exist.',
  UnknownContribution: 'That contribution does not exist.',
  UnknownIdea: 'That idea does not exist.',
  UnknownAchievement: 'That achievement does not exist.',
  NotEligible: 'You do not meet the requirements for this achievement yet.',
  AlreadyClaimed: 'You already claimed this achievement.',
  OwnerCannotContribute: 'You own this project, so you cannot contribute to it.',
  TooManyPending: 'You already have a contribution awaiting review on this project.',
  NotProjectOwner: 'Only the project owner can do this.',
  ProjectArchived: 'This project is archived.',
  TooManyUpdates: 'This project reached its update limit.',
  CooldownActive: 'You posted recently. Wait a few minutes before posting another idea.',
  AuthorCannotEndorse: 'You cannot endorse your own idea.',
  AlreadyEndorsed: 'You already endorsed this idea.',
  IdeaIsRetracted: 'This idea was retracted.',
  ContributionNotPending: 'This contribution was already reviewed.',
  UnknownRecord: 'That proof record does not exist.',
  ParticipantHasSubmitted: 'Reject pending work first. Participants with pending or approved work cannot be removed.',
  RemovedByCreator: 'The creator removed you from this challenge.',
  HasPendingSubmissions: 'Review or reject all pending submissions before cancelling.',
  NotContributor: 'Only the contributor can withdraw this contribution.',
  NotAuthor: 'Only the author can do this.',
}

function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? text
}

export function describeError(error: unknown): DescribedError {
  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) {
      return { kind: 'rejected', message: 'Request cancelled in your wallet.' }
    }
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? ''
      const known = REVERT_MESSAGES[name]
      if (known) return { kind: 'revert', message: known }
      return { kind: 'revert', message: name ? `The contract rejected this action (${name}).` : 'The contract rejected this action.' }
    }
    const http = error.walk((e) => e instanceof HttpRequestError)
    if (http instanceof HttpRequestError && http.status === 429) {
      return { kind: 'network', message: 'The Arc RPC is rate limiting requests. Wait a few seconds and try again.' }
    }
    if (error.walk((e) => e instanceof HttpRequestError || e instanceof TimeoutError)) {
      return { kind: 'network', message: 'Could not reach the Arc RPC. Check your connection and try again.' }
    }
    const code = (error as { code?: number }).code
    if (code === 4001) return { kind: 'rejected', message: 'Request cancelled in your wallet.' }
    const short = error.shortMessage ?? error.message
    if (/insufficient funds|exceeds balance/i.test(short)) {
      return { kind: 'funds', message: 'Not enough USDC for gas. Add USDC to your wallet and try again.' }
    }
    return { kind: 'unknown', message: firstLine(short) }
  }
  if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 4001) {
    return { kind: 'rejected', message: 'Request cancelled in your wallet.' }
  }
  if (error instanceof Error) {
    if (/user rejected|user denied/i.test(error.message)) return { kind: 'rejected', message: 'Request cancelled in your wallet.' }
    if (/failed to fetch|network/i.test(error.message)) return { kind: 'network', message: 'Network problem. Check your connection and try again.' }
    return { kind: 'unknown', message: firstLine(error.message) }
  }
  return { kind: 'unknown', message: 'Something went wrong. Please try again.' }
}

/** True when a failed read is the contract saying the id does not exist (as opposed to an RPC problem). */
export function isNotFound(error: unknown, errorName: string): boolean {
  if (!(error instanceof BaseError)) return false
  const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
  return revert instanceof ContractFunctionRevertedError && revert.data?.errorName === errorName
}
