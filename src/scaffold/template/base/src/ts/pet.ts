import {Int} from "apikana/default-types";

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

    /**
     * @format date
     */
    birthday: string

    legs: Int

    parent?: Pet
}


