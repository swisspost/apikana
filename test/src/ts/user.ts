import {CompanyInfo, UUID} from "./company";
import {Int} from "apikana/default-types";

// import {Gender} from "acorn/gender";

export interface Users {
    count: number
    data: User[]
}

export enum Gender {
    MALE, FEMALE
}

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
    firstName: string // @asType integer
    lastName: string // the family name @pattern [A-Z]
    anInt: string // @type integer
    age?: Int
    gender: Gender
    birthday: string
    parent?: User
    company: CompanyInfo
}

/**
 * base
 */
export interface Base {
    a: Int
}

interface Base2 {
    b: Int
}

/**
 * ext
 */
export interface Ext extends Base {
    c: Int
}

/**
 * ext ext
 */
export interface ExtExt extends Ext {
    d: Int
}

export interface Ext2 extends User, Base2 {
    e: Int
}


