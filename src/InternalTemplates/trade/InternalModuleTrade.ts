import {InternalModule} from "../InternalModule";

import {building, riding, checking} from "./trading"

export class InternalModuleTrade extends InternalModule {
    name = "trade";

    async createStaticTemplates() {
        this.static_templates.set("building", this.generate_building());
        this.static_templates.set("riding", this.generate_riding());
        this.static_templates.set("checking", this.generate_checking());
    }

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
}