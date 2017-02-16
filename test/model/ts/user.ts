import {CompanyInfo} from "./company";
// import {Gender} from "acorn/gender";

interface Users {
    count: number
    data: User[]
}

enum Gender{
    MALE, FEMALE
}

export type Int=number // @TJS-type integer
export type UUID=string // @format uuid

export interface User {
    /**
     * the id
     */
    id: UUID
    /**
     * the given name
     * @pattern [a-z]
     *
     */
    firstName: string
    lastName: string // the family name @pattern [A-Z]
    age?: Int
    gender: Gender
    birthday: string
    parent?: User
    company: CompanyInfo
}


