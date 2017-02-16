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

    /**
     * @type integer
     */
    legs: number

    parent?: Pet
}


