import {DateOnly} from "apikana/default-types";
import {Int} from "apikana/default-types";

export interface PetList {
    pets: Pet[]
}

export interface Pet {
    /**
     * The id.
     */
    id: string

    /**
     * The given name.
     * @pattern [A-Z][a-z]+
     *
     */
    firstName: string

    /**
     * The family name.
     */
    lastName: string

    /**
     * The birthday date.
     */
    birthday: DateOnly

    /**
     * The number of legs.
     */
    numberOfLegs: Int
}


