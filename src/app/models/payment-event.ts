import BigNumber from 'bignumber.js';
import { UserToken } from './usertoken';

export interface PaymentEvent {
    readonly reason?: string;
    readonly target?: string;
    readonly initiator?: string;
    readonly event:
        | 'EventPaymentSentSuccess'
        | 'EventPaymentSentFailed'
        | 'EventPaymentReceivedSuccess';
    readonly amount?: BigNumber;
    readonly identifier?: BigNumber;
    readonly log_time: string;
    readonly token_address: string;
    userToken?: UserToken;
}
