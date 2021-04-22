import {InternalModule} from "../InternalModule";

import {building, riding} from "./trading"

export class InternalModuleTrade extends InternalModule {
    name = "trade";

    async createStaticTemplates() {
        this.static_templates.set("building", this.generate_building());
        this.static_templates.set("riding", this.generate_riding());
    }

    async updateTemplates() {
    }

    generate_building() {
        return building
    }

    generate_riding() {
        return riding
    }
}