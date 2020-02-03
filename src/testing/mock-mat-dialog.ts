import { of } from 'rxjs';

export class MockMatDialog {
    cancelled: boolean;
    returns: () => any = () => true;

    constructor() {}

    open() {
        return {
            componentInstance: {},
            afterClosed: () => {
                return of(this.cancelled ? null : this.returns());
            },
            close() {}
        };
    }
}
