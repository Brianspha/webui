import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { UserDepositService } from './user-deposit.service';
import { TestProviders } from '../../testing/test-providers';
import { RaidenConfig } from './raiden.config';
import BigNumber from 'bignumber.js';
import { HttpClientModule } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RaidenService } from './raiden.service';
import { stub } from '../../testing/stub';
import { BehaviorSubject, Subject, of } from 'rxjs';
import {
    createAddress,
    createContractsInfo,
    createToken,
} from '../../testing/test-data';
import { ContractOptions } from 'web3-eth-contract/types';
import { AbiItem } from 'web3-utils/types';
import Spy = jasmine.Spy;
import { TokenInfoRetrieverService } from './token-info-retriever.service';
import { UserToken } from '../models/usertoken';

describe('UserDepositService', () => {
    let service: UserDepositService;
    let reconnectedSubject: BehaviorSubject<void>;
    let rpcConnectedSubject: Subject<void>;
    let tokenAddressResult: Promise<string>;
    let balanceResult: Promise<string>;
    let tokenBalanceResult: Promise<string>;
    let tokenRetrieverSpy: Spy;

    const balance = '40000000';
    let token: UserToken;

    beforeEach(() => {
        const raidenServiceMock = stub<RaidenService>();
        // @ts-ignore
        raidenServiceMock.raidenAddress$ = of(createAddress());
        reconnectedSubject = new BehaviorSubject(null);
        // @ts-ignore
        raidenServiceMock.reconnected$ = reconnectedSubject.asObservable();
        rpcConnectedSubject = new BehaviorSubject(null);
        // @ts-ignore
        raidenServiceMock.rpcConnected$ = rpcConnectedSubject.asObservable();
        raidenServiceMock.getContractsInfo = () => of(createContractsInfo());

        TestBed.configureTestingModule({
            imports: [HttpClientModule, HttpClientTestingModule],
            providers: [
                TestProviders.MockRaidenConfigProvider(),
                {
                    provide: RaidenService,
                    useValue: raidenServiceMock,
                },
                TokenInfoRetrieverService,
            ],
        });
        const raidenConfig = TestBed.inject(RaidenConfig);

        token = createToken();
        tokenAddressResult = Promise.resolve(token.address);
        balanceResult = Promise.resolve(balance);
        tokenBalanceResult = Promise.resolve(token.balance.toString());

        // @ts-ignore
        raidenConfig.web3.eth.Contract = function (
            jsonInterface: AbiItem[],
            address?: string,
            options?: ContractOptions
        ) {
            const contractMock = {
                address: address,
                options: {},
                methods: {},
            };
            if (
                jsonInterface.find((item: AbiItem) => item.name === 'balanceOf')
            ) {
                contractMock.methods = {
                    balanceOf: () => {
                        return {
                            call: () => tokenBalanceResult,
                        };
                    },
                };
            } else {
                contractMock.methods = {
                    token: () => {
                        return {
                            call: () => tokenAddressResult,
                        };
                    },
                    balances: () => {
                        return {
                            call: () => balanceResult,
                        };
                    },
                };
            }
            return contractMock;
        };

        tokenRetrieverSpy = spyOn(
            TestBed.inject(TokenInfoRetrieverService),
            'createBatch'
        );

        service = TestBed.inject(UserDepositService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should periodically poll the UDC balance', fakeAsync(() => {
        const spy = jasmine.createSpy();
        const subscription = service.balance$.subscribe(spy);

        tick(15000);
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy).toHaveBeenCalledWith(new BigNumber(balance));
        flush();
        subscription.unsubscribe();
    }));

    it('should retry polling the UDC balance after successful rpc connection attempt', fakeAsync(() => {
        const spy = jasmine.createSpy();
        balanceResult = Promise.reject();
        const subscription = service.balance$.subscribe(spy);

        balanceResult = Promise.resolve(balance);
        rpcConnectedSubject.next();

        tick();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(new BigNumber(balance));
        flush();
        subscription.unsubscribe();
    }));

    it('should periodically poll the services token', fakeAsync(() => {
        tokenRetrieverSpy.and.returnValue(
            Promise.resolve({ [token.address]: token })
        );
        tokenBalanceResult = Promise.resolve('999999');
        const tokenWithFetchedBalance = Object.assign({}, token, {
            balance: new BigNumber('999999'),
        });

        const spy = jasmine.createSpy();
        const subscription = service.servicesToken$.subscribe(spy);

        tick(15000);
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy).toHaveBeenCalledWith(tokenWithFetchedBalance);
        flush();
        subscription.unsubscribe();
    }));

    it('should retry getting the token address after successful rpc connection attempt', fakeAsync(() => {
        tokenRetrieverSpy.and.returnValue(
            Promise.resolve({ [token.address]: token })
        );

        const spy = jasmine.createSpy();
        tokenAddressResult = Promise.reject();
        const subscription = service.servicesToken$.subscribe(spy);

        tokenAddressResult = Promise.resolve(token.address);
        rpcConnectedSubject.next();

        tick();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(token);
        flush();
        subscription.unsubscribe();
    }));

    it('should retry getting the token info after successful rpc connection attempt', fakeAsync(() => {
        tokenRetrieverSpy.and.returnValues(
            Promise.reject(),
            Promise.resolve({ [token.address]: token })
        );

        const spy = jasmine.createSpy();
        const subscription = service.servicesToken$.subscribe(spy);
        rpcConnectedSubject.next();

        tick();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(token);
        flush();
        subscription.unsubscribe();
    }));
});
