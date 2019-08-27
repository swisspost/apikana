import {Int} from "apikana/default-types";

export interface PetList {
    pets: Pet[]
}

export interface Pet {
    id: string // the id

    /**
     * The given name
     * @pattern [A-Z][a-z]+
     *
     */
    firstName: string

    /**
     * The family name
     */
    lastName: string

    birthday: Date

    /**
     * @format integer
     */
    numberOfLegs: number
}


