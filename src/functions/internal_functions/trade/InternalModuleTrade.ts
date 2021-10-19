import {InternalModule} from "../InternalModule";

import {building, riding, checking} from "./trading"

export class InternalModuleTrade extends InternalModule {
    name = "trade";

    async updateTemplates() {
    }

    generate_building() {
        return building
    }

    generate_riding() {
        return riding
    }

    generate_checking() {
        return checking
    }

    create_dynamic_templates(): Promise<void> {
        return Promise.resolve(undefined);
    }

    create_static_templates(): Promise<void> {
        this.static_functions.set("building", this.generate_building());
        this.static_functions.set("riding", this.generate_riding());
        this.static_functions.set("checking", this.generate_checking());
        return Promise.resolve(undefined);
    }
}
