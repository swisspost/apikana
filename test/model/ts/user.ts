import {CompanyInfo, UUID} from "./company";
// import {Gender} from "acorn/gender";

export interface Users {
    count: number
    data: User[]
}

export enum Gender{
    MALE, FEMALE
}

export type Int=number // @typedef integer


export interface User {
    /**
     * the id
     */
    id: UUID
    /**
     * the given name
     * @pattern [a-z]
     * @asType dfl
     * @description afasdfsd
     */
    firstName: string // @TJS-type integer
    lastName: string // the family name @pattern [A-Z]
    age?: Int
    gender: Gender
    birthday: string
    parent?: User
    company: CompanyInfo
}


